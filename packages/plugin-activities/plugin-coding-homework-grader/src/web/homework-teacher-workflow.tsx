"use client";
import { createPortal } from "react-dom";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ActionIcon, AiModelPicker, ProgressDialog, useNotifications, useUnsavedChangesGuard, useActivityReferenceAuthoring, type AiModelConnectionOption } from "@cognelo/activity-ui";
import type { AiModelSelection } from "@cognelo/contracts";
import { defaultHomeworkSubmissionPolicy, type HomeworkSubmissionPolicy } from "../submission-policy";
import type { CodingHomeworkLocale } from "./messages";
import { homeworkWorkflowCopy } from "./workflow-copy";
import { body, type HomeworkRequest } from "./workflow-types";
import { HomeworkDeadlineSettings } from "./homework-deadline-settings";
export { HomeworkSolutionSelector } from "./homework-solution-selector";

type Settings = { submissionPolicy: HomeworkSubmissionPolicy; questionPolicyLocked: boolean; enabled: boolean; prepared: boolean; concurrency: number;
  ai: { connections: AiModelConnectionOption[]; question: { selection: AiModelSelection | null; resolved: { model: string } | null; error: string | null } } };
export function HomeworkTeacherWorkflow({ request, locale, hasUnsavedChanges, settingsPortalTarget, generationSettings, managementRevision = 0 }: { request: HomeworkRequest; locale: CodingHomeworkLocale; hasUnsavedChanges: boolean; settingsPortalTarget?: HTMLElement | null; generationSettings?: ReactNode | ((locked: boolean) => ReactNode); managementRevision?: number }) {
  const copy = homeworkWorkflowCopy(locale), notifications = useNotifications(), references = useActivityReferenceAuthoring();
  const [settings, setSettings] = useState<Settings | null>(null), [questionAi, setQuestionAi] = useState<AiModelSelection | null>(null), [error, setError] = useState("");
  const [busy, setBusy] = useState(false), [deadlineDirty, setDeadlineDirty] = useState(false), controller = useRef<AbortController | null>(null), version = useRef(0), modelDirty = useRef(false);
  const report = useCallback((error: unknown) => { const message = error instanceof Error ? error.message : copy.error; setError(message); notifications.error(message); }, [copy.error, notifications]);
  const refresh = useCallback(async (adopt = false) => { const id = ++version.current; const data = await request<Settings>("workflow-settings"); if (id !== version.current) return; setSettings(data); if (adopt || !modelDirty.current) setQuestionAi(data.ai.question.selection); }, [request]);
  useEffect(() => { const requests = version; void refresh(true).catch(report); return () => { requests.current++; controller.current?.abort(); }; }, [refresh, report]);
  useEffect(() => { if (managementRevision || references?.loaded) void refresh().catch(report); }, [managementRevision, references?.revision, references?.loaded, refresh, report]);
  const changed = Boolean(settings && JSON.stringify(questionAi) !== JSON.stringify(settings.ai.question.selection));
  modelDirty.current = changed;
  async function run(input: unknown, adopt = false) {
    if (controller.current) return;
    const pending = new AbortController(); controller.current = pending; setBusy(true); setError("");
    try { await request("workflow-settings", body("PUT", input, pending.signal)); await refresh(adopt); }
    catch (error) { if (!pending.signal.aborted) report(error); throw error; }
    finally { controller.current = null; setBusy(false); }
  }
  useUnsavedChangesGuard({ isDirty: changed, onSave: () => run({ questionGenerationAi: questionAi }, true), onDiscard: () => setQuestionAi(settings?.ai.question.selection ?? null) });
  const ready = references ? references.loaded && references.prepared && !references.dirty : settings?.prepared;
  const panel = <section className="section stack homework-workflow-settings"><h3>{copy.workflowSettings}</h3>
    {error && <p role="alert" className="error">{error}</p>}
    {!settings && <p>{copy.loading}</p>}
    {settings && <section className="stack homework-ai-model-selection"><h4>{copy.questionModelTitle}</h4>
      <AiModelPicker connections={settings.ai.connections} value={questionAi} purpose="generation" onChange={setQuestionAi} disabled={busy}
        labels={{ connection: copy.aiConnection, model: copy.aiModel, inherit: copy.aiCourseDefault, unavailable: copy.aiUnavailable, noModels: copy.aiNoGenerationModels }} />
      <p className="muted">{copy.questionModelHelp}</p>
      {!changed && settings.ai.question.resolved && <p className="muted">{copy.aiInUse}: {settings.ai.question.resolved.model}</p>}
      {!changed && settings.ai.question.error && <p role="status">{settings.ai.question.error}</p>}
      <div className="row wrap"><button type="button" disabled={!changed || busy} onClick={() => void run({ questionGenerationAi: questionAi }, true).catch(() => {})}><ActionIcon name="save" />{copy.saveModel}</button>
        <a className="button secondary" href="/settings/ai-agents" target="_blank" rel="noreferrer"><ActionIcon name="settings" />{copy.manageConnections}</a>
        <button type="button" disabled={busy} onClick={() => void refresh().catch(report)}><ActionIcon name="refresh" />{copy.refreshModels}</button></div>
    </section>}
    {typeof generationSettings === "function" ? generationSettings(settings?.questionPolicyLocked ?? true) : generationSettings}
    {settings && <>
      <HomeworkDeadlineSettings policy={settings.submissionPolicy ?? defaultHomeworkSubmissionPolicy} request={request} locale={locale} onDirtyChange={setDeadlineDirty} onSaved={submissionPolicy => setSettings(current => current ? { ...current, submissionPolicy } : current)} />
      <label className="field">{copy.concurrency}<input type="number" min={1} max={4} value={settings.concurrency} disabled={busy} onChange={event => { const concurrency = Number(event.currentTarget.value); if (concurrency >= 1 && concurrency <= 4) void run({ concurrency }).catch(() => {}); }} /></label>
      <p role="status">{settings.enabled ? copy.enabledHelp : ready ? copy.prepared : copy.needsPreparation}</p>
      {(hasUnsavedChanges || deadlineDirty || references?.dirty) && <p className="muted">{copy.saveFirst}</p>}
      <button type="button" disabled={busy || (!settings.enabled && (hasUnsavedChanges || deadlineDirty || !ready || changed))} onClick={() => void run({ enabled: !settings.enabled }).catch(() => {})}><ActionIcon name={settings.enabled ? "close" : "check"} />{settings.enabled ? copy.disable : copy.enabled}</button>
    </>}
  </section>;
  const progress = <ProgressDialog open={busy} title={copy.save} progressLabel={copy.save} cancelLabel={copy.cancel} onCancel={() => controller.current?.abort()} />;
  return <>{settingsPortalTarget === undefined ? panel : settingsPortalTarget ? createPortal(panel, settingsPortalTarget) : null}{settingsPortalTarget ? createPortal(progress, settingsPortalTarget.ownerDocument.body) : progress}</>;
}
