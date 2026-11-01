"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActionIcon, ProgressDialog, useDialogs } from "@cognelo/activity-ui";
import { body, type HomeworkRequest } from "./workflow-types";
import { homeworkWorkflowCopy, homeworkStatusLabel } from "./workflow-copy";
import type { CodingHomeworkLocale } from "./messages";

type Submission = { id: string; student: string; status: string; cancelled: boolean; processingError: string | null };
export function HomeworkSubmissionManagement({ request, locale, onChanged }: { request: HomeworkRequest; locale: CodingHomeworkLocale; onChanged?: () => void }) {
  const copy = homeworkWorkflowCopy(locale), dialogs = useDialogs();
  const [submissions, setSubmissions] = useState<Submission[]>([]), [error, setError] = useState(""), [busy, setBusy] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const refresh = useCallback(async () => { setSubmissions((await request<{ submissions: Submission[] }>("manage-submissions")).submissions); }, [request]);
  useEffect(() => { void refresh().catch(reason => setError(reason.message)); const timer = setInterval(() => { void refresh().catch(() => {}); }, 10_000); return () => { clearInterval(timer); controller.current?.abort(); }; }, [refresh]);
  return <section className="section stack"><div className="row"><h3>{copy.management}</h3><button type="button" className="secondary" onClick={() => void refresh().catch(reason => setError(reason.message))}><ActionIcon name="refresh" /> {copy.refresh}</button></div>
    {error && <p role="alert" className="error">{error}</p>}{!submissions.length && <p>{copy.noSubmissions}</p>}
    <ul className="stack">{submissions.map(submission => <li key={submission.id}><div className="row"><strong>{submission.student}</strong><span>{homeworkStatusLabel(locale, submission.status)}</span>{!submission.cancelled && <button type="button" className="secondary" onClick={async () => {
      const reason = await dialogs.prompt({ title: copy.cancelSubmission, message: copy.cancelDetail, inputLabel: copy.cancelReason, required: true, maxLength: 2000, confirmLabel: copy.cancelSubmission });
      if (!reason?.trim()) return;
      const pending = new AbortController(); controller.current = pending; setBusy(true); setError("");
      try { await request("manage-submissions", body("DELETE", { submissionId: submission.id, reason }, pending.signal)); await refresh(); onChanged?.(); }
      catch (error) { if (!pending.signal.aborted) setError(error instanceof Error ? error.message : copy.error); }
      finally { controller.current = null; setBusy(false); }
    }}><ActionIcon name="close" /> {copy.cancelSubmission}</button>}</div>{submission.processingError && <p className="error">{submission.processingError}</p>}</li>)}</ul>
    <ProgressDialog open={busy} title={copy.cancelSubmission} progressLabel={copy.cancelSubmission} cancelLabel={copy.cancel} onCancel={() => controller.current?.abort()} />
  </section>;
}
