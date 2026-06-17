"use client";

import { type FormEvent, useEffect, useMemo, useState } from "react";
import type { CodingHomeworkGradebookAttemptRecord } from "./client";

type CodingHomeworkManualGradingRow = {
  participantName: string;
  participantEmail: string;
  score: number | null;
  maxScore: number;
  feedback?: {
    feedbackText?: string | null;
  } | null;
};

export type CodingHomeworkManualGradingPanelProps = {
  row: CodingHomeworkManualGradingRow;
  attempts: CodingHomeworkGradebookAttemptRecord[];
  selectedAttempt: CodingHomeworkGradebookAttemptRecord | null;
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

export function CodingHomeworkManualGradingPanel({
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
}: CodingHomeworkManualGradingPanelProps) {
  const [score, setScore] = useState(row.score === null ? "" : formatGradeNumber(row.score));
  const [feedback, setFeedback] = useState("");
  const [formError, setFormError] = useState("");
  const functionsById = useMemo(
    () => new Map((selectedAttempt?.functions ?? []).map((fn) => [fn.id, fn])),
    [selectedAttempt]
  );

  useEffect(() => {
    setScore(row.score === null ? "" : formatGradeNumber(row.score));
    setFeedback(row.feedback?.feedbackText ?? selectedAttempt?.reviews[0]?.feedback ?? "");
    setFormError("");
  }, [row.feedback, row.participantEmail, row.score, selectedAttempt?.id]);

  async function submitOverride(event: FormEvent) {
    event.preventDefault();
    const parsedScore = Number(score);
    if (!Number.isFinite(parsedScore) || parsedScore < 0 || parsedScore > row.maxScore) {
      setFormError(t("courseDetail.overrideGradeRangeError", { max: formatGradeNumber(row.maxScore) }));
      return;
    }
    setFormError("");
    await onOverrideGrade({
      score: parsedScore,
      maxScore: row.maxScore,
      reason: feedback.trim() || null,
      feedbackText: feedback.trim() || null
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
            <strong>{attemptLabel(selectedAttempt, t)}</strong>
            <span className="muted">{selectedAttempt.submittedAt ? formatDateTime(selectedAttempt.submittedAt) : ""}</span>
          </div>

          <div className="table-list">
            {selectedAttempt.files.map((file) => (
              <div className="table-row table-row-simple" key={file.id}>
                <strong>{file.path}</strong>
                <span className="table-meta muted">{formatBytes(file.sizeBytes)}</span>
              </div>
            ))}
          </div>

          <div className="stack">
            {selectedAttempt.questions.map((question) => {
              const sourceFunction = question.submissionFunctionId ? functionsById.get(question.submissionFunctionId) ?? null : null;
              return (
                <article className="inline-panel stack" key={question.id}>
                  <div className="answer-meta">
                    <p className="eyebrow" style={{ margin: 0 }}>
                      Question {question.orderIndex + 1}
                    </p>
                    <span className="muted">{question.generationModel}</span>
                  </div>
                  <div className="stack" style={{ gap: 10 }}>
                    <strong>{question.questionText}</strong>
                    <div>
                      <p className="eyebrow">Student answer</p>
                      <p style={{ whiteSpace: "pre-wrap" }}>{question.studentAnswer || "-"}</p>
                    </div>
                    {sourceFunction ? (
                      <div>
                        <p className="eyebrow">
                          {sourceFunction.functionName} · {sourceFunction.filePath}
                        </p>
                        <pre className="code-block" style={{ maxHeight: 320, overflow: "auto" }}>
                          {sourceFunction.functionCode}
                        </pre>
                      </div>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      ) : null}

      {!loading && !selectedAttempt ? <p className="muted">{t("courseDetail.noAnswers")}</p> : null}

      <form className="form inline-panel" onSubmit={submitOverride}>
        <div className="section-heading">
          <div>
            <p className="eyebrow">{t("courseDetail.overrideGrade")}</p>
            <h3>{formatGradebookScore(row.score, row.maxScore)}</h3>
          </div>
          <button className="button secondary" disabled type="button" onClick={() => void onRegradeAttempt()}>
            {isSavingRegrade ? t("common.saving") : t("courseDetail.regrade")}
          </button>
          <button className="button secondary" disabled={isSavingDelete || !selectedAttempt} type="button" onClick={() => void onDeleteSubmission()}>
            {isSavingDelete ? t("common.saving") : t("courseDetail.deleteSubmission")}
          </button>
        </div>
        <div className="field">
          <label htmlFor="coding-homework-manual-score">{t("courseDetail.overrideGradePrompt", { max: formatGradeNumber(row.maxScore) })}</label>
          <input
            id="coding-homework-manual-score"
            inputMode="decimal"
            max={row.maxScore}
            min={0}
            step="any"
            type="number"
            value={score}
            onChange={(event) => setScore(event.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="coding-homework-manual-feedback">{t("courseDetail.overrideReasonPrompt")}</label>
          <textarea id="coding-homework-manual-feedback" value={feedback} onChange={(event) => setFeedback(event.target.value)} />
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

function attemptLabel(
  attempt: CodingHomeworkGradebookAttemptRecord,
  t: CodingHomeworkManualGradingPanelProps["t"]
) {
  return t("courseDetail.submissionAnswerLabel", { id: String(attempt.attemptNumber ?? attempt.id.slice(-6)) });
}

function formatGradebookScore(score: number | null, maxScore: number) {
  return score === null ? "-" : `${formatGradeNumber(score)} / ${formatGradeNumber(maxScore)}`;
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
    minute: "2-digit"
  }).format(new Date(value));
}

function formatBytes(value: number) {
  if (value < 1024) {
    return `${value} B`;
  }
  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KB`;
  }
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}
