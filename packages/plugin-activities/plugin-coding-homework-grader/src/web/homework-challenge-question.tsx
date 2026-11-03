"use client";
import { MarkdownRenderer } from "@cognelo/activity-ui";
import type { CodingHomeworkStudentChallengeQuestionRecord } from "./client";
import type { CodingHomeworkLocale } from "./messages";
import { QuestionCodeContext } from "./question-code-context";
import { homeworkWorkflowCopy } from "./workflow-copy";

export function HomeworkChallengeQuestion({ question, number, total, locale, value, disabled, maxLength, onChange, onBlur }: {
  question: CodingHomeworkStudentChallengeQuestionRecord;
  number: number; total: number; locale: CodingHomeworkLocale;
  value: string; disabled: boolean; maxLength?: number;
  onChange: (value: string) => void; onBlur?: () => void;
}) {
  const copy = homeworkWorkflowCopy(locale);
  const titleId = `question-title-${question.id}`, promptId = `question-prompt-${question.id}`;
  const answerId = `answer-${question.id}`, labelId = `answer-label-${question.id}`;
  const hasContext = Boolean(question.context?.code);
  return <section className="homework-challenge-question" aria-labelledby={titleId}>
    <header className="homework-challenge-heading">
      <h4 id={titleId}>{copy.questionNumber.replace("{number}", String(number)).replace("{total}", String(total))}</h4>
      <div id={promptId}><MarkdownRenderer markdown={question.questionText} /></div>
    </header>
    <div className={`homework-challenge-body${hasContext ? " has-context" : ""}`}>
      <QuestionCodeContext context={question.context} locale={locale} />
      <div className="homework-challenge-answer">
        <label id={labelId} htmlFor={answerId}>{copy.yourAnswer}</label>
        <textarea id={answerId} aria-labelledby={`${labelId} ${titleId}`} aria-describedby={promptId}
          rows={7} maxLength={maxLength} disabled={disabled} value={value}
          onChange={event => onChange(event.target.value)} onBlur={onBlur} />
      </div>
    </div>
  </section>;
}
