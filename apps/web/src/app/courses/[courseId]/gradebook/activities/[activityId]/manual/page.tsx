"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useNotifications } from "@cognelo/activity-ui";
import { createCodingHomeworkGraderClient, type CodingHomeworkGradebookAttemptRecord } from "@cognelo/plugin-coding-homework-grader";
import {
  createMcqClient,
  getMcqManualGradingCopy,
  MarkdownBlocksView,
  parseMcqSource,
  scoreSelectedChoices,
  type McqSubmission
} from "@cognelo/plugin-mcq";
import { createParsonsClient, type ParsonsAttemptEvaluation, type ParsonsGradebookAttemptRecord } from "@cognelo/plugin-parsons";
import { AppShell } from "@/components/app-shell";
import { api, apiRequest, Course, CourseGradebook, CourseGradebookRow } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

const DEFAULT_PAGE_SIZE = 10;
const MCQ_PAGE_SIZE = 1;

type DraftGrade = {
  score: string;
  feedback: string;
  questionScores?: Record<string, string>;
};

type ManualGradingAttempt = ParsonsGradebookAttemptRecord | McqSubmission | CodingHomeworkGradebookAttemptRecord;

export default function ManualActivityGradingPage() {
  const params = useParams<{ courseId: string; activityId: string }>();
  const searchParams = useSearchParams();
  const { courseId, activityId } = params;
  const groupId = searchParams.get("groupId") || undefined;
  const { locale, t } = useI18n();
  const notifications = useNotifications();
  const mcqCopy = getMcqManualGradingCopy(locale);
  const codingHomeworkClient = useMemo(() => createCodingHomeworkGraderClient(apiRequest), []);
  const mcqClient = useMemo(() => createMcqClient(apiRequest), []);
  const parsonsClient = useMemo(() => createParsonsClient(apiRequest), []);
  const [course, setCourse] = useState<Course | null>(null);
  const [gradebook, setGradebook] = useState<CourseGradebook | null>(null);
  const [pageIndex, setPageIndex] = useState(0);
  const [attemptsByRowKey, setAttemptsByRowKey] = useState<Record<string, ManualGradingAttempt[]>>({});
  const [activityConfigByRowKey, setActivityConfigByRowKey] = useState<Record<string, Record<string, unknown>>>({});
  const [draftsByRowKey, setDraftsByRowKey] = useState<Record<string, DraftGrade>>({});
  const [loadingAttempts, setLoadingAttempts] = useState(false);
  const [saving, setSaving] = useState(false);

  async function refresh() {
    const [courseResult, gradebookResult] = await Promise.all([
      api.course(courseId),
      api.courseGradebook(courseId, { activityId, groupId })
    ]);
    setCourse(courseResult.course);
    setGradebook(gradebookResult.gradebook);
  }

  useEffect(() => {
    refresh().catch((err) => notifications.error(err instanceof Error ? err.message : t("courseDetail.loadError")));
  }, [activityId, courseId, groupId, notifications, t]);

  const rows = useMemo(
    () =>
      [...(gradebook?.rows ?? [])].sort((left, right) => {
        const groupDelta = left.groupTitle.localeCompare(right.groupTitle);
        return groupDelta === 0 ? left.participantName.localeCompare(right.participantName) : groupDelta;
      }),
    [gradebook?.rows]
  );
  const activityTypeKey = rows[0]?.activityTypeKey ?? gradebook?.items[0]?.activityTypeKey ?? "";
  const pageSize = activityTypeKey === "mcq" ? MCQ_PAGE_SIZE : DEFAULT_PAGE_SIZE;
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const pageRows = useMemo(() => rows.slice(pageIndex * pageSize, pageIndex * pageSize + pageSize), [pageIndex, pageSize, rows]);
  const activityTitle = rows[0]?.activityTitle ?? gradebook?.items[0]?.activityTitle ?? t("common.loading");
  const groupTitle = groupId ? gradebook?.items.find((item) => item.groupId === groupId)?.groupTitle : null;
  const resultsHref = `/courses/${courseId}/gradebook/activities/${activityId}${groupId ? `?groupId=${groupId}` : ""}`;

  useEffect(() => {
    if (!pageRows.length) {
      return;
    }

    let cancelled = false;
    setLoadingAttempts(true);

    Promise.all(
      pageRows.map(async (row) => {
        if (row.activityTypeKey === "mcq") {
          const [result, activityResult] = await Promise.all([
            mcqClient.groupGradebookAttempts(courseId, row.groupId, row.activityId, {
              participantId: row.participantId
            }),
            api.groupActivity(courseId, row.groupId, row.activityId)
          ]);
          return { row, attempts: sortAttemptsByDisplayedTimestamp(result.attempts), activityConfig: activityResult.activity.config ?? {} };
        }
        if (row.activityTypeKey === "coding-homework-grader") {
          const [result, activityResult] = await Promise.all([
            codingHomeworkClient.groupGradebookAttempts(courseId, row.groupId, row.activityId, {
              participantId: row.participantId,
              includeAttempts: false
            }),
            api.groupActivity(courseId, row.groupId, row.activityId)
          ]);
          return { row, attempts: sortAttemptsByDisplayedTimestamp(result.attempts), activityConfig: activityResult.activity.config ?? {} };
        }
        const [result, activityResult] = await Promise.all([
          parsonsClient.groupGradebookAttempts(courseId, row.groupId, row.activityId, {
            participantId: row.participantId,
            includeAttempts: false
          }),
          api.groupActivity(courseId, row.groupId, row.activityId)
        ]);
        return { row, attempts: sortAttemptsByDisplayedTimestamp(result.attempts), activityConfig: activityResult.activity.config ?? {} };
      })
    )
      .then((results) => {
        if (cancelled) {
          return;
        }
        setAttemptsByRowKey((current) => {
          const next = { ...current };
          results.forEach(({ row, attempts }) => {
            next[rowKey(row)] = attempts;
          });
          return next;
        });
        setActivityConfigByRowKey((current) => {
          const next = { ...current };
          results.forEach(({ row, activityConfig }) => {
            next[rowKey(row)] = activityConfig;
          });
          return next;
        });
        setDraftsByRowKey((current) => {
          const next = { ...current };
          results.forEach(({ row, attempts, activityConfig }) => {
            const key = rowKey(row);
            if (next[key]) {
              return;
            }
            const selectedAttempt = attempts[0] ?? null;
            const evaluation = selectedAttempt && "latestState" in selectedAttempt ? selectedAttempt.latestState.lastEvaluation ?? null : null;
            const initialScore =
              row.score ??
              (selectedAttempt && "answers" in selectedAttempt
                ? scoreFromMcqAttempt(activityConfig, selectedAttempt, row.maxScore)
                : scoreFromEvaluation(evaluation, row.maxScore));
            next[key] = {
              score: initialScore === null ? "" : formatGradeNumber(initialScore),
              questionScores:
                selectedAttempt && "answers" in selectedAttempt
                  ? mcqQuestionScores(activityConfig, selectedAttempt, row.maxScore)
                  : undefined,
              feedback: feedbackFromGrade(row, t) || feedbackFromEvaluation(evaluation, t)
            };
          });
          return next;
        });
      })
      .catch((err) => {
        if (!cancelled) {
          notifications.error(err instanceof Error ? err.message : t("courseDetail.answerLoadError"));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingAttempts(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [codingHomeworkClient, courseId, mcqClient, notifications, pageRows, parsonsClient, t]);

  async function saveCurrentPage() {
    setSaving(true);
    try {
      for (const row of pageRows) {
        const draft = draftsByRowKey[rowKey(row)];
        if (!draft) {
          continue;
        }
        if (!draft.score.trim()) {
          continue;
        }
        const mcqAnswers = draft.questionScores
          ? buildMcqReviewAnswers(activityConfigByRowKey[rowKey(row)] ?? {}, (attemptsByRowKey[rowKey(row)] ?? [])[0] as McqSubmission, row.maxScore)
          : [];
        if (draft.questionScores) {
          const invalidAnswer = mcqAnswers.find((answer) => {
            const score = Number(draft.questionScores?.[answer.questionId] ?? "");
            return !Number.isFinite(score) || score > answer.maxScore;
          });
          if (invalidAnswer) {
            throw new Error(mcqCopy.invalidQuestionScore);
          }
        }
        const score = draft.questionScores ? sumQuestionScores(draft.questionScores) : Number(draft.score);
        if (!Number.isFinite(score)) {
          throw new Error(t("courseDetail.overrideGradeInvalid"));
        }
        await api.overrideGradebookGrade(courseId, row.gradebookItemId, row.participantId, {
          score,
          maxScore: row.maxScore,
          reason: draft.feedback.trim() || null,
          feedbackText: draft.feedback.trim() || null
        });
      }
      await refresh();
      notifications.success(t("courseDetail.manualGradingSaved"));
      return true;
    } catch (err) {
      notifications.error(err instanceof Error ? err.message : t("courseDetail.overrideGradeError"));
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function goToPage(nextPageIndex: number) {
    if (nextPageIndex < 0 || nextPageIndex >= pageCount || nextPageIndex === pageIndex) {
      return;
    }
    const saved = await saveCurrentPage();
    if (saved) {
      setPageIndex(nextPageIndex);
    }
  }

  function updateDraft(row: CourseGradebookRow, patch: Partial<DraftGrade>) {
    const key = rowKey(row);
    setDraftsByRowKey((current) => ({
      ...current,
      [key]: {
        score: current[key]?.score ?? "",
        feedback: current[key]?.feedback ?? "",
        ...patch
      }
    }));
  }

  function updateQuestionScore(row: CourseGradebookRow, questionId: string, score: string, maxScore: number) {
    const key = rowKey(row);
    setDraftsByRowKey((current) => {
      const currentDraft = current[key] ?? { score: "", feedback: "", questionScores: {} };
      const questionScores = {
        ...(currentDraft.questionScores ?? {}),
        [questionId]: clampQuestionScoreInput(score, maxScore)
      };
      return {
        ...current,
        [key]: {
          ...currentDraft,
          questionScores,
          score: formatGradeNumber(sumQuestionScores(questionScores))
        }
      };
    });
  }

  return (
    <AppShell>
      <main className="page stack">
        <section className="hero-panel hero-panel-compact">
          <div className="hero-meta">
            <p className="eyebrow">{t("courseDetail.gradeAllManually")}</p>
            <h1>{activityTitle}</h1>
            <p className="muted">
              {course?.title ?? t("common.loading")}
              {groupTitle ? ` · ${groupTitle}` : ""}
            </p>
          </div>
          <div className="hero-actions">
            <Link className="button secondary" href={resultsHref}>
              {t("courseDetail.detailedResults")}
            </Link>
          </div>
        </section>

        <section className="section stack">
          <div className="section-heading">
            <div>
              <p className="eyebrow">{t("courseDetail.studentResultsTitle")}</p>
              <h2>{t("courseDetail.manualGradingPagePosition", { current: pageIndex + 1, total: pageCount })}</h2>
            </div>
            <div className="row wrap">
              <button className="button secondary" disabled={saving || pageIndex === 0} type="button" onClick={() => void goToPage(pageIndex - 1)}>
                {t("courseDetail.previousSubmission")}
              </button>
              <button className="button secondary" disabled={saving || pageIndex >= pageCount - 1} type="button" onClick={() => void goToPage(pageIndex + 1)}>
                {t("courseDetail.nextSubmission")}
              </button>
              <button disabled={saving} type="button" onClick={() => void saveCurrentPage()}>
                {saving ? t("common.saving") : t("common.save")}
              </button>
            </div>
          </div>

          {loadingAttempts ? <p className="muted">{t("common.loading")}</p> : null}

          {pageRows.length ? (
            <div className="stack">
              {pageRows.map((row) => {
                const key = rowKey(row);
                const attempts = attemptsByRowKey[key] ?? [];
                const selectedAttempt = attempts[0] ?? null;
                const draft = draftsByRowKey[key] ?? { score: "", feedback: "" };
                const activityConfig = activityConfigByRowKey[key] ?? {};
                const mcqReviewAnswers = selectedAttempt && "answers" in selectedAttempt
                  ? buildMcqReviewAnswers(activityConfig, selectedAttempt, row.maxScore)
                  : [];

                return (
                  <article className="inline-panel stack" key={rowKey(row)}>
                    <div className="section-heading">
                      <div>
                        <p className="eyebrow">{row.groupTitle}</p>
                        <h3>{row.participantName}</h3>
                        <p className="muted">{row.participantEmail}</p>
                      </div>
                      <strong>{formatGradebookScore(row.score, row.maxScore)}</strong>
                    </div>

                    {selectedAttempt && "answers" in selectedAttempt ? (
                      <div className="stack">
                        {mcqReviewAnswers.map((answer, index) => (
                          <article
                            className="stack"
                            key={answer.questionId}
                            style={{ border: "1px solid rgba(13, 27, 71, 0.12)", borderRadius: 10, gap: 14, padding: 16 }}
                          >
                            <div className="stack" style={{ gap: 8 }}>
                              <div className="answer-meta">
                                <p className="eyebrow" style={{ margin: 0 }}>{formatMessage(mcqCopy.question, { number: index + 1 })}</p>
                                {answer.question ? <CorrectnessIcon correct={answer.isCorrect} copy={mcqCopy} /> : null}
                              </div>
                              {answer.question ? <MarkdownBlocksView blocks={answer.question.promptBlocks} /> : <strong>{answer.questionId}</strong>}
                            </div>
                            <div className="stack" style={{ gap: 10 }}>
                              <p className="eyebrow">{mcqCopy.studentAnswer}</p>
                              {answer.choices.length ? (
                                answer.choices.map((choice) =>
                                  choice.choice ? (
                                    <div
                                      key={choice.choiceId}
                                      style={{
                                        alignItems: "flex-start",
                                        border: "1px solid rgba(13, 27, 71, 0.1)",
                                        borderRadius: 8,
                                        display: "flex",
                                        gap: 10,
                                        padding: 12
                                      }}
                                    >
                                      <CorrectnessIcon correct={choice.isCorrectChoice} copy={mcqCopy} />
                                      <div style={{ flex: 1, minWidth: 0 }}>
                                        <MarkdownBlocksView blocks={choice.choice.blocks} compact />
                                      </div>
                                    </div>
                                  ) : (
                                    <p className="muted" key={choice.choiceId}>{choice.choiceId}</p>
                                  )
                                )
                              ) : (
                                <p className="muted">-</p>
                              )}
                              {answer.missedChoices.map((choice) =>
                                choice.choice ? (
                                  <div
                                    key={choice.choiceId}
                                    style={{
                                      alignItems: "flex-start",
                                      border: "1px solid rgba(217, 119, 6, 0.22)",
                                      borderRadius: 8,
                                      display: "flex",
                                      gap: 10,
                                      padding: 12
                                    }}
                                  >
                                    <MissedAnswerIcon copy={mcqCopy} />
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                      <MarkdownBlocksView blocks={choice.choice.blocks} compact />
                                    </div>
                                  </div>
                                ) : null
                              )}
                              <div className="field" style={{ maxWidth: 220 }}>
                                <label htmlFor={`score-${rowKey(row)}-${answer.questionId}`}>
                                  {formatMessage(mcqCopy.points, {
                                    score: formatGradeNumber(Number(draft.questionScores?.[answer.questionId] ?? answer.awardedScore)),
                                    max: formatGradeNumber(answer.maxScore)
                                  })}
                                </label>
                                <input
                                  id={`score-${rowKey(row)}-${answer.questionId}`}
                                  inputMode="decimal"
                                  max={answer.maxScore}
                                  step="any"
                                  type="number"
                                  value={draft.questionScores?.[answer.questionId] ?? ""}
                                  onChange={(event) => updateQuestionScore(row, answer.questionId, event.target.value, answer.maxScore)}
                                />
                              </div>
                            </div>
                          </article>
                        ))}
                      </div>
                    ) : selectedAttempt && "latestState" in selectedAttempt ? (
                      <div className="parsons-answer-lines">
                        {selectedAttempt.latestState.blocks.map((block) => (
                          <pre key={block.id} style={{ marginLeft: `${block.currentIndent * 18}px` }}>
                            {block.displayText}
                          </pre>
                        ))}
                      </div>
                    ) : selectedAttempt && "questions" in selectedAttempt ? (
                      <div className="stack">
                        {selectedAttempt.questions.map((question) => (
                          <article
                            className="stack"
                            key={question.id}
                            style={{ border: "1px solid rgba(13, 27, 71, 0.12)", borderRadius: 10, gap: 12, padding: 16 }}
                          >
                            <p className="eyebrow" style={{ margin: 0 }}>Question {question.orderIndex + 1}</p>
                            <strong>{question.questionText}</strong>
                            <p style={{ whiteSpace: "pre-wrap" }}>{question.studentAnswer || "-"}</p>
                          </article>
                        ))}
                      </div>
                    ) : (
                      <p className="muted">{t("courseDetail.noAnswers")}</p>
                    )}

                    <div className="form">
                      {draft.questionScores ? (
                        <p className="muted">Total: {formatGradebookScore(sumQuestionScores(draft.questionScores), row.maxScore)}</p>
                      ) : (
                        <div className="field">
                          <label htmlFor={`score-${rowKey(row)}`}>{t("courseDetail.overrideGradePrompt", { max: formatGradeNumber(row.maxScore) })}</label>
                          <input
                            id={`score-${rowKey(row)}`}
                            inputMode="decimal"
                            step="any"
                            type="number"
                            value={draft.score}
                            onChange={(event) => updateDraft(row, { score: event.target.value })}
                          />
                        </div>
                      )}
                      <div className="field">
                        <label htmlFor={`feedback-${rowKey(row)}`}>{t("courseDetail.overrideReasonPrompt")}</label>
                        <textarea
                          id={`feedback-${rowKey(row)}`}
                          value={draft.feedback}
                          onChange={(event) => updateDraft(row, { feedback: event.target.value })}
                        />
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <p className="muted">{t("courseDetail.noGradebookRows")}</p>
          )}
        </section>
      </main>
    </AppShell>
  );
}

function rowKey(row: CourseGradebookRow) {
  return `${row.gradebookItemId}:${row.participantId}`;
}

function scoreFromEvaluation(evaluation: ParsonsAttemptEvaluation | null, maxScore: number) {
  if (!evaluation) {
    return null;
  }
  const rawScore = evaluation.isCorrect ? 1 : (evaluation.orderCorrect ? 0.7 : 0) + (evaluation.indentationCorrect ? 0.3 : 0);
  return rawScore * maxScore;
}

function scoreFromMcqAttempt(activityConfig: Record<string, unknown>, attempt: McqSubmission, maxScore: number) {
  return sumQuestionScores(mcqQuestionScores(activityConfig, attempt, maxScore));
}

function mcqQuestionScores(activityConfig: Record<string, unknown>, attempt: McqSubmission, maxScore: number) {
  return Object.fromEntries(
    buildMcqReviewAnswers(activityConfig, attempt, maxScore).map((answer) => [
      answer.questionId,
      formatGradeNumber(answer.awardedScore)
    ])
  );
}

function buildMcqReviewAnswers(activityConfig: Record<string, unknown>, selectedAttempt: McqSubmission, maxScore: number) {
  const source = typeof activityConfig.source === "string" ? activityConfig.source : "";
  const defaultCodeLanguage = typeof activityConfig.defaultCodeLanguage === "string" ? activityConfig.defaultCodeLanguage : "python";
  const parsed = source ? parseMcqSource(source, defaultCodeLanguage) : null;
  const questions = new Map((parsed?.questions ?? []).map((question) => [question.id, question]));
  const questionIds = parsed?.questions.length ? parsed.questions.map((question) => question.id) : Object.keys(selectedAttempt.answers);
  const maxScores = allocateQuestionMaxScores(questionIds.length, maxScore);

  return questionIds.map((questionId, index) => {
    const choiceIds = selectedAttempt.answers[questionId] ?? [];
    const question = questions.get(questionId) ?? null;
    const choices = new Map((question?.choices ?? []).map((choice) => [choice.id, choice]));
    const correctChoiceIds = normalizeChoiceIds(question?.choices.filter((choice) => choice.isCorrect).map((choice) => choice.id) ?? []);
    const selectedChoiceIds = normalizeChoiceIds(choiceIds);
    const isCorrect =
      Boolean(question) &&
      selectedChoiceIds.length === correctChoiceIds.length &&
      selectedChoiceIds.every((choiceId, selectedIndex) => choiceId === correctChoiceIds[selectedIndex]);
    const awardedScore = roundGrade(maxScores[index] * scoreSelectedChoices(selectedChoiceIds, correctChoiceIds));
    return {
      questionId,
      question,
      isCorrect,
      awardedScore,
      maxScore: maxScores[index],
      choices: choiceIds.map((choiceId) => ({
        choiceId,
        choice: choices.get(choiceId) ?? null,
        isCorrectChoice: correctChoiceIds.includes(choiceId)
      })),
      missedChoices: correctChoiceIds
        .filter((choiceId) => !selectedChoiceIds.includes(choiceId))
        .map((choiceId) => ({
          choiceId,
          choice: choices.get(choiceId) ?? null
        }))
    };
  });
}

function allocateQuestionMaxScores(questionCount: number, maxScore: number) {
  if (questionCount <= 0) {
    return [];
  }
  const baseScore = roundGrade(maxScore / questionCount);
  return Array.from({ length: questionCount }, (_value, index) =>
    index === questionCount - 1 ? roundGrade(maxScore - baseScore * (questionCount - 1)) : baseScore
  );
}

function normalizeChoiceIds(choiceIds: string[]) {
  return [...new Set(choiceIds.filter((choiceId) => typeof choiceId === "string"))].sort();
}

function sumQuestionScores(questionScores: Record<string, string>) {
  return roundGrade(
    Object.values(questionScores).reduce((sum, value) => {
      const numericValue = Number(value);
      return Number.isFinite(numericValue) ? sum + numericValue : sum;
    }, 0)
  );
}

function roundGrade(value: number) {
  return Math.round(value * 100) / 100;
}

function clampQuestionScoreInput(value: string, maxScore: number) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return value;
  }
  return numericValue > maxScore ? formatGradeNumber(maxScore) : value;
}

function feedbackFromEvaluation(evaluation: ParsonsAttemptEvaluation | null, t: (key: string, params?: Record<string, string | number>) => string) {
  if (!evaluation) {
    return "";
  }
  if (evaluation.isCorrect) {
    return t("parsons.correct");
  }
  return [
    evaluation.orderCorrect ? "" : t("parsons.orderFeedback", { count: evaluation.misplacedBlocks }),
    evaluation.indentationCorrect ? "" : t("parsons.indentFeedback", { count: evaluation.incorrectIndents })
  ]
    .filter(Boolean)
    .join("\n");
}

function feedbackFromGrade(row: CourseGradebookRow, t: (key: string, params?: Record<string, string | number>) => string) {
  const feedback = row.feedback;
  if (!feedback) {
    return "";
  }
  const messages = getParsonsFeedbackMessages(feedback);
  return [
    feedback.feedbackText ?? "",
    ...messages.map((message) =>
      message.type === "order"
        ? t("parsons.orderFeedback", { count: message.count })
        : t("parsons.indentFeedback", { count: message.count })
    )
  ]
    .filter(Boolean)
    .join("\n");
}

function getParsonsFeedbackMessages(feedback: CourseGradebookRow["feedback"]) {
  const details = feedback?.kind === "parsons" && feedback.details && typeof feedback.details === "object" ? feedback.details : {};
  return Array.isArray(details.messages)
    ? details.messages
        .map((message) => {
          const item = message && typeof message === "object" ? (message as Record<string, unknown>) : null;
          const type = item?.type;
          const count = typeof item?.count === "number" ? item.count : null;
          return (type === "order" || type === "indentation") && count !== null ? { type, count } : null;
        })
        .filter((message): message is { type: "order" | "indentation"; count: number } => message !== null)
    : [];
}

function formatGradebookScore(score: number | null, maxScore: number) {
  if (score === null) {
    return "-";
  }
  return `${formatGradeNumber(score)} / ${formatGradeNumber(maxScore)}`;
}

function formatGradeNumber(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function sortAttemptsByDisplayedTimestamp<T extends ManualGradingAttempt>(attempts: T[]) {
  return [...attempts].sort((left, right) => attemptDisplayTime(right) - attemptDisplayTime(left));
}

function attemptDisplayTime(attempt: ManualGradingAttempt) {
  const value =
    "completedAt" in attempt
      ? attempt.completedAt ?? attempt.lastInteractionAt
      : attempt.submittedAt ?? attempt.gradedAt;
  return value ? new Date(value).getTime() : 0;
}

function CorrectnessIcon({ correct, copy }: { correct: boolean; copy: ReturnType<typeof getMcqManualGradingCopy> }) {
  const label = correct ? copy.correct : copy.incorrect;
  return (
    <span
      aria-label={label}
      title={label}
      style={{
        alignItems: "center",
        background: correct ? "rgba(34, 197, 94, 0.12)" : "rgba(220, 38, 38, 0.1)",
        border: `1px solid ${correct ? "rgba(22, 163, 74, 0.35)" : "rgba(220, 38, 38, 0.28)"}`,
        borderRadius: 999,
        color: correct ? "#15803d" : "#b91c1c",
        display: "inline-flex",
        flex: "0 0 auto",
        height: 24,
        justifyContent: "center",
        width: 24
      }}
    >
      {correct ? (
        <svg aria-hidden="true" fill="none" height="15" viewBox="0 0 24 24" width="15">
          <path d="M20 6 9 17l-5-5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" />
        </svg>
      ) : (
        <svg aria-hidden="true" fill="none" height="15" viewBox="0 0 24 24" width="15">
          <path d="m6 6 12 12M18 6 6 18" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" />
        </svg>
      )}
    </span>
  );
}

function MissedAnswerIcon({ copy }: { copy: ReturnType<typeof getMcqManualGradingCopy> }) {
  return (
    <span
      aria-label={copy.missedCorrectAnswer}
      title={copy.missedCorrectAnswer}
      style={{
        alignItems: "center",
        background: "rgba(245, 158, 11, 0.12)",
        border: "1px solid rgba(217, 119, 6, 0.35)",
        borderRadius: 999,
        color: "#b45309",
        display: "inline-flex",
        flex: "0 0 auto",
        height: 24,
        justifyContent: "center",
        width: 24
      }}
    >
      <svg aria-hidden="true" fill="none" height="15" viewBox="0 0 24 24" width="15">
        <path d="M12 7v6" stroke="currentColor" strokeLinecap="round" strokeWidth="3" />
        <path d="M12 17h.01" stroke="currentColor" strokeLinecap="round" strokeWidth="3" />
      </svg>
    </span>
  );
}

function formatMessage(message: string, vars: Record<string, string | number>) {
  return message.replace(/\{(\w+)\}/g, (_match, key) => String(vars[key] ?? `{${key}}`));
}
