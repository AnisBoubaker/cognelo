"use client";

import { parseMcqSource } from "../mcq";
import { MarkdownBlocksView } from "./markdown-blocks-view";

export type McqAiFeedbackReviewProps = {
  feedback: Record<string, unknown>;
  submission: Record<string, unknown>;
  onFeedbackChange: (feedback: Record<string, unknown>) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
};

export function McqAiFeedbackReview({ feedback, submission, onFeedbackChange, t }: McqAiFeedbackReviewProps) {
  const parsed = parseMcqSource(stringValue(submission.source), stringValue(submission.defaultCodeLanguage) || "none");
  const answers = recordValue(submission.answers);
  const questionFeedback = recordArray(feedback.questionFeedback);
  const feedbackByQuestionId = new Map(questionFeedback.map((entry, index) => [stringValue(entry.questionId), { entry, index }]));

  return (
    <div className="stack">
      <section className="inline-panel stack stack-tight">
        <h3>{t("courseDetail.feedbackReviewSubmission")}</h3>
        {parsed.questions.map((question, questionIndex) => {
          const selected = Array.isArray(answers[question.id]) ? (answers[question.id] as unknown[]).filter((value): value is string => typeof value === "string") : [];
          return (
            <article className="stack stack-tight" key={question.id}>
              <strong>{t("courseDetail.feedbackReviewQuestion", { number: questionIndex + 1 })}: {question.title}</strong>
              <MarkdownBlocksView blocks={question.promptBlocks} />
              {selected.length ? question.choices.filter((choice) => selected.includes(choice.id)).map((choice) => (
                <div className="inline-panel stack stack-tight" key={choice.id}>
                  <span className="muted">{t("courseDetail.feedbackReviewSelected")}</span>
                  <MarkdownBlocksView blocks={choice.blocks} />
                </div>
              )) : <p className="muted">{t("courseDetail.feedbackReviewNoSelection")}</p>}
            </article>
          );
        })}
      </section>
      <label className="field">
        <span>{t("courseDetail.feedbackReviewSummary")}</span>
        <textarea maxLength={3000} rows={5} value={stringValue(feedback.summary)} onChange={(event) => onFeedbackChange({ ...feedback, summary: event.target.value })} />
      </label>
      {parsed.questions.map((question, questionIndex) => {
        const matched = feedbackByQuestionId.get(question.id);
        if (!matched) return null;
        return (
          <label className="field inline-panel" key={question.id}>
            <span>{t("courseDetail.feedbackReviewQuestion", { number: questionIndex + 1 })}: {question.title}</span>
            <textarea
              maxLength={2000}
              rows={4}
              value={stringValue(matched.entry.explanation)}
              onChange={(event) => onFeedbackChange({
                ...feedback,
                questionFeedback: questionFeedback.map((entry, index) => index === matched.index ? { ...entry, explanation: event.target.value } : entry)
              })}
            />
          </label>
        );
      })}
    </div>
  );
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value : "";
}

function recordValue(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function recordArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object" && !Array.isArray(item)))
    : [];
}
