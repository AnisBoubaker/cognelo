"use client";
import { createPortal } from "react-dom";
import { useEffect, useId, useRef, useState } from "react";
import { EditActionBar, ProgressDialog, ToggleSwitch, getEditActionBarCopy, useApplicationTime, useNotifications, useUnsavedChangesGuard, toZonedDateTimeInput, fromZonedDateTimeInput } from "@cognelo/activity-ui";
import { homeworkSubmissionPolicySchema, type HomeworkSubmissionPolicy } from "../submission-policy";
import type { CodingHomeworkLocale } from "./messages";
import { body, type HomeworkRequest } from "./workflow-types";
import { submissionDeadlineCopy } from "./submission-deadline-copy";

type Draft = { deadline: string; allowLate: boolean; limited: boolean; days: string; hours: string; minutes: string };
function draftFor(policy: HomeworkSubmissionPolicy, timeZone: string): Draft {
  const minutes = policy.lateLimitMinutes ?? 1440;
  return { deadline: toZonedDateTimeInput(policy.deadline, timeZone), allowLate: policy.allowLate, limited: policy.lateLimitMinutes !== null,
    days: String(Math.floor(minutes / 1440)), hours: String(Math.floor(minutes % 1440 / 60)), minutes: String(minutes % 60) };
}
export function HomeworkDeadlineSettings({ policy, request, locale, onSaved, onDirtyChange }: { policy: HomeworkSubmissionPolicy; request: HomeworkRequest; locale: CodingHomeworkLocale; onSaved: (policy: HomeworkSubmissionPolicy) => void; onDirtyChange: (dirty: boolean) => void }) {
  const { timeZone } = useApplicationTime(), copy = submissionDeadlineCopy(locale), action = getEditActionBarCopy(locale), notifications = useNotifications(), id = useId();
  const [saved, setSaved] = useState(policy), [draft, setDraft] = useState(() => draftFor(policy, timeZone)), [busy, setBusy] = useState(false);
  const dirty = JSON.stringify(draft) !== JSON.stringify(draftFor(saved, timeZone)), dirtyRef = useRef(dirty), controller = useRef<AbortController | null>(null);
  dirtyRef.current = dirty;
  useEffect(() => { onDirtyChange(dirty); }, [dirty, onDirtyChange]);
  useEffect(() => { setSaved(policy); if (!dirtyRef.current) setDraft(draftFor(policy, timeZone)); }, [policy, timeZone]);
  useEffect(() => () => controller.current?.abort(), []);
  const discard = () => setDraft(draftFor(saved, timeZone));
  async function save() {
    if (controller.current) throw new Error(action.saving);
    const pending = new AbortController(); controller.current = pending; setBusy(true);
    try {
      let deadline: string | null;
      try { deadline = fromZonedDateTimeInput(draft.deadline, timeZone); } catch { throw new Error(copy.invalidDeadline); }
      const allowLate = Boolean(deadline) && draft.allowLate;
      let lateLimitMinutes: number | null = null;
      if (allowLate && draft.limited) {
        if ([draft.days, draft.hours, draft.minutes].some(value => !/^\d*$/.test(value)) || Number(draft.days) > 3650 || Number(draft.hours) > 23 || Number(draft.minutes) > 59) throw new Error(copy.invalidDuration);
        lateLimitMinutes = Number(draft.days) * 1440 + Number(draft.hours) * 60 + Number(draft.minutes);
        if (lateLimitMinutes <= 0 || lateLimitMinutes > 3650 * 1440) throw new Error(copy.invalidDuration);
      }
      const submissionPolicy = homeworkSubmissionPolicySchema.parse({ deadline, allowLate, lateLimitMinutes });
      const result = await request<{ submissionPolicy: HomeworkSubmissionPolicy }>("workflow-settings", body("PUT", { submissionPolicy }, pending.signal));
      setSaved(result.submissionPolicy); setDraft(draftFor(result.submissionPolicy, timeZone)); onSaved(result.submissionPolicy);
    } catch (error) { if (!pending.signal.aborted) notifications.error(error instanceof Error ? error.message : copy.invalidDeadline); throw error; }
    finally { controller.current = null; setBusy(false); }
  }
  useUnsavedChangesGuard({ isDirty: dirty, onDiscard: discard, onSave: save });
  const update = (key: keyof Draft, value: string | boolean) => setDraft(current => ({ ...current, [key]: value }));
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
    <EditActionBar isDirty={dirty} isSaving={busy} savedLabel={action.saved} unsavedLabel={action.unsaved} saveLabel={copy.save} savingLabel={action.saving} cancelLabel={action.cancel} onCancel={discard} onSave={() => save().catch(() => {})} />
    {busy && createPortal(<ProgressDialog open title={copy.save} progressLabel={action.saving} cancelLabel={action.cancel} onCancel={() => controller.current?.abort()} />, document.body)}
  </section>;
}
