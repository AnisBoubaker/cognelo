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
  const resultSummary = recordValue(submission.resultSummary);
  const tests = recordArray(resultSummary.tests);
  const passedCount = tests.filter((test) => test.passed === true).length;
  const strengths = stringArray(feedback.strengths).join("\n\n");
  const improvements = stringArray(feedback.improvements).join("\n\n");
  const criteria = recordArray(feedback.criteria);

  return (
    <div className="stack">
      <section className="inline-panel stack stack-tight">
        <h3>{t("courseDetail.feedbackReviewSubmission")}</h3>
        {sourceCode ? <CodeRenderer code={sourceCode} language={language} showLineNumbers /> : <p className="muted">{t("courseDetail.answerUnavailable")}</p>}
        {tests.length ? (
          <section className="stack stack-tight">
            <div className="row" style={{ alignItems: "baseline", justifyContent: "space-between" }}>
              <h4 style={{ margin: 0 }}>{t("courseDetail.feedbackReviewTestResults")}</h4>
              <span className="muted">{t("courseDetail.feedbackReviewTestScore", { passed: passedCount, total: tests.length })}</span>
            </div>
            {tests.map((test, index) => {
              const passed = typeof test.passed === "boolean" ? test.passed : null;
              const outcomeLabel = passed === null
                ? stringValue(test.statusLabel)
                : t(passed ? "courseDetail.feedbackReviewTestPassed" : "courseDetail.feedbackReviewTestFailed");
              const detail = firstNonEmptyString(test.message, passed === false ? test.statusLabel : null);
              return (
                <div className="stack stack-tight" key={stringValue(test.id) || `${stringValue(test.name)}-${index}`}>
                  <div className="row" style={{ alignItems: "center", gap: 12, justifyContent: "space-between" }}>
                    <span>{stringValue(test.name) || t("courseDetail.feedbackReviewTest", { number: index + 1 })}</span>
                    {passed === null ? (
                      outcomeLabel ? <span className="muted">{outcomeLabel}</span> : null
                    ) : (
                      <span
                        aria-label={outcomeLabel}
                        role="img"
                        style={{ color: passed ? "#157347" : "#b42318", fontSize: 20, fontWeight: 700, lineHeight: 1 }}
                        title={outcomeLabel}
                      >
                        {passed ? "✓" : "✕"}
                      </span>
                    )}
                  </div>
                  {detail ? <p className="muted" style={{ margin: 0, overflowWrap: "anywhere", whiteSpace: "pre-wrap" }}>{detail}</p> : null}
                </div>
              );
            })}
          </section>
        ) : null}
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

function firstNonEmptyString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value;
  }
  return "";
}

function recordValue(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function stringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function recordArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object" && !Array.isArray(item)))
    : [];
}
