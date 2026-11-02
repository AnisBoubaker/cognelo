"use client";
import { CodeRenderer } from "@cognelo/activity-ui";
import type { StudentQuestionContext } from "../question-context";
import type { CodingHomeworkLocale } from "./messages";
import { homeworkWorkflowCopy } from "./workflow-copy";

export function QuestionCodeContext({ context, locale }: { context?: StudentQuestionContext; locale: CodingHomeworkLocale }) {
  if (!context?.code) return null;
  const copy = homeworkWorkflowCopy(locale);
  return <section className="stack homework-question-context" aria-label={copy.questionContext} style={{ minWidth: 0 }}>
    <div><strong>{copy.questionContext}</strong>{context.filePath && <> · <code>{context.filePath}</code></>}{context.functionName && <> · <code>{context.functionName}</code></>}</div>
    <div style={{ maxHeight: "28rem", overflow: "auto", maxWidth: "100%" }}><CodeRenderer code={context.code} language={context.languageKey} showLineNumbers /></div>
    {context.truncated && <p className="muted">{copy.contextTruncated}</p>}
  </section>;
}
