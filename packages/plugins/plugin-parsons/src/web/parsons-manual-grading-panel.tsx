"use client";

import { type FormEvent, useEffect, useState } from "react";
import type { ParsonsAttemptState } from "../attempt-types";

type ParsonsGradebookAttemptLike = {
  id: string;
  status: "in_progress" | "completed" | "abandoned";
  completedAt: string | null;
  lastInteractionAt: string;
  latestState: ParsonsAttemptState;
  events: Array<{
    id: string;
    type: string;
    createdAt: string;
  }>;
};

type ParsonsManualGradingRow = {
  participantName: string;
  participantEmail: string;
  score: number | null;
  maxScore: number;
  submittedAttemptCount: number;
  feedback?: {
    kind?: string;
    feedbackText?: string | null;
    details?: Record<string, unknown>;
  } | null;
};

export type ParsonsManualGradingPanelProps = {
  row: ParsonsManualGradingRow;
  attempts: ParsonsGradebookAttemptLike[];
  selectedAttempt: ParsonsGradebookAttemptLike | null;
  selectedIndex: number;
  includeAttempts: boolean;
  loading: boolean;
  error: string;
  isSavingOverride: boolean;
  isSavingRegrade: boolean;
  isSavingDelete: boolean;
  onClose: () => void;
  onIncludeAttemptsChange: (includeAttempts: boolean) => void;
  onSelectAttemptIndex: (index: number) => void;
  onOverrideGrade: (input: { score: number; maxScore: number; reason: string | null; feedbackText?: string | null }) => Promise<void>;
  onRegradeAttempt: () => Promise<void>;
  onDeleteSubmission: () => Promise<void>;
  t: (key: string, params?: Record<string, string | number>) => string;
};

export function ParsonsManualGradingPanel({
  row,
  attempts,
  selectedAttempt,
  selectedIndex,
  includeAttempts,
  loading,
  error,
  isSavingOverride,
  isSavingRegrade,
  isSavingDelete,
  onClose,
  onIncludeAttemptsChange,
  onSelectAttemptIndex,
  onOverrideGrade,
  onRegradeAttempt,
  onDeleteSubmission,
  t
}: ParsonsManualGradingPanelProps) {
  const [score, setScore] = useState(row.score === null ? "" : formatGradeNumber(row.score));
  const [reason, setReason] = useState("");
  const [formError, setFormError] = useState("");

  useEffect(() => {
    setScore(row.score === null ? "" : formatGradeNumber(row.score));
    setReason(feedbackFromGrade(row, t) || feedbackFromEvaluation(selectedAttempt?.latestState.lastEvaluation ?? null, t));
    setFormError("");
  }, [row.feedback, row.participantEmail, row.participantName, row.score, selectedAttempt?.id, t]);

  async function submitOverride(event: FormEvent) {
    event.preventDefault();
    const parsedScore = Number(score);
    if (!Number.isFinite(parsedScore)) {
      setFormError(t("courseDetail.overrideGradeInvalid"));
      return;
    }
    setFormError("");
    await onOverrideGrade({
      score: parsedScore,
      maxScore: row.maxScore,
      reason: reason.trim() || null,
      feedbackText: reason.trim() || null
    });
  }

  return (
    <section className="dialog-panel answer-overlay" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
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

      <label className="checkbox-row">
        <input checked={includeAttempts} type="checkbox" onChange={(event) => onIncludeAttemptsChange(event.target.checked)} />
        {t("courseDetail.includeAttempts")}
      </label>

      {error ? <p className="error">{error}</p> : null}
      {loading ? <p className="muted">{t("common.loading")}</p> : null}

      {!loading && selectedAttempt ? (
        <div className="stack">
          <div className="row">
            <button
              className="button secondary"
              disabled={selectedIndex === 0}
              type="button"
              onClick={() => onSelectAttemptIndex(selectedIndex - 1)}
            >
              {t("courseDetail.previousSubmission")}
            </button>
            <span className="muted">
              {t("courseDetail.submissionPosition", {
                current: selectedIndex + 1,
                total: attempts.length
              })}
            </span>
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
            <strong>{attemptLabel(selectedAttempt, t)}</strong>
            <span className="muted">{formatDateTime(selectedAttempt.completedAt ?? selectedAttempt.lastInteractionAt)}</span>
          </div>

          <div className="parsons-answer-lines">
            {selectedAttempt.latestState.blocks.map((block) => (
              <pre key={block.id} style={{ marginLeft: `${block.currentIndent * 18}px` }}>
                {block.displayText}
              </pre>
            ))}
          </div>

          {includeAttempts && selectedAttempt.events.length ? (
            <div className="stack">
              <h3>{t("courseDetail.attemptEventsTitle")}</h3>
              <div className="table-list">
                {selectedAttempt.events.map((event) => (
                  <div className="table-row table-row-simple" key={event.id}>
                    <strong>{event.type}</strong>
                    <span className="table-meta muted">{formatDateTime(event.createdAt)}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {!loading && !selectedAttempt ? <p className="muted">{t("courseDetail.noAnswers")}</p> : null}

      <form className="form inline-panel" onSubmit={submitOverride}>
        <div className="section-heading">
          <div>
            <p className="eyebrow">{t("courseDetail.overrideGrade")}</p>
            <h3>{formatGradebookScore(row.score, row.maxScore)}</h3>
          </div>
          <button className="button secondary" disabled={isSavingRegrade || !selectedAttempt} type="button" onClick={() => void onRegradeAttempt()}>
            {isSavingRegrade ? t("common.saving") : t("courseDetail.regrade")}
          </button>
          <button className="button secondary" disabled={isSavingDelete || !selectedAttempt} type="button" onClick={() => void onDeleteSubmission()}>
            {isSavingDelete ? t("common.saving") : t("courseDetail.deleteSubmission")}
          </button>
        </div>
        <div className="field">
          <label htmlFor="parsons-manual-score">{t("courseDetail.overrideGradePrompt", { max: formatGradeNumber(row.maxScore) })}</label>
          <input
            id="parsons-manual-score"
            inputMode="decimal"
            min={0}
            step="any"
            type="number"
            value={score}
            onChange={(event) => setScore(event.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="parsons-manual-reason">{t("courseDetail.overrideReasonPrompt")}</label>
          <textarea id="parsons-manual-reason" value={reason} onChange={(event) => setReason(event.target.value)} />
        </div>
        {formError ? <p className="error">{formError}</p> : null}
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
  if (score === null) {
    return "-";
  }
  return `${formatGradeNumber(score)} / ${formatGradeNumber(maxScore)}`;
}

function formatGradeNumber(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: false,
    hourCycle: "h23"
  }).format(new Date(value));
}

function attemptLabel(attempt: ParsonsGradebookAttemptLike, t: ParsonsManualGradingPanelProps["t"]) {
  const key = attempt.status === "completed" ? "courseDetail.submissionAnswerLabel" : "courseDetail.attemptAnswerLabel";
  return t(key, { id: attempt.id.slice(-6) });
}

function feedbackFromGrade(row: ParsonsManualGradingRow, t: ParsonsManualGradingPanelProps["t"]) {
  const feedback = row.feedback;
  if (!feedback) {
    return "";
  }
  return [
    feedback.feedbackText ?? "",
    ...getParsonsFeedbackMessages(feedback).map((message) =>
      message.type === "order" ? t("parsons.orderFeedback", { count: message.count }) : t("parsons.indentFeedback", { count: message.count })
    )
  ]
    .filter(Boolean)
    .join("\n");
}

function getParsonsFeedbackMessages(feedback: NonNullable<ParsonsManualGradingRow["feedback"]>) {
  const details = feedback.kind === "parsons" && feedback.details && typeof feedback.details === "object" ? feedback.details : {};
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

function feedbackFromEvaluation(
  evaluation: ParsonsAttemptState["lastEvaluation"] | null | undefined,
  t: ParsonsManualGradingPanelProps["t"]
) {
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
