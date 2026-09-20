"use client";

import { CodeRenderer } from "@cognelo/activity-ui";

export type CodingExerciseAiFeedbackReviewProps = {
  feedback: Record<string, unknown>;
  submission: Record<string, unknown>;
  onFeedbackChange: (feedback: Record<string, unknown>) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
};

export function CodingExerciseAiFeedbackReview({ feedback, submission, onFeedbackChange, t }: CodingExerciseAiFeedbackReviewProps) {
  const sourceCode = typeof submission.sourceCode === "string" ? submission.sourceCode : "";
  const language = typeof submission.language === "string" ? submission.language : "text";
  const strengths = stringArray(feedback.strengths).join("\n\n");
  const improvements = stringArray(feedback.improvements).join("\n\n");
  const criteria = recordArray(feedback.criteria);

  return (
    <div className="stack">
      <section className="inline-panel stack stack-tight">
        <h3>{t("courseDetail.feedbackReviewSubmission")}</h3>
        {sourceCode ? <CodeRenderer code={sourceCode} language={language} showLineNumbers /> : <p className="muted">{t("courseDetail.answerUnavailable")}</p>}
      </section>
      <label className="field">
        <span>{t("courseDetail.feedbackReviewSummary")}</span>
        <textarea maxLength={3000} rows={5} value={stringValue(feedback.summary)} onChange={(event) => onFeedbackChange({ ...feedback, summary: event.target.value })} />
      </label>
      <label className="field">
        <span>{t("courseDetail.feedbackReviewStrengths")}</span>
        <textarea maxLength={10000} rows={5} value={strengths} onChange={(event) => onFeedbackChange({ ...feedback, strengths: [event.target.value] })} />
      </label>
      <label className="field">
        <span>{t("courseDetail.feedbackReviewImprovements")}</span>
        <textarea maxLength={10000} rows={5} value={improvements} onChange={(event) => onFeedbackChange({ ...feedback, improvements: [event.target.value] })} />
      </label>
      {criteria.length ? <section className="stack stack-tight">
        <h3>{t("courseDetail.feedbackReviewCriteria")}</h3>
        {criteria.map((criterion, index) => (
          <section className="stack stack-tight inline-panel" key={stringValue(criterion.id) || index}>
            <strong>{stringValue(criterion.title)}</strong>
            <label className="field">
              <span>{t("courseDetail.feedbackReviewCriterionScore")}</span>
              <input
                max={100}
                min={0}
                step="0.01"
                type="number"
                value={typeof criterion.scorePercent === "number" || typeof criterion.scorePercent === "string" ? criterion.scorePercent : ""}
                onChange={(event) => onFeedbackChange({
                  ...feedback,
                  criteria: criteria.map((entry, itemIndex) => itemIndex === index ? {
                    ...entry,
                    scorePercent: event.target.value === "" ? "" : Number(event.target.value)
                  } : entry)
                })}
              />
            </label>
            <label className="field">
              <span>{t("courseDetail.feedbackReviewCriterionFeedback")}</span>
              <textarea
                maxLength={2000}
                rows={4}
                value={stringValue(criterion.feedback)}
                onChange={(event) => onFeedbackChange({
                  ...feedback,
                  criteria: criteria.map((entry, itemIndex) => itemIndex === index ? { ...entry, feedback: event.target.value } : entry)
                })}
              />
            </label>
          </section>
        ))}
      </section> : null}
    </div>
  );
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value : "";
}

function stringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function recordArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object" && !Array.isArray(item)))
    : [];
}
