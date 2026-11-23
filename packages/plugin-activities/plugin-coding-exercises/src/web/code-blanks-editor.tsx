"use client";

import { useId } from "react";
import { CodeRenderer, codeInputProtectionAttributes, type CodeInlineSlot } from "@cognelo/activity-ui";
import { codingBlankAnswer, parseCodingBlankTemplate, type CodingBlankAnswers } from "../code-blanks";
import { formatCodingExercisesMessage, type CodingExercisesLocale } from "./messages";

export function CodeBlanksEditor({ template, answers, onChange, readOnly = false, locale, language, prefix = "", suffix = "" }: {
  template: string; answers: CodingBlankAnswers; onChange: (answers: CodingBlankAnswers) => void;
  readOnly?: boolean; locale: CodingExercisesLocale; language: string;
  prefix?: string; suffix?: string;
}) {
  const scope = useId();
  let parts;
  try { parts = parseCodingBlankTemplate(template); }
  catch { return <p role="alert">{formatCodingExercisesMessage(locale, "blankTemplateInvalid")}</p>; }
  let code = prefix;
  let number = 0;
  const slots: CodeInlineSlot[] = [];
  for (const part of parts) {
    if (part.kind === "code") { code += part.text; continue; }
    const start = code.length;
    code += `__cognelo_blank_${number++}__`;
    slots.push({ key: part.id, start, end: code.length, content: <span className="coding-blank-field"><input
      key={part.id} id={`${scope}-${part.id}`} className="coding-blank-input" type="text"
      aria-label={formatCodingExercisesMessage(locale, "codeBlankNumber", { number })}
      value={codingBlankAnswer(answers, part.id)} readOnly={readOnly}
      onChange={event => onChange({ ...answers, [part.id]: event.target.value })}
      maxLength={10000}
      onKeyDown={event => { if (event.key === "Enter") event.preventDefault(); }}
      {...codeInputProtectionAttributes}
    /></span> });
  }
  code += suffix;
  return <div className="coding-blank-editor notranslate" translate="no">
    <CodeRenderer code={code} language={language} inlineSlots={slots} />
  </div>;
}
