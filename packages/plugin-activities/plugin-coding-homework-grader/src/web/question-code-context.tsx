"use client";
import { CodeRenderer } from "@cognelo/activity-ui";
import type { StudentQuestionContext } from "../question-context";
import type { CodingHomeworkLocale } from "./messages";
import { homeworkWorkflowCopy } from "./workflow-copy";

export function QuestionCodeContext({ context, locale, label }: { context?: StudentQuestionContext; locale: CodingHomeworkLocale; label?: string }) {
  if (!context?.code) return null;
  const copy = homeworkWorkflowCopy(locale);
  return <section className="homework-question-context" aria-label={label ?? copy.questionContext}>
    <div className="homework-question-context-heading">
      <strong>{label ?? copy.questionContext}</strong>
      {(context.filePath || context.functionName) && <div className="homework-question-context-source">
        {context.filePath && <code>{context.filePath}</code>}
        {context.functionName && <code>{context.functionName}</code>}
      </div>}
    </div>
    <div className="homework-question-context-code" tabIndex={0}><CodeRenderer code={context.code} language={context.languageKey} showLineNumbers /></div>
    {context.truncated && <p className="muted">{copy.contextTruncated}</p>}
  </section>;
}
