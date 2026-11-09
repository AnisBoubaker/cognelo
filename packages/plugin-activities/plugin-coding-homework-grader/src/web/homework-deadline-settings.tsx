"use client";
import { useId } from "react";
import { ToggleSwitch, toZonedDateTimeInput, fromZonedDateTimeInput } from "@cognelo/activity-ui";
import { homeworkSubmissionPolicySchema, type HomeworkSubmissionPolicy } from "../submission-policy";
import type { CodingHomeworkLocale } from "./messages";
import { submissionDeadlineCopy } from "./submission-deadline-copy";

export type HomeworkDeadlineDraft = { deadline: string; allowLate: boolean; limited: boolean; days: string; hours: string; minutes: string };
export function homeworkDeadlineDraft(policy: HomeworkSubmissionPolicy, timeZone: string): HomeworkDeadlineDraft {
  const minutes = policy.lateLimitMinutes ?? 1440;
  return { deadline: toZonedDateTimeInput(policy.deadline, timeZone), allowLate: policy.allowLate, limited: policy.lateLimitMinutes !== null,
    days: String(Math.floor(minutes / 1440)), hours: String(Math.floor(minutes % 1440 / 60)), minutes: String(minutes % 60) };
}
export function homeworkDeadlinePolicy(draft: HomeworkDeadlineDraft, timeZone: string, locale: CodingHomeworkLocale): HomeworkSubmissionPolicy {
  const copy = submissionDeadlineCopy(locale);
  let deadline: string | null;
  try { deadline = fromZonedDateTimeInput(draft.deadline, timeZone); } catch { throw new Error(copy.invalidDeadline); }
  const allowLate = Boolean(deadline) && draft.allowLate;
  let lateLimitMinutes: number | null = null;
  if (allowLate && draft.limited) {
    if ([draft.days, draft.hours, draft.minutes].some(value => !/^\d*$/.test(value)) || Number(draft.days) > 3650 || Number(draft.hours) > 23 || Number(draft.minutes) > 59) throw new Error(copy.invalidDuration);
    lateLimitMinutes = Number(draft.days) * 1440 + Number(draft.hours) * 60 + Number(draft.minutes);
    if (lateLimitMinutes <= 0 || lateLimitMinutes > 3650 * 1440) throw new Error(copy.invalidDuration);
  }
  return homeworkSubmissionPolicySchema.parse({ deadline, allowLate, lateLimitMinutes });
}
export function HomeworkDeadlineSettings({ draft, timeZone, locale, busy, onChange }: { draft: HomeworkDeadlineDraft; timeZone: string; locale: CodingHomeworkLocale; busy: boolean; onChange: (draft: HomeworkDeadlineDraft) => void }) {
  const copy = submissionDeadlineCopy(locale), id = useId();
  const update = (key: keyof HomeworkDeadlineDraft, value: string | boolean) => onChange({ ...draft, [key]: value });
  return <section className="stack homework-deadline-settings" aria-labelledby={`${id}-title`}>
    <h4 id={`${id}-title`}>{copy.title}</h4>
    <div className="field"><label htmlFor={`${id}-deadline`}>{copy.deadline} ({timeZone})</label>
      <input id={`${id}-deadline`} type="datetime-local" value={draft.deadline} disabled={busy} onChange={event => update("deadline", event.currentTarget.value)} />
      <p className="muted">{copy.optional}</p>
    </div>
    <ToggleSwitch locale={locale} label={copy.allowLate} checked={draft.allowLate} disabled={busy || !draft.deadline} onChange={checked => update("allowLate", checked)} />
    {draft.deadline && draft.allowLate && <>
      <ToggleSwitch locale={locale} label={copy.limitLate} checked={draft.limited} disabled={busy} onChange={checked => update("limited", checked)} />
      {draft.limited && <div className="row wrap">{([['days', copy.days, 3650], ['hours', copy.hours, 23], ['minutes', copy.minutes, 59]] as const).map(([key, label, max]) => <div className="field" key={key}>
        <label htmlFor={`${id}-${key}`}>{label}</label><input id={`${id}-${key}`} type="number" min={0} max={max} step={1} value={draft[key]} disabled={busy} onChange={event => update(key, event.currentTarget.value)} />
      </div>)}</div>}
    </>}
    <p className="muted">{copy.help}</p>
  </section>;
}
