"use client";
import { SubmittedWorkViewer } from "./submitted-work-viewer";
import { QuestionCodeContext } from "./question-code-context";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActionIcon, MarkdownRenderer, ProgressDialog, useDialogs, isActivityContentClosedError } from "@cognelo/activity-ui";
import type { TimedActivityAutoSubmit } from "@cognelo/activity-sdk";
import type { CodingHomeworkLocale } from "./messages";
import type { CodingHomeworkStudentAssignment, CodingHomeworkStudentChallengeQuestionRecord } from "./client";
import { homeworkWorkflowCopy } from "./workflow-copy";
import { body, homeworkFileBase64, type HomeworkRequest, type HomeworkPreparation, type HomeworkWorkspace } from "./workflow-types";

export function HomeworkStudentWorkspace({ request, title, locale, activityFileUrl, onAssessmentAccessRequested, onAssessmentStarted, onSubmitted, timedAutoSubmit }: {
  request: HomeworkRequest; title: string; locale: CodingHomeworkLocale; activityFileUrl?: (id: string) => string;
  onAssessmentAccessRequested?: () => void; onAssessmentStarted?: () => void; onSubmitted?: () => void; timedAutoSubmit?: TimedActivityAutoSubmit;
}) {
  const copy = homeworkWorkflowCopy(locale); const dialogs = useDialogs();
  const [workspace, setWorkspace] = useState<HomeworkWorkspace | null>(null), [preparation, setPreparation] = useState<HomeworkPreparation | null>(null);
  const [assignment, setAssignment] = useState<CodingHomeworkStudentAssignment | null>(null);
  const [questions, setQuestions] = useState<CodingHomeworkStudentChallengeQuestionRecord[]>([]), [answers, setAnswers] = useState<Record<string, string>>({});
  const [acknowledged, setAcknowledged] = useState(false), [error, setError] = useState(""), [busy, setBusy] = useState<string | null>(null), [saved, setSaved] = useState(false);
  const [preview, setPreview] = useState<{ path: string; text: string } | null>(null);
  const preparationLoad = useRef(0);
  const controller = useRef<AbortController | null>(null), dirty = useRef(false), answersRef = useRef(answers), saveQueue = useRef(Promise.resolve()), timeoutHandled = useRef<number | string | null>(null);
  answersRef.current = answers;
  const refresh = useCallback(async (reloadPreparation = true) => {
    const version = reloadPreparation ? ++preparationLoad.current : null;
    const state = await request<HomeworkWorkspace>("workspace"); setWorkspace(state);
    if (!state.submission && reloadPreparation) { const prepared = await request<HomeworkPreparation>("preparation"); if (preparationLoad.current === version) setPreparation(prepared); }
  }, [request]);
  useEffect(() => { let mounted = true; void Promise.all([refresh(), request<CodingHomeworkStudentAssignment>("assignment").then(value => { if (mounted) setAssignment(value); })]).catch(reason => { if (mounted) setError(reason.message); }); return () => { mounted = false; controller.current?.abort(); }; }, [request, refresh]);
  useEffect(() => { const timer = setInterval(() => { void refresh(false).catch(() => {}); }, 4000); return () => clearInterval(timer); }, [refresh]);
  const active = workspace?.submission;
  const activeId = active?.id;
  useEffect(() => { setQuestions([]); setAnswers({}); setPreview(null); dirty.current = false; }, [active?.id]);
  const completed = active?.status === "ready_for_grading" || active?.status === "graded";
  const showError = useCallback((reason: unknown) => { if (!isActivityContentClosedError(reason) && !(reason instanceof DOMException && reason.name === "AbortError")) setError(reason instanceof Error ? reason.message : copy.error); }, [copy.error]);
  const loadQuestions = useCallback((result: { questions: CodingHomeworkStudentChallengeQuestionRecord[] }) => { setQuestions(result.questions); setAnswers(Object.fromEntries(result.questions.map(question => [question.id, question.studentAnswer ?? ""]))); dirty.current = false; }, []);
  useEffect(() => {
    if (!active?.started || questions.length) return;
    const pending = new AbortController();
    void request<{ questions: CodingHomeworkStudentChallengeQuestionRecord[] }>("answering", { signal: pending.signal }).then(result => { if (!pending.signal.aborted) loadQuestions(result); }).catch(() => {});
    return () => pending.abort();
  }, [active?.started, active?.id, request, questions.length, loadQuestions]);

  async function run(label: string, action: (signal: AbortSignal) => Promise<void>) {
    preparationLoad.current++;
    const pending = new AbortController(); controller.current = pending; setBusy(label); setError("");
    try { await action(pending.signal); } catch (reason) { showError(reason); } finally { if (controller.current === pending) { controller.current = null; setBusy(null); } await refresh().catch(() => {}); }
  }
  async function upload(files: FileList | null, zip: boolean) {
    const selectedFiles = Array.from(files ?? []);
    if (!selectedFiles.length || !preparation) return;
    const paths = selectedFiles.map(file => file.name);
    const replace = zip ? preparation.draft.files.length > 0 : paths.some(path => preparation.draft.files.some(file => file.path === path));
    if (replace && !await dialogs.confirm({ title: copy.replace, message: copy.replaceDetail, confirmLabel: copy.confirm })) return;
    await run(copy.upload, async signal => {
      let revision = preparation.draft.revision;
      for (const [index, file] of selectedFiles.entries()) {
        signal.throwIfAborted();
        const data = { kind: zip ? "zip" : "file", fileName: file.name, path: paths[index], base64: await homeworkFileBase64(file), expectedRevision: revision, replace };
        const result = await request<HomeworkPreparation>("preparation", body("POST", data, signal)); revision = result.draft.revision; setPreparation(result); setAcknowledged(false);
      }
    });
  }
  async function start() {
    setError("");
    try { const result = await request<{ questions: CodingHomeworkStudentChallengeQuestionRecord[] }>("answering", body("POST")); loadQuestions(result); onAssessmentStarted?.(); await refresh(); }
    catch (reason) { if (reason && typeof reason === "object" && "code" in reason && String(reason.code).includes("SAFE_EXAM_BROWSER")) onAssessmentAccessRequested?.(); else showError(reason); }
  }
  const saveAnswers = useCallback(async () => {
    if (!activeId || completed || !questions.length || !dirty.current) return;
    const snapshot = answersRef.current; dirty.current = false;
    const save = saveQueue.current.catch(() => {}).then(async () => { await request("challenge-answers", body("PUT", { submissionId: activeId, answers: Object.entries(snapshot).map(([questionId, answer]) => ({ questionId, answer })) })); setSaved(true); });
    saveQueue.current = save;
    try { await save; } catch (reason) { dirty.current = true; showError(reason); }
  }, [activeId, completed, questions.length, request, showError]);
  useEffect(() => { if (!dirty.current || completed) return; const timer = setTimeout(() => { void saveAnswers(); }, 600); return () => clearTimeout(timer); }, [answers, completed, saveAnswers]);
  const submitAnswers = useCallback(async (expired = false) => {
    if (!activeId) return false;
    try {
      const pending = new AbortController(); controller.current = pending; setBusy(copy.submitAnswers); await saveQueue.current.catch(() => {});
      await request("challenge-answers", body("POST", { submissionId: activeId, answers: expired ? [] : Object.entries(answersRef.current).map(([questionId, answer]) => ({ questionId, answer })) }, pending.signal));
      dirty.current = false; await refresh(); onSubmitted?.(); return true;
    } catch (reason) { if (isActivityContentClosedError(reason)) { onSubmitted?.(); return true; } showError(reason); return false; } finally { controller.current = null; setBusy(null); }
  }, [activeId, copy.submitAnswers, request, refresh, onSubmitted, showError]);
  useEffect(() => {
    if (!timedAutoSubmit || timeoutHandled.current === timedAutoSubmit.requestId) return;
    timeoutHandled.current = timedAutoSubmit.requestId;
    if (completed) { timedAutoSubmit.onSettled(true); return; }
    void submitAnswers(true).then(timedAutoSubmit.onSettled);
  }, [timedAutoSubmit, completed, submitAnswers]);
  const files = active?.files ?? preparation?.draft.files ?? [];
  return <section className="section stack">
    <h2>{title}</h2>
    <MarkdownRenderer markdown={assignment?.assignment.promptMarkdown ?? ""} />
    {activityFileUrl && assignment?.assignment.promptPdf && <a href={activityFileUrl(assignment.assignment.promptPdf.id)} target="_blank" rel="noreferrer">{assignment.assignment.promptPdf.originalName}</a>}
    {activityFileUrl && assignment?.assignment.providedFiles.map(file => <a key={file.id} href={activityFileUrl(file.id)}>{file.originalName}</a>)}
    {error && <p className="error" role="alert">{error}</p>}
    {!workspace && <p>{copy.loading}</p>}
    {workspace?.previousCancelled && <p role="status">{copy.cancelled}</p>}
    <h3>{active ? copy.readOnly : copy.prepare}</h3>
    {active ? <p>{copy.frozen}</p> : <>
      <div className="row">
        <label className="button secondary"><ActionIcon name="upload" /> {copy.upload}<input type="file" multiple hidden disabled={!preparation || Boolean(busy)} onChange={event => { void upload(event.target.files, false); event.target.value = ""; }} /></label>
        <label className="button secondary"><ActionIcon name="upload" /> {copy.zip}<input type="file" accept=".zip" hidden disabled={!preparation || Boolean(busy)} onChange={event => { void upload(event.target.files, true); event.target.value = ""; }} /></label>
      </div>
    </>}
    {active ? <SubmittedWorkViewer key={active.id} files={active.files} request={request} locale={locale} /> : <>
    {!files.length && <p className="muted">{copy.empty}</p>}
    <ul className="stack">{files.map(file => <li key={file.path} className="row"><code>{file.path}</code><span className="muted">{file.sizeBytes.toLocaleString()} B</span>
      <button type="button" className="secondary" onClick={() => void request<{ path: string; text: string }>(`prepared-file?path=${encodeURIComponent(file.path)}`).then(setPreview).catch(showError)}><ActionIcon name="visible" /> {copy.view}</button>
      {!active && <button type="button" className="secondary" onClick={() => void run(copy.remove, async signal => { setPreparation(await request("preparation", body("DELETE", { path: file.path, expectedRevision: preparation!.draft.revision }, signal))); setAcknowledged(false); })}><ActionIcon name="remove" /> {copy.remove}</button>}
    </li>)}</ul>
    {preview && <section className="stack"><div className="row"><h4>{preview.path}</h4><button type="button" className="secondary" onClick={() => setPreview(null)}>{copy.close}</button></div><pre style={{ maxHeight: "28rem", overflow: "auto", whiteSpace: "pre-wrap" }}>{preview.text}</pre></section>}
    </>}
    {!active && preparation && <>
      <h3>{copy.validation}</h3>{preparation.validation.issues.length ? <ul>{preparation.validation.issues.map((issue, index) => <li key={index}>{issue.path ? `${issue.path}: ` : ""}{issue.message}</li>)}</ul> : files.length > 0 && <p>{copy.ready}</p>}
      {preparation.readiness.requiresAcknowledgement && <label className="homework-choice"><input type="checkbox" checked={acknowledged} onChange={event => setAcknowledged(event.target.checked)} /> {copy.incomplete}</label>}
      {!workspace?.submissionsEnabled && <p role="status">{copy.closed}</p>}
      <button type="button" disabled={!workspace?.submissionsEnabled || !preparation.readiness.canSubmit || (preparation.readiness.requiresAcknowledgement && !acknowledged)} onClick={async () => {
        if (await dialogs.confirm({ title: copy.handIn, message: copy.handInDetail, confirmLabel: copy.handIn })) await run(copy.handIn, async signal => { await request("hand-in", body("POST", { expectedRevision: preparation.draft.revision, acknowledgeIncomplete: acknowledged }, signal)); });
      }}><ActionIcon name="submit" /> {copy.handIn}</button>
    </>}
    {active && !["challenge_ready", "ready_for_grading", "graded"].includes(active.status) && <div role="status" className="preview-panel"><strong>{active.processingStatus === "failed" ? copy.generationFailed : copy.generating}</strong>{active.queuePosition && <p>{copy.queue}: {active.queuePosition}</p>}<p>{copy.leave}</p></div>}
    {active?.status === "challenge_ready" && !questions.length && <><p>{copy.answerHelp}</p><button type="button" onClick={() => void start()}><ActionIcon name="open" /> {copy.answer}</button></>}
    {questions.length > 0 && <><h3>{copy.answers}</h3><p className="muted">{copy.autoSave}</p>{questions.map((question, index) => <div key={question.id} className="field"><QuestionCodeContext context={question.context} locale={locale} /><label htmlFor={`answer-${question.id}`}><strong>{index + 1}.</strong><MarkdownRenderer markdown={question.questionText} /></label><textarea id={`answer-${question.id}`} rows={5} maxLength={12000} disabled={completed || Boolean(timedAutoSubmit)} value={answers[question.id] ?? ""} onChange={event => { dirty.current = true; setSaved(false); setAnswers(current => ({ ...current, [question.id]: event.target.value })); }} onBlur={() => void saveAnswers()} /></div>)}
      {!completed && <div className="row"><button type="button" className="secondary" onClick={() => void saveAnswers()}><ActionIcon name="save" /> {copy.saveAnswers}</button><button type="button" onClick={() => void submitAnswers()}><ActionIcon name="submit" /> {copy.submitAnswers}</button>{saved && <span role="status">{copy.saved}</span>}</div>}
    </>}
    {completed && <p role="status">{copy.submitted}</p>}
    <ProgressDialog open={busy !== null} title={busy ?? copy.loading} progressLabel={busy ?? copy.loading} onCancel={() => controller.current?.abort()} cancelLabel={copy.cancel} />
  </section>;
}
