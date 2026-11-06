"use client";
import { formatHomeworkLateness, type HomeworkSubmissionTiming } from "../submission-policy";
import { submissionDeadlineCopy } from "./submission-deadline-copy";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActionIcon, ProgressDialog, useDialogs, useNotifications } from "@cognelo/activity-ui";
import { body, type HomeworkRequest } from "./workflow-types";
import { homeworkWorkflowCopy, homeworkStatusLabel } from "./workflow-copy";
import type { CodingHomeworkLocale } from "./messages";

type Submission = { automaticHandIn?: boolean; submissionTiming?: HomeworkSubmissionTiming | null; id: string; student: string; status: string; cancelled: boolean; processingError: string | null; team?: boolean; teamName?: string | null };
export function HomeworkSubmissionManagement({ request, locale, onChanged, recoverAutomatic = false }: { recoverAutomatic?: boolean; request: HomeworkRequest; locale: CodingHomeworkLocale; onChanged?: () => void }) {
  const copy = homeworkWorkflowCopy(locale), dialogs = useDialogs(), notifications = useNotifications();
  const automaticIssueSignature = useRef("");
  const [automaticIssues, setAutomaticIssues] = useState<Array<{ student: string; code: string; message: string }>>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]), [error, setError] = useState(""), [busy, setBusy] = useState<string | null>(null);
  useEffect(() => {
    const next = JSON.stringify(automaticIssues);
    if (automaticIssues.length && automaticIssueSignature.current !== next) notifications.error(submissionDeadlineCopy(locale).autoIssues);
    automaticIssueSignature.current = next;
  }, [automaticIssues, locale, notifications]);
  const controller = useRef<AbortController | null>(null), signature = useRef<string | null>(null), changed = useRef(onChanged);
  changed.current = onChanged;
  const report = useCallback((reason: unknown) => { const message = reason instanceof Error ? reason.message : copy.error; setError(message); notifications.error(message); }, [copy.error, notifications]);
  const refresh = useCallback(async () => {
    const result = await request<{ submissions: Submission[]; automaticSubmissionIssues?: Array<{ student: string; code: string; message: string }> }>(recoverAutomatic ? "manage-submissions?recoverAutomatic=1" : "manage-submissions");
    const values = result.submissions; setAutomaticIssues(result.automaticSubmissionIssues ?? []);
    const next = JSON.stringify(values.map(value => [value.id, value.cancelled]));
    if (signature.current !== null && signature.current !== next) changed.current?.();
    signature.current = next; setSubmissions(values);
  }, [request, recoverAutomatic]);
  useEffect(() => { void refresh().catch(report); const timer = setInterval(() => { void refresh().catch(() => {}); }, 10_000); return () => { clearInterval(timer); controller.current?.abort(); }; }, [refresh, report]);
  async function act(submission: Submission, reset: boolean) {
    const label = reset ? copy.resetChallenges : submission.team ? copy.cancelTeamSubmission : copy.cancelSubmission;
    const reason = await dialogs.prompt({ title: label, message: reset ? copy.resetChallengesDetail : submission.team ? copy.cancelTeamDetail : copy.cancelDetail,
      inputLabel: reset ? copy.resetChallengesReason : copy.cancelReason, required: true, maxLength: 2000, confirmLabel: label });
    if (!reason?.trim() || controller.current) return;
    const pending = new AbortController(); controller.current = pending; setBusy(label); setError("");
    try { await request("manage-submissions", body(reset ? "POST" : "DELETE", { submissionId: submission.id, reason, ...(reset ? { action: "reset-challenges" } : {}) }, pending.signal)); await refresh(); }
    catch (failure) { if (!pending.signal.aborted) report(failure); }
    finally { controller.current = null; setBusy(null); }
  }
  return <section className="section stack">
    <div className="row"><h3>{copy.management}</h3><button type="button" className="secondary" onClick={() => void refresh().catch(report)}><ActionIcon name="refresh" /> {copy.refresh}</button></div>
    {error && <p role="alert" className="error">{error}</p>}{!submissions.length && <p>{copy.noSubmissions}</p>}
    {automaticIssues.length > 0 && <div role="status"><strong>{submissionDeadlineCopy(locale).autoIssues}</strong><ul>{automaticIssues.map((issue, index) => <li key={index}>{issue.student}: {issue.message}</li>)}</ul></div>}
    <ul className="stack">{submissions.map(submission => <li key={submission.id}>
      <div className="row wrap"><strong>{submission.student}</strong>{submission.teamName && <span>{submission.teamName}</span>}<span>{homeworkStatusLabel(locale, submission.status)}</span>
        {submission.submissionTiming?.isLate && <strong>{submissionDeadlineCopy(locale).lateBy.replace("{duration}", formatHomeworkLateness(submission.submissionTiming.lateByMs, locale))}</strong>}
        {!submission.cancelled && <>
          <button type="button" className="secondary" onClick={() => void act(submission, false)}><ActionIcon name="close" /> {submission.team ? copy.cancelTeamSubmission : copy.cancelSubmission}</button>
          <button type="button" className="secondary" onClick={() => void act(submission, true)}><ActionIcon name="refresh" /> {copy.resetChallenges}</button>
        </>}
      </div>
      {submission.automaticHandIn && <p>{submissionDeadlineCopy(locale).automatic}</p>}
      {submission.processingError && <p className="error">{submission.processingError}</p>}
    </li>)}</ul>
    <ProgressDialog open={busy !== null} title={busy ?? copy.cancelSubmission} progressLabel={busy ?? copy.cancelSubmission} cancelLabel={copy.cancel} onCancel={() => controller.current?.abort()} />
  </section>;
}
