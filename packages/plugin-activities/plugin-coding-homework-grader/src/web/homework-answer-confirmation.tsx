"use client";
import { ConfirmationDialog } from "@cognelo/activity-ui";
import type { CodingHomeworkLocale } from "./messages";
import { homeworkWorkflowCopy } from "./workflow-copy";

export function HomeworkAnswerConfirmation({ open, questions, answers, locale, onCancel, onConfirm }: {
  open: boolean; questions: Array<{ id: string }>; answers: Record<string, string>; locale: CodingHomeworkLocale;
  onCancel: () => void; onConfirm: () => void;
}) {
  const copy = homeworkWorkflowCopy(locale);
  const unanswered = questions.flatMap((question, index) => (answers[question.id] ?? "").trim() ? [] : [index + 1]);
  return <ConfirmationDialog open={open} title={copy.confirmAnswersTitle} confirmLabel={copy.submitAnswers}
    cancelLabel={copy.cancel} confirmIcon="submit" onCancel={onCancel} onConfirm={onConfirm}
    message={<div className="stack">
      <p>{copy.confirmAnswersDetail}</p>
      {unanswered.length > 0 && <div>
        <p><strong>{copy.unansweredQuestions}</strong></p>
        <ul>{unanswered.map(number => <li key={number}>{copy.questionLabel.replace("{number}", String(number))}</li>)}</ul>
      </div>}
    </div>} />;
}
