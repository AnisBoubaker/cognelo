"use client";
import { createPortal } from "react-dom";
import type { ReactNode } from "react";
import { ActionIcon, AiModelPicker, ToggleSwitch } from "@cognelo/activity-ui";
import type { CodingHomeworkLocale } from "./messages";
import { homeworkWorkflowCopy } from "./workflow-copy";
import { homeworkEditorCopy } from "./editor-copy";
import type { HomeworkWorkflowDraft } from "./homework-workflow-draft";
export { HomeworkSolutionSelector } from "./homework-solution-selector";

export function HomeworkTeacherWorkflow({ workflow, locale, busy, questionPortalTarget, submissionPortalTarget, generationSettings, questionsEnabled, schedulingUrl }: {
  workflow: HomeworkWorkflowDraft; locale: CodingHomeworkLocale; busy: boolean; questionPortalTarget: HTMLElement | null; submissionPortalTarget: HTMLElement | null;
  generationSettings?: ReactNode | ((locked: boolean) => ReactNode); questionsEnabled: boolean; schedulingUrl?: string;
}) {
  const edit = homeworkEditorCopy(locale), copy = homeworkWorkflowCopy(locale);
  const { settings, draft, update, references, refresh, report } = workflow;
  const changed = JSON.stringify(draft?.questionAi) !== JSON.stringify(settings?.ai.question.selection);
  const ready = !questionsEnabled || (references ? references.loaded && references.prepared && !references.dirty : settings?.prepared);
  const questionPanel = <div className="stack homework-workflow-questions">
    {!settings && <p>{copy.loading}</p>}
    {settings && draft && <section className="stack homework-ai-model-selection"><h4>{copy.questionModelTitle}</h4>
      <AiModelPicker connections={settings.ai.connections} value={draft.questionAi} purpose="generation" onChange={questionAi => update({ questionAi })} disabled={busy}
        labels={{ connection: copy.aiConnection, model: copy.aiModel, inherit: copy.aiCourseDefault, unavailable: copy.aiUnavailable, noModels: copy.aiNoGenerationModels }} />
      <p className="muted">{copy.questionModelHelp}</p>
      {!changed && settings.ai.question.resolved && <p className="muted">{copy.aiInUse}: {settings.ai.question.resolved.model}</p>}
      {!changed && settings.ai.question.error && <p role="status">{settings.ai.question.error}</p>}
      <div className="row wrap">
        <a className="button secondary" href="/settings/ai-agents" target="_blank" rel="noreferrer"><ActionIcon name="settings" />{copy.manageConnections}</a>
        <button type="button" disabled={busy} onClick={() => void refresh().catch(report)}><ActionIcon name="refresh" />{copy.refreshModels}</button></div>
    </section>}
    {typeof generationSettings === "function" ? generationSettings(settings?.questionPolicyLocked ?? true) : generationSettings}
    {draft && <label className="field">{copy.concurrency}<input type="number" min={1} max={4} step={1} value={draft.concurrency} disabled={busy} onChange={event => update({ concurrency: event.currentTarget.value })} /></label>}
  </div>;
  const submissionPanel = <div className="stack homework-workflow-submission">
    {settings && draft && <>
      <ToggleSwitch locale={locale} label={edit.finalSubmissions} checked={draft.enabled} disabled={busy || (!draft.enabled && !ready)} onChange={enabled => update({ enabled })} />
      <p role="status">{draft.enabled !== settings.enabled ? draft.enabled ? edit.pendingOpening : edit.pendingClosing : draft.enabled ? copy.enabledHelp : questionsEnabled ? ready ? copy.prepared : copy.needsPreparation : edit.disabledHelp}</p>
      {questionsEnabled && references?.dirty && <p className="muted">{copy.saveFirst}</p>}
      <p className="muted">{edit.schedulingHelp}</p>
      {schedulingUrl && <a className="button secondary" href={schedulingUrl}><ActionIcon name="settings" />{edit.scheduling}</a>}
    </>}
  </div>;
  return <>{questionPortalTarget && createPortal(questionPanel, questionPortalTarget)}{submissionPortalTarget && createPortal(submissionPanel, submissionPortalTarget)}</>;
}
