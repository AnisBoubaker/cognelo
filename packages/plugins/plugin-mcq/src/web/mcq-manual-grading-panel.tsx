"use client";

import { type FormEvent, useEffect, useMemo, useState } from "react";
import { useNotifications } from "@cognelo/activity-ui";
import { parseMcqSource, scoreSelectedChoices } from "../mcq";
import { getMcqManualGradingCopy, type McqLocale } from "../messages";
import { MarkdownBlocksView } from "./markdown-blocks-view";

type McqManualGradingRow = {
  participantName: string;
  participantEmail: string;
  score: number | null;
  maxScore: number;
};

export type McqManualGradingAttempt = {
  id: string;
  attemptNumber: number;
  submittedAt: string | null;
  gradedAt: string | null;
  answers: Record<string, string[]>;
};

export type McqManualGradingPanelProps = {
  row: McqManualGradingRow;
  activityConfig?: Record<string, unknown>;
  attempts: McqManualGradingAttempt[];
  selectedAttempt: McqManualGradingAttempt | null;
  selectedIndex: number;
  loading: boolean;
  error: string;
  isSavingOverride: boolean;
  isSavingRegrade: boolean;
  isSavingDelete: boolean;
  locale?: McqLocale;
  onClose: () => void;
  onSelectAttemptIndex: (index: number) => void;
  onOverrideGrade: (input: { score: number; maxScore: number; reason: string | null; feedbackText?: string | null }) => Promise<void>;
  onRegradeAttempt: () => Promise<void>;
  onDeleteSubmission: () => Promise<void>;
  t: (key: string, params?: Record<string, string | number>) => string;
};

export function McqManualGradingPanel({
  row,
  activityConfig,
  attempts,
  selectedAttempt,
  selectedIndex,
  loading,
  error,
  isSavingOverride,
  isSavingRegrade,
  isSavingDelete,
  locale = "en",
  onClose,
  onSelectAttemptIndex,
  onOverrideGrade,
  onRegradeAttempt,
  onDeleteSubmission,
  t
}: McqManualGradingPanelProps) {
  const notifications = useNotifications();
  const [questionScores, setQuestionScores] = useState<Record<string, string>>({});
  const [reason, setReason] = useState("");
  const answers = useMemo(() => buildReviewAnswers(activityConfig, selectedAttempt, row.maxScore), [activityConfig, row.maxScore, selectedAttempt]);
  const totalScore = useMemo(() => sumQuestionScores(questionScores), [questionScores]);
  const copy = getMcqManualGradingCopy(locale);

  useEffect(() => {
    setQuestionScores(Object.fromEntries(answers.map((answer) => [answer.questionId, formatGradeNumber(answer.awardedScore)])));
    setReason("");
  }, [answers, row.participantEmail]);

  async function submitOverride(event: FormEvent) {
    event.preventDefault();
    const normalizedScores = answers.map((answer) => ({
      ...answer,
      awardedScore: Number(questionScores[answer.questionId] ?? "")
    }));
    const invalidScore = normalizedScores.find(
      (answer) => !Number.isFinite(answer.awardedScore) || answer.awardedScore > answer.maxScore
    );
    if (invalidScore) {
      notifications.error(copy.invalidQuestionScore);
      return;
    }
    const numericScore = roundGrade(normalizedScores.reduce((sum, answer) => sum + answer.awardedScore, 0));
    if (!Number.isFinite(numericScore) || numericScore > row.maxScore) {
      notifications.error(t("courseDetail.overrideGradeRangeError", { max: formatGradeNumber(row.maxScore) }));
      return;
    }
    await onOverrideGrade({
      score: numericScore,
      maxScore: row.maxScore,
      reason: reason.trim() || null,
      feedbackText: reason.trim() || null
    });
  }

  return (
    <section className="dialog-panel answer-overlay" role="dialog" aria-modal="true">
      <div className="section-heading">
        <div>
          <p className="eyebrow">{row.participantName}</p>
          <h2>{t("courseDetail.studentAnswerTitle")}</h2>
          <p className="muted">{row.participantEmail}</p>
        </div>
        <button className="button secondary" type="button" onClick={onClose}>
          {t("common.close")}
        </button>
      </div>

      {error ? <p className="error">{error}</p> : null}
      {loading ? <p className="muted">{t("common.loading")}</p> : null}

      {!loading && selectedAttempt ? (
        <div className="stack">
          <div className="row">
            <button className="button secondary" disabled={selectedIndex === 0} type="button" onClick={() => onSelectAttemptIndex(selectedIndex - 1)}>
              {t("courseDetail.previousSubmission")}
            </button>
            <span className="muted">{t("courseDetail.submissionPosition", { current: selectedIndex + 1, total: attempts.length })}</span>
            <button
              className="button secondary"
              disabled={selectedIndex >= attempts.length - 1}
              type="button"
              onClick={() => onSelectAttemptIndex(selectedIndex + 1)}
            >
              {t("courseDetail.nextSubmission")}
            </button>
          </div>
          <div className="answer-meta">
            <strong>{t("courseDetail.submissionAnswerLabel", { id: String(selectedAttempt.attemptNumber) })}</strong>
            <span className="muted">{selectedAttempt.submittedAt ? formatDateTime(selectedAttempt.submittedAt, locale) : ""}</span>
          </div>
          <div className="stack">
            {answers.map((answer, index) => (
              <article
                className="stack"
                key={answer.questionId}
                style={{ border: "1px solid rgba(13, 27, 71, 0.12)", borderRadius: 10, gap: 14, padding: 16 }}
              >
                <div className="stack" style={{ gap: 8 }}>
                  <div className="answer-meta">
                    <p className="eyebrow" style={{ margin: 0 }}>{formatMessage(copy.question, { number: index + 1 })}</p>
                    {answer.question ? <CorrectnessIcon correct={answer.isCorrect} copy={copy} /> : null}
                  </div>
                  {answer.question ? (
                    <MarkdownBlocksView blocks={answer.question.promptBlocks} />
                  ) : (
                    <strong>{answer.questionId}</strong>
                  )}
                </div>
                <div className="stack" style={{ gap: 10 }}>
                  <p className="eyebrow">{copy.studentAnswer}</p>
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
                          <CorrectnessIcon correct={choice.isCorrectChoice} copy={copy} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <MarkdownBlocksView blocks={choice.choice.blocks} compact />
                          </div>
                        </div>
                      ) : (
                        <p className="muted" key={choice.choiceId}>
                          {choice.choiceId}
                        </p>
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
                        <MissedAnswerIcon copy={copy} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <MarkdownBlocksView blocks={choice.choice.blocks} compact />
                        </div>
                      </div>
                    ) : null
                  )}
                  <div className="field" style={{ maxWidth: 220 }}>
                    <label htmlFor={`mcq-question-score-${answer.questionId}`}>
                      {formatMessage(copy.points, {
                        score: formatGradeNumber(Number(questionScores[answer.questionId] ?? answer.awardedScore)),
                        max: formatGradeNumber(answer.maxScore)
                      })}
                    </label>
                    <input
                      id={`mcq-question-score-${answer.questionId}`}
                      inputMode="decimal"
                      max={answer.maxScore}
                      step="any"
                      type="number"
                      value={questionScores[answer.questionId] ?? ""}
                      onChange={(event) =>
                        setQuestionScores((current) => ({
                          ...current,
                          [answer.questionId]: clampQuestionScoreInput(event.target.value, answer.maxScore)
                        }))
                      }
                    />
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      ) : null}

      {!loading && !selectedAttempt ? <p className="muted">{t("courseDetail.noAnswers")}</p> : null}

      <form className="form inline-panel" onSubmit={submitOverride}>
        <div className="section-heading">
          <div>
            <p className="eyebrow">{t("courseDetail.overrideGrade")}</p>
            <h3>{formatGradebookScore(totalScore, row.maxScore)}</h3>
          </div>
          <button className="button secondary" disabled={isSavingRegrade || !selectedAttempt} type="button" onClick={() => void onRegradeAttempt()}>
            {isSavingRegrade ? t("common.saving") : t("courseDetail.regrade")}
          </button>
          <button className="button secondary" disabled={isSavingDelete || !selectedAttempt} type="button" onClick={() => void onDeleteSubmission()}>
            {isSavingDelete ? t("common.saving") : t("courseDetail.deleteSubmission")}
          </button>
        </div>
        <div className="field">
          <label htmlFor="mcq-manual-reason">{t("courseDetail.overrideReasonPrompt")}</label>
          <textarea id="mcq-manual-reason" value={reason} onChange={(event) => setReason(event.target.value)} />
        </div>
        <div className="dialog-actions">
          <button className="button secondary" type="button" onClick={onClose}>
            {t("common.cancel")}
          </button>
          <button disabled={isSavingOverride} type="submit">
            {isSavingOverride ? t("common.saving") : t("common.save")}
          </button>
        </div>
      </form>
    </section>
  );
}

function formatGradebookScore(score: number | null, maxScore: number) {
  return score === null ? "-" : `${formatGradeNumber(score)} / ${formatGradeNumber(maxScore)}`;
}

function formatGradeNumber(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function formatDateTime(value: string, locale: McqLocale) {
  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(value));
}

function buildReviewAnswers(activityConfig: Record<string, unknown> | undefined, selectedAttempt: McqManualGradingAttempt | null, maxScore: number) {
  if (!selectedAttempt) {
    return [];
  }

  const source = typeof activityConfig?.source === "string" ? activityConfig.source : "";
  const defaultCodeLanguage = typeof activityConfig?.defaultCodeLanguage === "string" ? activityConfig.defaultCodeLanguage : "python";
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
      selectedChoiceIds.every((choiceId, index) => choiceId === correctChoiceIds[index]);
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

function normalizeChoiceIds(choiceIds: string[]) {
  return [...new Set(choiceIds.filter((choiceId) => typeof choiceId === "string"))].sort();
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
