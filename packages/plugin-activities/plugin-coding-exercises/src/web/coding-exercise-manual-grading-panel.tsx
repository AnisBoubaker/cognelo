"use client";

import { ActionIcon, useApplicationTime, formatZonedDateTime } from "@cognelo/activity-ui";

import { CodingExerciseAiFeedbackReview } from "./coding-exercise-ai-feedback-review";

type CodingExerciseReviewAttempt = {
  id: string;
  createdAt: string;
  languageKey: string;
  sourceCode: string;
  resultSummary: Record<string, unknown>;
  aiFeedback?: { feedback?: Record<string, unknown> } | null;
};

type CodingExerciseReviewRow = {
  groupTitle: string;
  participantName: string;
  participantEmail: string;
};

export type CodingExerciseManualGradingPanelProps = {
  row: CodingExerciseReviewRow;
  attempts: CodingExerciseReviewAttempt[];
  attemptCount: number;
  selectedAttempt: CodingExerciseReviewAttempt | null;
  selectedIndex: number;
  loading: boolean;
  error: string;
  onClose: () => void;
  onSelectAttemptIndex: (index: number) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
};

export function CodingExerciseManualGradingPanel({
  row,
  attemptCount,
  selectedAttempt,
  selectedIndex,
  loading,
  error,
  onClose,
  onSelectAttemptIndex,
  t
}: CodingExerciseManualGradingPanelProps) {
  const { timeZone } = useApplicationTime();
  const feedback = selectedAttempt?.aiFeedback?.feedback ?? null;
  return (
    <section className="dialog-panel answer-overlay test-review-overlay stack" role="dialog" aria-modal="true">
      <div className="section-heading">
        <div>
          <p className="eyebrow">{row.groupTitle}</p>
          <h2>{t("courseDetail.inspectAttempts")}</h2>
          <p className="muted">{row.participantName} · {row.participantEmail}</p>
        </div>
        <button className="button secondary" type="button" onClick={onClose}><ActionIcon name="close" /> {t("common.close")}</button>
      </div>

      {attemptCount > 1 ? (
        <div className="row">
          <button className="button secondary" disabled={loading || selectedIndex === 0} type="button" onClick={() => onSelectAttemptIndex(selectedIndex - 1)}>
            <ActionIcon name="back" />
            {t("courseDetail.previousSubmission")}
          </button>
          <span className="muted">{t("courseDetail.submissionPosition", { current: selectedIndex + 1, total: attemptCount })}</span>
          <button className="button secondary" disabled={loading || selectedIndex >= attemptCount - 1} type="button" onClick={() => onSelectAttemptIndex(selectedIndex + 1)}>
            <ActionIcon name="next" />
            {t("courseDetail.nextSubmission")}
          </button>
        </div>
      ) : null}

      {error ? <p className="error-text">{error}</p> : null}
      {loading ? <p className="muted">{t("courseDetail.loadingStudentAnswers")}</p> : null}
      {!loading && selectedAttempt ? (
        <div className="stack">
          <div className="answer-meta">
            <strong>{t("courseDetail.submissionAnswerLabel", { id: String(selectedIndex + 1) })}</strong>
            <time className="muted" dateTime={selectedAttempt.createdAt}>{formatZonedDateTime(new Date(selectedAttempt.createdAt), timeZone, undefined, { dateStyle: "medium", timeStyle: "medium" })}</time>
          </div>
          <CodingExerciseAiFeedbackReview
            feedback={feedback ?? {}}
            hideFeedbackWhenEmpty
            onFeedbackChange={() => undefined}
            readOnly
            submission={{
              sourceCode: selectedAttempt.sourceCode,
              language: selectedAttempt.languageKey,
              resultSummary: selectedAttempt.resultSummary
            }}
            t={t}
          />
          {!feedback ? <p className="inline-panel muted">{t("courseDetail.noGeneratedFeedback")}</p> : null}
          <p className="inline-panel muted">{t("courseDetail.attemptReviewReadOnly")}</p>
        </div>
      ) : null}
      {!loading && !selectedAttempt ? <p className="muted">{t("courseDetail.noAnswers")}</p> : null}
    </section>
  );
}
