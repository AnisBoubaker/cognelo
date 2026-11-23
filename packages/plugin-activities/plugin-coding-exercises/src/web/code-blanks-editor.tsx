"use client";

import { useEffect, useId, useRef, useState } from "react";
import { CodeRenderer, codeInputProtectionAttributes, type CodeInlineSlot } from "@cognelo/activity-ui";
import { codingBlankAnswer, parseCodingBlankTemplate, type CodingBlankAnswers } from "../code-blanks";
import { formatCodingExercisesMessage, type CodingExercisesLocale } from "./messages";

export function CodeBlanksEditor({ template, answers, onChange, readOnly = false, locale, language, prefix = "", suffix = "", numberOffset = 0 }: {
  template: string; answers: CodingBlankAnswers; onChange: (answers: CodingBlankAnswers) => void;
  readOnly?: boolean; locale: CodingExercisesLocale; language: string;
  prefix?: string; suffix?: string; numberOffset?: number;
}) {
  const scope = useId();
  let parts;
  try { parts = parseCodingBlankTemplate(template); }
  catch { return <p role="alert">{formatCodingExercisesMessage(locale, "blankTemplateInvalid")}</p>; }
  let code = prefix;
  let number = numberOffset;
  const slots: CodeInlineSlot[] = [];
  for (const part of parts) {
    if (part.kind === "code") { code += part.text; continue; }
    const start = code.length;
    code += `__cognelo_blank_${number++}__`;
    slots.push({ key: part.id, start, end: code.length, content: <CodeBlankField
      id={`${scope}-${part.id}`} label={formatCodingExercisesMessage(locale, "codeBlankNumber", { number })}
      resizeLabel={formatCodingExercisesMessage(locale, "resizeCodeBlank", { number })}
      value={codingBlankAnswer(answers, part.id)} readOnly={readOnly}
      onChange={value => onChange({ ...answers, [part.id]: value })}
    /> });
  }
  code += suffix;
  return <div className="coding-blank-editor notranslate" translate="no">
    <CodeRenderer code={code} language={language} inlineSlots={slots} />
  </div>;
}

function CodeBlankField({ id, label, resizeLabel, value, readOnly, onChange }: {
  id: string; label: string; resizeLabel: string; value: string; readOnly: boolean; onChange: (value: string) => void;
}) {
  const fieldRef = useRef<HTMLSpanElement>(null);
  const drag = useRef<{ pointerId: number; x: number; width: number } | null>(null);
  // Width is presentation state only: editing/resizing never saves dimensions with the answer.
  const [width, setWidth] = useState<number>();
  const [bounds, setBounds] = useState({ current: 0, min: 0, max: 0 });

  useEffect(() => {
    const field = fieldRef.current!;
    const update = () => {
      const next = measureBlankField(field);
      setBounds(previous => previous.current === next.current && previous.min === next.min && previous.max === next.max ? previous : next);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(field);
    observer.observe(field.closest(".coding-blank-editor")!);
    return () => observer.disconnect();
  }, []);

  function resize(next: number) {
    const { min, max } = measureBlankField(fieldRef.current!);
    setWidth(Math.max(min, Math.min(max, next)));
  }

  return <span ref={fieldRef} className="coding-blank-field" style={width === undefined ? undefined : { width }}>
    <input id={id} className="coding-blank-input" type="text" aria-label={label}
      value={value} readOnly={readOnly} onChange={event => onChange(event.target.value)} maxLength={10000}
      onKeyDown={event => { if (event.key === "Enter") event.preventDefault(); }} {...codeInputProtectionAttributes} />
    <span className="coding-blank-resize-handle" role="separator" tabIndex={0} aria-label={resizeLabel} title={resizeLabel}
      aria-controls={id} aria-orientation="vertical" aria-valuenow={Math.round(bounds.current)}
      aria-valuemin={Math.round(bounds.min)} aria-valuemax={Math.round(bounds.max)}
      onPointerDown={event => {
        if (event.button !== 0) return;
        event.preventDefault();
        event.currentTarget.focus({ preventScroll: true });
        drag.current = { pointerId: event.pointerId, x: event.clientX, width: measureBlankField(fieldRef.current!).current };
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={event => {
        if (drag.current?.pointerId === event.pointerId) resize(drag.current.width + event.clientX - drag.current.x);
      }}
      onPointerUp={event => {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
        drag.current = null;
      }}
      onPointerCancel={() => { drag.current = null; }} onLostPointerCapture={() => { drag.current = null; }}
      onKeyDown={event => {
        const { current, min, max } = measureBlankField(fieldRef.current!);
        const step = event.shiftKey ? 40 : 8;
        if (event.key === "ArrowLeft") resize(current - step);
        else if (event.key === "ArrowRight") resize(current + step);
        else if (event.key === "Home") resize(min);
        else if (event.key === "End") resize(max);
        else return;
        event.preventDefault();
        event.stopPropagation();
      }}
    />
  </span>;
}

function measureBlankField(field: HTMLSpanElement) {
  const min = parseFloat(getComputedStyle(field).minWidth);
  const available = field.closest(".coding-blank-editor")!.clientWidth - 4;
  return { current: field.getBoundingClientRect().width, min, max: Math.max(min, available) };
}
