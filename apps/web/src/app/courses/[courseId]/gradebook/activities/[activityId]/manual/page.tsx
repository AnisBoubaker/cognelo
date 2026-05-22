"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { api, Course, CourseGradebook, CourseGradebookRow, ParsonsAttemptEvaluation, ParsonsGradebookAttempt } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

const PAGE_SIZE = 10;

type DraftGrade = {
  score: string;
  feedback: string;
};

export default function ManualActivityGradingPage() {
  const params = useParams<{ courseId: string; activityId: string }>();
  const searchParams = useSearchParams();
  const { courseId, activityId } = params;
  const groupId = searchParams.get("groupId") || undefined;
  const { t } = useI18n();
  const [course, setCourse] = useState<Course | null>(null);
  const [gradebook, setGradebook] = useState<CourseGradebook | null>(null);
  const [pageIndex, setPageIndex] = useState(0);
  const [attemptsByRowKey, setAttemptsByRowKey] = useState<Record<string, ParsonsGradebookAttempt[]>>({});
  const [draftsByRowKey, setDraftsByRowKey] = useState<Record<string, DraftGrade>>({});
  const [loadingAttempts, setLoadingAttempts] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function refresh() {
    const [courseResult, gradebookResult] = await Promise.all([
      api.course(courseId),
      api.courseGradebook(courseId, { activityId, groupId })
    ]);
    setCourse(courseResult.course);
    setGradebook(gradebookResult.gradebook);
  }

  useEffect(() => {
    refresh().catch((err) => setError(err instanceof Error ? err.message : t("courseDetail.loadError")));
  }, [activityId, courseId, groupId, t]);

  const rows = useMemo(
    () =>
      [...(gradebook?.rows ?? [])].sort((left, right) => {
        const groupDelta = left.groupTitle.localeCompare(right.groupTitle);
        return groupDelta === 0 ? left.participantName.localeCompare(right.participantName) : groupDelta;
      }),
    [gradebook?.rows]
  );
  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const pageRows = useMemo(() => rows.slice(pageIndex * PAGE_SIZE, pageIndex * PAGE_SIZE + PAGE_SIZE), [pageIndex, rows]);
  const activityTitle = rows[0]?.activityTitle ?? gradebook?.items[0]?.activityTitle ?? t("common.loading");
  const groupTitle = groupId ? gradebook?.items.find((item) => item.groupId === groupId)?.groupTitle : null;
  const resultsHref = `/courses/${courseId}/gradebook/activities/${activityId}${groupId ? `?groupId=${groupId}` : ""}`;

  useEffect(() => {
    if (!pageRows.length) {
      return;
    }

    let cancelled = false;
    setLoadingAttempts(true);
    setError("");

    Promise.all(
      pageRows.map(async (row) => {
        const result = await api.groupParsonsGradebookAttempts(courseId, row.groupId, row.activityId, {
          participantId: row.participantId,
          includeAttempts: false
        });
        return { row, attempts: sortAttemptsByDisplayedTimestamp(result.attempts) };
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
        setDraftsByRowKey((current) => {
          const next = { ...current };
          results.forEach(({ row, attempts }) => {
            const key = rowKey(row);
            if (next[key]) {
              return;
            }
            const evaluation = attempts[0]?.latestState.lastEvaluation ?? null;
            const initialScore = row.score ?? scoreFromEvaluation(evaluation, row.maxScore);
            next[key] = {
              score: initialScore === null ? "" : formatGradeNumber(initialScore),
              feedback: feedbackFromGrade(row, t) || feedbackFromEvaluation(evaluation, t)
            };
          });
          return next;
        });
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : t("courseDetail.answerLoadError"));
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
  }, [courseId, pageRows, t]);

  async function saveCurrentPage() {
    setSaving(true);
    setError("");
    try {
      for (const row of pageRows) {
        const draft = draftsByRowKey[rowKey(row)];
        if (!draft) {
          continue;
        }
        if (!draft.score.trim()) {
          continue;
        }
        const score = Number(draft.score);
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
    } catch (err) {
      setError(err instanceof Error ? err.message : t("courseDetail.overrideGradeError"));
      throw err;
    } finally {
      setSaving(false);
    }
  }

  async function goToPage(nextPageIndex: number) {
    if (nextPageIndex < 0 || nextPageIndex >= pageCount || nextPageIndex === pageIndex) {
      return;
    }
    try {
      await saveCurrentPage();
      setPageIndex(nextPageIndex);
    } catch {
      // Keep the teacher on the current page so they can fix the invalid row.
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

        {error ? <p className="error">{error}</p> : null}

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
                const attempts = attemptsByRowKey[rowKey(row)] ?? [];
                const selectedAttempt = attempts[0] ?? null;
                const draft = draftsByRowKey[rowKey(row)] ?? { score: "", feedback: "" };

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

                    {selectedAttempt ? (
                      <div className="parsons-answer-lines">
                        {[...selectedAttempt.latestState.blocks]
                          .sort((left, right) => left.physicalLineIndex - right.physicalLineIndex)
                          .map((block) => (
                            <pre key={block.id} style={{ marginLeft: `${block.currentIndent * 18}px` }}>
                              {block.displayText}
                            </pre>
                          ))}
                      </div>
                    ) : (
                      <p className="muted">{t("courseDetail.noAnswers")}</p>
                    )}

                    <div className="form">
                      <div className="field">
                        <label htmlFor={`score-${rowKey(row)}`}>{t("courseDetail.overrideGradePrompt", { max: formatGradeNumber(row.maxScore) })}</label>
                        <input
                          id={`score-${rowKey(row)}`}
                          inputMode="decimal"
                          min={0}
                          step="any"
                          type="number"
                          value={draft.score}
                          onChange={(event) => updateDraft(row, { score: event.target.value })}
                        />
                      </div>
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
  return [
    feedback.feedbackText ?? "",
    ...feedback.messages.map((message) =>
      message.type === "order"
        ? t("parsons.orderFeedback", { count: message.count })
        : t("parsons.indentFeedback", { count: message.count })
    )
  ]
    .filter(Boolean)
    .join("\n");
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

function sortAttemptsByDisplayedTimestamp(attempts: ParsonsGradebookAttempt[]) {
  return [...attempts].sort((left, right) => attemptDisplayTime(right) - attemptDisplayTime(left));
}

function attemptDisplayTime(attempt: ParsonsGradebookAttempt) {
  return new Date(attempt.completedAt ?? attempt.lastInteractionAt).getTime();
}
