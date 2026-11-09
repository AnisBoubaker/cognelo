"use client";
import { defaultHomeworkSubmissionPolicy, formatHomeworkLateness, homeworkSubmissionWindow } from "../submission-policy";
import { submissionDeadlineCopy } from "./submission-deadline-copy";
import { HomeworkDownloads } from "./homework-downloads";
import { HomeworkFileViewer } from "./homework-file-viewer";
import { HomeworkChallengeQuestion } from "./homework-challenge-question";
import { HomeworkAnswerConfirmation } from "./homework-answer-confirmation";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActionIcon, MarkdownRenderer, ProgressDialog, AppDateTime, useApplicationTime, useServerNow, useDialogs, useNotifications, isActivityContentClosedError } from "@cognelo/activity-ui";
import type { TimedActivityAutoSubmit } from "@cognelo/activity-sdk";
import type { CodingHomeworkLocale } from "./messages";
import type { CodingHomeworkStudentAssignment, CodingHomeworkStudentChallengeQuestionRecord } from "./client";
import { homeworkWorkflowCopy } from "./workflow-copy";
import { body, homeworkFileBase64, type HomeworkRequest, type HomeworkPreparation, type HomeworkWorkspace } from "./workflow-types";

export function HomeworkStudentWorkspace({ request, title, locale, activityFileUrl, providedFilesUrl, submittedFilesUrl, onAssessmentAccessRequested, onAssessmentStarted, onSubmitted, timedAutoSubmit }: {
  request: HomeworkRequest; title: string; locale: CodingHomeworkLocale; activityFileUrl?: (id: string) => string; providedFilesUrl?: string; submittedFilesUrl?: string;
  onAssessmentAccessRequested?: () => void; onAssessmentStarted?: () => void; onSubmitted?: () => void; timedAutoSubmit?: TimedActivityAutoSubmit;
}) {
  const clock = useServerNow(); const { timeZone } = useApplicationTime(); const deadlineCopy = submissionDeadlineCopy(locale);
  const copy = homeworkWorkflowCopy(locale); const dialogs = useDialogs(); const notifications = useNotifications();
  const [workspace, setWorkspace] = useState<HomeworkWorkspace | null>(null), [preparation, setPreparation] = useState<HomeworkPreparation | null>(null);
  const [assignment, setAssignment] = useState<CodingHomeworkStudentAssignment | null>(null);
  const [questions, setQuestions] = useState<CodingHomeworkStudentChallengeQuestionRecord[]>([]), [answers, setAnswers] = useState<Record<string, string>>({});
  const [acknowledged, setAcknowledged] = useState(false), [busy, setBusy] = useState<string | null>(null), [saved, setSaved] = useState(false);
  const [confirmingAnswers, setConfirmingAnswers] = useState(false);
  const [checkedPreparation, setCheckedPreparation] = useState<HomeworkPreparation | null>(null);
  const [submittedCheck, setSubmittedCheck] = useState<Pick<HomeworkPreparation, "validation" | "readiness"> | null>(null);
  const preparationLoad = useRef(0);
  const runtimeRefresh = useRef(onAssessmentStarted); runtimeRefresh.current = onAssessmentStarted;
  const activeSubmissionId = useRef<string | null>(null);
  const workspaceLoad = useRef(0), contextKey = useRef<string | null>(null), preparationRef = useRef(preparation);
  preparationRef.current = preparation;
  const controller = useRef<AbortController | null>(null), dirty = useRef(false), answersRef = useRef(answers), saveQueue = useRef(Promise.resolve()), timeoutHandled = useRef<number | string | null>(null);
  answersRef.current = answers;
  const showError = useCallback((reason: unknown) => { if (!isActivityContentClosedError(reason) && !(reason instanceof DOMException && reason.name === "AbortError")) { notifications.error(reason instanceof Error ? reason.message : copy.error); } }, [copy.error, notifications]);
  const refresh = useCallback(async (reloadPreparation = true) => {
    const requestVersion = ++workspaceLoad.current;
    const state = await request<HomeworkWorkspace>("workspace");
    if (requestVersion !== workspaceLoad.current) return;
    const nextKey = state.teamwork?.contextKey ?? "individual", changed = contextKey.current !== null && contextKey.current !== nextKey;
    const participationChanged = activeSubmissionId.current !== (state.submission?.id ?? null);
    contextKey.current = nextKey; activeSubmissionId.current = state.submission?.id ?? null;
    if (changed || participationChanged) {
      controller.current?.abort(); setPreparation(null); preparationRef.current = null;
      setQuestions([]); setAnswers({}); setCheckedPreparation(null); setSubmittedCheck(null); setAcknowledged(false); setConfirmingAnswers(false); setSaved(false); dirty.current = false; timeoutHandled.current = null;
      runtimeRefresh.current?.(); // Refresh the host's runtime; a new team has no old answering timer.
    }
    setWorkspace(state);
    if (state.teamwork?.canSubmit !== false && !state.submission && (reloadPreparation || changed || participationChanged || (state.teamwork && preparationRef.current?.draft.revision !== state.teamwork.draftRevision))) {
      const version = ++preparationLoad.current;
      const prepared = await request<HomeworkPreparation>("preparation");
      if (preparationLoad.current === version && contextKey.current === nextKey) setPreparation(prepared);
    }
  }, [request]);
  useEffect(() => { let mounted = true; void Promise.all([refresh(), request<CodingHomeworkStudentAssignment>("assignment").then(value => { if (mounted) setAssignment(value); })]).catch(reason => { if (mounted) showError(reason); }); return () => { mounted = false; controller.current?.abort(); }; }, [request, refresh, showError]);
  useEffect(() => { const timer = setInterval(() => { void refresh(false).catch(() => {}); }, 4000); return () => clearInterval(timer); }, [refresh]);
  const automaticErrorNotified = useRef(false);
  useEffect(() => {
    if (workspace?.automaticSubmissionIssue && !automaticErrorNotified.current) notifications.error(deadlineCopy.autoFailed);
    automaticErrorNotified.current = Boolean(workspace?.automaticSubmissionIssue);
  }, [workspace?.automaticSubmissionIssue, notifications, deadlineCopy.autoFailed]);
  const active = workspace?.submission;
  const activeId = active?.id;
  useEffect(() => { setQuestions([]); setAnswers({}); setCheckedPreparation(null); setSubmittedCheck(null); setAcknowledged(false); setConfirmingAnswers(false); dirty.current = false; }, [active?.id]);
  const completed = active?.status === "ready_for_grading" || active?.status === "graded";
  const loadQuestions = useCallback((result: { questions: CodingHomeworkStudentChallengeQuestionRecord[] }) => { setQuestions(result.questions); setAnswers(Object.fromEntries(result.questions.map(question => [question.id, question.studentAnswer ?? ""]))); dirty.current = false; }, []);
  useEffect(() => {
    if (!active?.started || questions.length) return;
    const pending = new AbortController();
    void request<{ questions: CodingHomeworkStudentChallengeQuestionRecord[] }>("answering", { signal: pending.signal }).then(result => { if (!pending.signal.aborted) loadQuestions(result); }).catch(reason => { if (!pending.signal.aborted) showError(reason); });
    return () => pending.abort();
  }, [active?.started, active?.id, request, questions.length, loadQuestions, showError]);

  async function run(label: string, action: (signal: AbortSignal) => Promise<void>, reloadPreparation = true) {
    if (controller.current) return;
    preparationLoad.current++;
    const pending = new AbortController(); controller.current = pending; setBusy(label);
    try { await action(pending.signal); } catch (reason) { showError(reason); } finally { if (controller.current === pending) { controller.current = null; setBusy(null); } await refresh(reloadPreparation).catch(() => {}); }
  }
  function invalidateCheck() { setCheckedPreparation(null); setAcknowledged(false); }
  async function upload(files: FileList | null, zip: boolean) {
    const selectedFiles = Array.from(files ?? []);
    if (!selectedFiles.length || !preparation) return;
    const paths = selectedFiles.map(file => file.name);
    const replace = zip ? preparation.draft.files.length > 0 : paths.some(path => preparation.draft.files.some(file => file.path === path));
    if (replace && !await dialogs.confirm({ title: copy.replace, message: copy.replaceDetail, confirmLabel: copy.confirm })) return;
    invalidateCheck();
    await run(copy.upload, async signal => {
      let revision = preparation.draft.revision;
      for (const [index, file] of selectedFiles.entries()) {
        signal.throwIfAborted();
        const data = { ...(workspace?.teamwork ? { contextKey: workspace.teamwork.contextKey } : {}), kind: zip ? "zip" : "file", fileName: file.name, path: paths[index], base64: await homeworkFileBase64(file), expectedRevision: revision, replace };
        const result = await request<HomeworkPreparation>("preparation", body("POST", data, signal)); revision = result.draft.revision; setPreparation(result); setAcknowledged(false);
      }
    });
  }
  async function start() {
    const startingContext = contextKey.current, startingSubmission = activeSubmissionId.current;
    try { const result = await request<{ questions: CodingHomeworkStudentChallengeQuestionRecord[] }>("answering", body("POST", { submissionId: activeSubmissionId.current })); if (contextKey.current !== startingContext || activeSubmissionId.current !== startingSubmission) return; loadQuestions(result); onAssessmentStarted?.(); await refresh(); }
    catch (reason) { if (reason && typeof reason === "object" && "code" in reason && String(reason.code).includes("SAFE_EXAM_BROWSER")) onAssessmentAccessRequested?.(); else showError(reason); }
  }
  const saveAnswers = useCallback(async () => {
    if (!activeId || completed || !questions.length || !dirty.current) return;
    const snapshot = answersRef.current; dirty.current = false;
    const save = saveQueue.current.catch(() => {}).then(async () => { await request("challenge-answers", body("PUT", { submissionId: activeId, answers: Object.entries(snapshot).map(([questionId, answer]) => ({ questionId, answer })) })); if (activeSubmissionId.current === activeId) setSaved(true); });
    saveQueue.current = save;
    try { await save; } catch (reason) { if (activeSubmissionId.current === activeId) { dirty.current = true; showError(reason); } }
  }, [activeId, completed, questions.length, request, showError]);
  useEffect(() => { if (!dirty.current || completed) return; const timer = setTimeout(() => { void saveAnswers(); }, 600); return () => clearTimeout(timer); }, [answers, completed, saveAnswers]);
  const submitAnswers = useCallback(async (expired = false) => {
    if (!activeId || completed || controller.current) return false;
    try {
      const pending = new AbortController(); controller.current = pending; setBusy(copy.submitAnswers); await saveQueue.current.catch(() => {});
      await request("challenge-answers", body("POST", { submissionId: activeId, answers: expired ? [] : Object.entries(answersRef.current).map(([questionId, answer]) => ({ questionId, answer })) }, pending.signal));
      dirty.current = false; await refresh(); onSubmitted?.(); return true;
    } catch (reason) { if (isActivityContentClosedError(reason)) { onSubmitted?.(); return true; } showError(reason); return false; } finally { controller.current = null; setBusy(null); }
  }, [activeId, completed, copy.submitAnswers, request, refresh, onSubmitted, showError]);
  useEffect(() => {
    if (!timedAutoSubmit || timeoutHandled.current === timedAutoSubmit.requestId) return;
    timeoutHandled.current = timedAutoSubmit.requestId;
    if (completed) { timedAutoSubmit.onSettled(true); return; }
    void submitAnswers(true).then(timedAutoSubmit.onSettled);
  }, [timedAutoSubmit, completed, submitAnswers]);
  const policy = workspace?.submissionPolicy ?? defaultHomeworkSubmissionPolicy;
  const submissionWindow = homeworkSubmissionWindow(policy, clock);
  const files = active?.files ?? preparation?.draft.files ?? [];
  const hasCurrentCheck = Boolean(preparation && checkedPreparation && preparation.draft.revision === checkedPreparation.draft.revision &&
    JSON.stringify(preparation.validation.issues) === JSON.stringify(checkedPreparation.validation.issues) &&
    preparation.readiness.canSubmit === checkedPreparation.readiness.canSubmit && preparation.readiness.requiresAcknowledgement === checkedPreparation.readiness.requiresAcknowledgement);
  const structureValid = hasCurrentCheck && preparation?.readiness.canSubmit && !preparation.readiness.requiresAcknowledgement;
  const canShowSubmit = hasCurrentCheck && preparation?.readiness.canSubmit && (!preparation.readiness.requiresAcknowledgement || acknowledged);

  return <section className="section stack">
    <h2>{title}</h2>
    <MarkdownRenderer markdown={assignment?.assignment.promptMarkdown ?? ""} />
    <HomeworkDownloads promptPdfId={assignment?.assignment.promptPdf?.id} hasProvidedFiles={Boolean(assignment?.assignment.providedFiles.length)}
      activityFileUrl={activityFileUrl} providedFilesUrl={providedFilesUrl} locale={locale} />
    {(active?.submissionTiming?.deadline ?? (!active ? policy.deadline : null)) && <div className="stack" role="status">
      <p><strong>{deadlineCopy.deadline}: </strong><AppDateTime value={(active?.submissionTiming?.deadline ?? policy.deadline)!} locale={locale} /> ({timeZone})</p>
      {!active && <p>{policy.allowLate ? submissionWindow.closesAt ? <>{deadlineCopy.closes}: <AppDateTime value={submissionWindow.closesAt} locale={locale} /> ({timeZone})</> : deadlineCopy.unlimited : deadlineCopy.noLate}</p>}
      {!active && submissionWindow.closesAt && workspace?.submissionsEnabled && workspace?.teamwork?.canSubmit !== false && <p>{deadlineCopy.autoNotice}</p>}
      {!active && submissionWindow.closed && <p><strong>{deadlineCopy.closed}</strong></p>}
      {!active && submissionWindow.isLate && !submissionWindow.closed && <p>{deadlineCopy.lateNow}</p>}
    </div>}
    {active?.automaticHandIn && <div role="status"><strong>{deadlineCopy.automatic}</strong>{active.incompleteAcknowledged && <p>{deadlineCopy.autoIncomplete}</p>}</div>}
    {active?.submissionTiming?.isLate && <p role="status"><strong>{deadlineCopy.lateBy.replace("{duration}", formatHomeworkLateness(active.submissionTiming.lateByMs, locale))}</strong></p>}
    {!workspace ? <p>{copy.loading}</p> : workspace.teamwork?.canSubmit === false ? <div className="preview-panel" role="status"><strong>{copy.teamRequired}</strong></div> : <>
    {workspace?.previousCancelled && <p role="status">{copy.cancelled}</p>}
    {workspace?.teamwork && <div className="preview-panel" role="status">
      <strong>{workspace.teamwork.teamId ? `${copy.teamWorkspace}${workspace.teamwork.teamName ? ` · ${workspace.teamwork.teamName}` : ""}` : copy.individualWorkspace}</strong>
      {workspace.teamwork.members.length > 0 && <p>{workspace.teamwork.members.map(member => member.name).join(", ")}</p>}
      <p>{workspace.teamwork.teamId ? copy.teamWorkspaceHelp : copy.individualAllowed}</p>
    </div>}
    <h3>{active ? copy.readOnly : copy.prepare}</h3>
    {active ? <><p>{copy.frozen}</p><div className="row wrap">
      {submittedFilesUrl && <a className="button secondary" href={`${submittedFilesUrl}?submissionId=${encodeURIComponent(active.id)}`}><ActionIcon name="download" /> {copy.downloadSubmittedWork}</a>}
      <button type="button" className="secondary" disabled={Boolean(busy)} onClick={() => void run(copy.checkingSubmission, async signal => { setSubmittedCheck(await request("submitted-check", body("POST", { submissionId: active.id }, signal))); }, false)}><ActionIcon name="check" /> {copy.checkSubmission}</button>
    </div><p className="muted">{copy.structuralHelp}</p>
      {submittedCheck && <div role={submittedCheck.readiness.canSubmit && !submittedCheck.readiness.requiresAcknowledgement ? "status" : "alert"}>
        <p className="row"><ActionIcon name={submittedCheck.readiness.canSubmit && !submittedCheck.readiness.requiresAcknowledgement ? "check" : "alert"} /><strong>{submittedCheck.readiness.canSubmit && !submittedCheck.readiness.requiresAcknowledgement ? copy.structureValid : copy.structureInvalid}</strong></p>
        {submittedCheck.validation.issues.length > 0 && <ul>{submittedCheck.validation.issues.map((issue, index) => <li key={index}>{issue.message}</li>)}</ul>}
      </div>}
    </> : !submissionWindow.closed ? <>
      <div className="row">
        <label className="button secondary"><ActionIcon name="upload" /> {copy.upload}<input type="file" multiple hidden disabled={!preparation || Boolean(busy)} onChange={event => { void upload(event.target.files, false); event.target.value = ""; }} /></label>
        <label className="button secondary"><ActionIcon name="upload" /> {copy.zip}<input type="file" accept=".zip" hidden disabled={!preparation || Boolean(busy)} onChange={event => { void upload(event.target.files, true); event.target.value = ""; }} /></label>
        <button type="button" className="secondary" disabled={!files.length || Boolean(busy)} onClick={async () => {
          if (!preparation || !await dialogs.confirm({ title: copy.removeAllFiles, message: copy.removeAllFilesConfirm, confirmLabel: copy.removeAllFiles, confirmVariant: "danger" })) return;
          invalidateCheck();
          await run(copy.removeAllFiles, async signal => { setPreparation(await request("preparation", body("DELETE", { ...(workspace?.teamwork ? { contextKey: workspace.teamwork.contextKey } : {}), all: true, expectedRevision: preparation.draft.revision }, signal))); });
        }}><ActionIcon name="remove" /> {copy.removeAllFiles}</button>
      </div>
    </> : null}
    <HomeworkFileViewer key={`${workspace?.teamwork?.contextKey ?? "individual"}:${active?.id ?? "draft"}`} files={files} request={request} locale={locale} submitted={Boolean(active)} revision={active ? undefined : preparation?.draft.revision} busy={Boolean(busy)}
      onDelete={!active && preparation && !submissionWindow.closed ? async path => {
        if (!await dialogs.confirm({ title: copy.removeFile, message: copy.removePreparedFileConfirm.replace("{path}", path), confirmLabel: copy.remove, confirmVariant: "danger" })) return;
        invalidateCheck();
        await run(copy.remove, async signal => { setPreparation(await request("preparation", body("DELETE", { ...(workspace?.teamwork ? { contextKey: workspace.teamwork.contextKey } : {}), path, expectedRevision: preparation.draft.revision }, signal))); });
      } : undefined} />
    {!active && preparation && <section className="stack homework-structure-check">
      <p className="muted">{copy.structuralHelp}</p>
      <div><button type="button" className="secondary" disabled={!files.length || Boolean(busy)} onClick={() => {
        invalidateCheck();
        void run(copy.checkingSubmission, async signal => {
          const result = await request<HomeworkPreparation>("preparation", { signal });
          setPreparation(result); setCheckedPreparation(result);
        }, false);
      }}><ActionIcon name="check" /> {copy.checkSubmission}</button></div>
      {hasCurrentCheck && <div role={structureValid ? "status" : "alert"} className="stack">
        <p className={`row ${structureValid ? "success-message" : "error"}`}><ActionIcon name={structureValid ? "check" : "alert"} /><strong>{structureValid ? copy.structureValid : copy.structureInvalid}</strong></p>
        {!structureValid && <ul>{preparation.validation.issues.map((issue, index) => <li key={index}>{issue.path && !issue.message.includes(issue.path) ? `${issue.path}: ` : ""}{issue.message}</li>)}</ul>}
      </div>}
      {hasCurrentCheck && <div className="preview-panel homework-not-submitted" role="status">
        <p className="row"><ActionIcon name="alert" /><strong>{deadlineCopy.notSubmitted}</strong></p>
        <p>{submissionWindow.closed ? workspace?.automaticSubmissionIssue ? deadlineCopy.autoFailed : deadlineCopy.autoNotice : deadlineCopy.submitReminder.replace("{submit}", copy.handIn)}</p>
      </div>}
      {hasCurrentCheck && preparation.readiness.canSubmit && preparation.readiness.requiresAcknowledgement && <label className="homework-choice"><input type="checkbox" checked={acknowledged} onChange={event => setAcknowledged(event.target.checked)} /> {copy.incomplete}</label>}
      {!workspace?.submissionsEnabled && <p role="status">{copy.closed}</p>}
      {canShowSubmit && <button type="button" disabled={!workspace.submissionsEnabled || submissionWindow.closed || Boolean(busy)} onClick={async () => {
        if (await dialogs.confirm({ title: copy.handIn, message: workspace?.teamwork?.teamId ? copy.teamHandInDetail : copy.handInDetail, confirmLabel: copy.handIn })) await run(copy.handIn, async signal => { await request("hand-in", body("POST", { ...(workspace?.teamwork ? { contextKey: workspace.teamwork.contextKey } : {}), expectedRevision: preparation.draft.revision, acknowledgeIncomplete: acknowledged }, signal)); });
      }}><ActionIcon name="submit" /> {copy.handIn}</button>}
    </section>}
    {active && !["challenge_ready", "ready_for_grading", "graded"].includes(active.status) && <div role="status" aria-live="polite" aria-atomic="true" className="preview-panel homework-generation-status">
      {active.processingStatus !== "failed" && <span className="homework-generation-spinner" aria-hidden="true" />}
      <div>
        <strong>{active.generationIssue === "no_eligible_code" ? copy.noEligibleCode : active.processingStatus === "failed" ? copy.generationFailed : active.processingStatus === "queued" ? copy.waitingGeneration : copy.generating}</strong>
        {active.processingStatus === "queued" && active.queuePosition !== null && <p>{copy.queuePosition.replace("{position}", String(active.queuePosition))}</p>}
      </div>
    </div>}
    {active?.status === "challenge_ready" && !questions.length && <><p>{copy.answerHelp}</p><button type="button" onClick={() => void start()}><ActionIcon name="open" /> {copy.answer}</button></>}
    {questions.length > 0 && <><h3>{copy.answers}</h3><p className="muted">{copy.autoSave}</p>
      <div className="homework-challenge-list">{questions.map((question, index) => <HomeworkChallengeQuestion key={question.id}
        question={question} number={index + 1} total={questions.length} locale={locale} value={answers[question.id] ?? ""}
        maxLength={12000} disabled={completed || Boolean(timedAutoSubmit)}
        onChange={value => { dirty.current = true; setSaved(false); setAnswers(current => ({ ...current, [question.id]: value })); }}
        onBlur={() => void saveAnswers()} />)}</div>
      {!completed && <div className="row"><button type="button" className="secondary" disabled={Boolean(busy) || Boolean(timedAutoSubmit)} onClick={() => void saveAnswers()}><ActionIcon name="save" /> {copy.saveAnswers}</button><button type="button" disabled={Boolean(busy) || Boolean(timedAutoSubmit)} onClick={() => setConfirmingAnswers(true)}><ActionIcon name="submit" /> {copy.submitAnswers}</button>{saved && <span role="status">{copy.saved}</span>}</div>}
    </>}
    <HomeworkAnswerConfirmation open={confirmingAnswers && !completed && !timedAutoSubmit && !busy} questions={questions} answers={answers} locale={locale}
      onCancel={() => setConfirmingAnswers(false)} onConfirm={() => { setConfirmingAnswers(false); void submitAnswers(); }} />
    {completed && <p role="status">{active?.questionGenerationEnabled === false ? copy.fileOnlySubmitted : copy.submitted}</p>}
    </>}
    <ProgressDialog open={busy !== null} title={busy ?? copy.loading} progressLabel={busy ?? copy.loading} onCancel={() => controller.current?.abort()} cancelLabel={copy.cancel} />
  </section>;
}
