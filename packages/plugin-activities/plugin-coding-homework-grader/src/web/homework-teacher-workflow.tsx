"use client";
import { createPortal } from "react-dom";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ActionIcon, AiModelPicker, EditActionBar, ToggleSwitch, getEditActionBarCopy, ProgressDialog, useNotifications, useUnsavedChangesGuard, useActivityReferenceAuthoring, type AiModelConnectionOption } from "@cognelo/activity-ui";
import type { AiModelSelection } from "@cognelo/contracts";
import { defaultHomeworkSubmissionPolicy, type HomeworkSubmissionPolicy } from "../submission-policy";
import type { CodingHomeworkLocale } from "./messages";
import { homeworkWorkflowCopy } from "./workflow-copy";
import { body, type HomeworkRequest } from "./workflow-types";
import { homeworkEditorCopy } from "./editor-copy";
import { HomeworkDeadlineSettings } from "./homework-deadline-settings";
export { HomeworkSolutionSelector } from "./homework-solution-selector";

type Settings = { questionGenerationEnabled: boolean; submissionPolicy: HomeworkSubmissionPolicy; questionPolicyLocked: boolean; enabled: boolean; prepared: boolean; concurrency: number;
  ai: { connections: AiModelConnectionOption[]; question: { selection: AiModelSelection | null; resolved: { model: string } | null; error: string | null } } };
export function HomeworkTeacherWorkflow({ request, locale, hasUnsavedChanges, questionPortalTarget, submissionPortalTarget, generationSettings, managementRevision = 0, questionsEnabled, onDirtyChange, onQuestionPolicyLockedChange }: {
  request: HomeworkRequest; locale: CodingHomeworkLocale; hasUnsavedChanges: boolean; questionPortalTarget: HTMLElement | null; submissionPortalTarget: HTMLElement | null;
  generationSettings?: ReactNode | ((locked: boolean) => ReactNode); managementRevision?: number; questionsEnabled: boolean; onDirtyChange?: (dirty: boolean) => void; onQuestionPolicyLockedChange?: (locked: boolean) => void;
}) {
  const edit = homeworkEditorCopy(locale), actions = getEditActionBarCopy(locale);
  const copy = homeworkWorkflowCopy(locale), notifications = useNotifications(), references = useActivityReferenceAuthoring();
  const [settings, setSettings] = useState<Settings | null>(null), [questionAi, setQuestionAi] = useState<AiModelSelection | null>(null);
  const [busy, setBusy] = useState(false), [deadlineDirty, setDeadlineDirty] = useState(false), controller = useRef<AbortController | null>(null), version = useRef(0), modelDirty = useRef(false);
  const report = useCallback((error: unknown) => { const message = error instanceof Error ? error.message : copy.error; notifications.error(message); }, [copy.error, notifications]);
  const refresh = useCallback(async (adopt = false) => { const id = ++version.current; const data = await request<Settings>("workflow-settings"); if (id !== version.current) return; setSettings(data); if (adopt || !modelDirty.current) setQuestionAi(data.ai.question.selection); }, [request]);
  useEffect(() => { const requests = version; void refresh(true).catch(report); return () => { requests.current++; controller.current?.abort(); }; }, [refresh, report]);
  useEffect(() => { const focus = () => { if (!document.hidden && !controller.current) void refresh().catch(report); }; window.addEventListener("focus", focus); document.addEventListener("visibilitychange", focus); return () => { window.removeEventListener("focus", focus); document.removeEventListener("visibilitychange", focus); }; }, [refresh, report]);
  useEffect(() => { if (managementRevision || references?.loaded) void refresh().catch(report); }, [managementRevision, references?.revision, references?.loaded, refresh, report]);
  useEffect(() => onQuestionPolicyLockedChange?.(settings?.questionPolicyLocked ?? true), [settings?.questionPolicyLocked, onQuestionPolicyLockedChange]);
  const changed = Boolean(settings && JSON.stringify(questionAi) !== JSON.stringify(settings.ai.question.selection));
  modelDirty.current = changed;
  useEffect(() => onDirtyChange?.((questionsEnabled && changed) || deadlineDirty), [changed, deadlineDirty, questionsEnabled, onDirtyChange]);
  async function run(input: unknown, adopt = false) {
    if (controller.current) return;
    const pending = new AbortController(); controller.current = pending; setBusy(true);
    try { await request("workflow-settings", body("PUT", input, pending.signal)); await refresh(adopt); }
    catch (error) { if (!pending.signal.aborted) report(error); throw error; }
    finally { controller.current = null; setBusy(false); }
  }
  useUnsavedChangesGuard({ isDirty: changed, onSave: () => run({ questionGenerationAi: questionAi }, true), onDiscard: () => setQuestionAi(settings?.ai.question.selection ?? null) });
  const ready = !settings?.questionGenerationEnabled || (references ? references.loaded && references.prepared && !references.dirty : settings?.prepared);
  const questionPanel = <div className="stack homework-workflow-questions">
    {!settings && <p>{copy.loading}</p>}
    {settings && <section className="stack homework-ai-model-selection"><h4>{copy.questionModelTitle}</h4>
      <AiModelPicker connections={settings.ai.connections} value={questionAi} purpose="generation" onChange={setQuestionAi} disabled={busy}
        labels={{ connection: copy.aiConnection, model: copy.aiModel, inherit: copy.aiCourseDefault, unavailable: copy.aiUnavailable, noModels: copy.aiNoGenerationModels }} />
      <p className="muted">{copy.questionModelHelp}</p>
      {!changed && settings.ai.question.resolved && <p className="muted">{copy.aiInUse}: {settings.ai.question.resolved.model}</p>}
      {!changed && settings.ai.question.error && <p role="status">{settings.ai.question.error}</p>}
      <EditActionBar isDirty={changed} isSaving={busy} savedLabel={actions.saved} unsavedLabel={actions.unsaved} saveLabel={copy.saveModel} savingLabel={actions.saving} cancelLabel={actions.cancel} onCancel={() => setQuestionAi(settings.ai.question.selection)} onSave={() => void run({ questionGenerationAi: questionAi }, true).catch(() => {})} />
      <div className="row wrap">
        <a className="button secondary" href="/settings/ai-agents" target="_blank" rel="noreferrer"><ActionIcon name="settings" />{copy.manageConnections}</a>
        <button type="button" disabled={busy} onClick={() => void refresh().catch(report)}><ActionIcon name="refresh" />{copy.refreshModels}</button></div>
    </section>}
    {typeof generationSettings === "function" ? generationSettings(settings?.questionPolicyLocked ?? true) : generationSettings}
    {settings && <label className="field">{copy.concurrency}<input type="number" min={1} max={4} value={settings.concurrency} disabled={busy} onChange={event => { const concurrency = Number(event.currentTarget.value); if (concurrency >= 1 && concurrency <= 4) void run({ concurrency }).catch(() => {}); }} /></label>}
  </div>;
  const submissionPanel = <div className="stack homework-workflow-submission">
    {settings && <>
      <ToggleSwitch locale={locale} label={edit.finalSubmissions} checked={settings.enabled} disabled={busy || (!settings.enabled && (hasUnsavedChanges || deadlineDirty || !ready || (questionsEnabled && (changed || references?.dirty))))} onChange={enabled => void run({ enabled }).catch(() => {})} />
      <p role="status">{settings.enabled ? copy.enabledHelp : questionsEnabled ? ready ? copy.prepared : copy.needsPreparation : edit.disabledHelp}</p>
      {(hasUnsavedChanges || deadlineDirty || (questionsEnabled && references?.dirty)) && <p className="muted">{copy.saveFirst}</p>}
      <HomeworkDeadlineSettings policy={settings.submissionPolicy ?? defaultHomeworkSubmissionPolicy} request={request} locale={locale} onDirtyChange={setDeadlineDirty} onSaved={submissionPolicy => setSettings(current => current ? { ...current, submissionPolicy } : current)} />
    </>}
  </div>;
  return <>{questionPortalTarget && createPortal(questionPanel, questionPortalTarget)}{submissionPortalTarget && createPortal(submissionPanel, submissionPortalTarget)}
    {busy && createPortal(<ProgressDialog open title={copy.save} progressLabel={copy.save} cancelLabel={copy.cancel} onCancel={() => controller.current?.abort()} />, document.body)}
  </>;
}
