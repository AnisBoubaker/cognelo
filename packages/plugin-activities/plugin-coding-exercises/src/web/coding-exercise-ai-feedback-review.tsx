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
  const strengths = stringArray(feedback.strengths);
  const improvements = stringArray(feedback.improvements);
  const criteria = recordArray(feedback.criteria);

  function updateList(key: "strengths" | "improvements", index: number, value: string) {
    const items = key === "strengths" ? strengths : improvements;
    onFeedbackChange({ ...feedback, [key]: items.map((item, itemIndex) => itemIndex === index ? value : item) });
  }

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
      {strengths.length ? <section className="stack stack-tight">
        <h3>{t("courseDetail.feedbackReviewStrengths")}</h3>
        {strengths.map((item, index) => (
          <textarea key={index} maxLength={1000} rows={3} value={item} onChange={(event) => updateList("strengths", index, event.target.value)} />
        ))}
      </section> : null}
      {improvements.length ? <section className="stack stack-tight">
        <h3>{t("courseDetail.feedbackReviewImprovements")}</h3>
        {improvements.map((item, index) => (
          <textarea key={index} maxLength={1000} rows={3} value={item} onChange={(event) => updateList("improvements", index, event.target.value)} />
        ))}
      </section> : null}
      {criteria.length ? <section className="stack stack-tight">
        <h3>{t("courseDetail.feedbackReviewCriteria")}</h3>
        {criteria.map((criterion, index) => (
          <label className="field inline-panel" key={stringValue(criterion.id) || index}>
            <span>
              {stringValue(criterion.title)}
              {typeof criterion.scorePercent === "number" ? ` · ${criterion.scorePercent}%` : ""}
            </span>
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
