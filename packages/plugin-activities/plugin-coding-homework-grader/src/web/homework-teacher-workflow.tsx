"use client";
import { createPortal } from "react-dom";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActionIcon, AiModelPicker, type AiModelConnectionOption, ProgressDialog, useUnsavedChangesGuard } from "@cognelo/activity-ui";
import type { AiModelSelection } from "@cognelo/contracts";
import type { CodingHomeworkLocale } from "./messages";
import { homeworkWorkflowCopy } from "./workflow-copy";
import { body, type HomeworkRequest } from "./workflow-types";

export { HomeworkSolutionSelector } from "./homework-solution-selector";

type AiChoice = { selection: AiModelSelection | null; resolved: { connectionId: string; model: string; displayName?: string; provider?: string } | null; error: string | null };
type Settings = { ai: { connections: AiModelConnectionOption[]; question: AiChoice; embedding: AiChoice }; rows: Array<{ id: string; parentId: string | null; kind: string; title: string; depth: number; resourceId: string | null }>; selected: string[]; statuses: Record<string, { state: string; maxAgeHours?: number | null; error?: string }>; enabled: boolean; prepared: boolean; concurrency: number };
export function HomeworkTeacherWorkflow({ request, locale, hasUnsavedChanges, settingsPortalTarget }: { request: HomeworkRequest; locale: CodingHomeworkLocale; hasUnsavedChanges: boolean; settingsPortalTarget?: HTMLElement | null }) {
  const copy = homeworkWorkflowCopy(locale);
  const [settings, setSettings] = useState<Settings | null>(null), [selected, setSelected] = useState<string[]>([]);
  const [embeddingAi, setEmbeddingAi] = useState<AiModelSelection | null>(null), [questionAi, setQuestionAi] = useState<AiModelSelection | null>(null);
  const [error, setError] = useState(""), [busy, setBusy] = useState<string | null>(null), [progressValue, setProgress] = useState<number | null>(null);
  const controller = useRef<AbortController | null>(null);
  const refreshVersion = useRef(0);
  const refresh = useCallback(async (keepSelection = false, adoptModels: boolean | "embedding" | "question" = !keepSelection) => {
    const version = ++refreshVersion.current;
    const value = await request<Settings>("workflow-settings");
    if (version !== refreshVersion.current) return;
    const available = new Set(value.rows.flatMap(row => row.resourceId ? [row.resourceId] : []));
    setSettings(value);
    if (adoptModels === true || adoptModels === "embedding") setEmbeddingAi(value.ai.embedding.selection);
    if (adoptModels === true || adoptModels === "question") setQuestionAi(value.ai.question.selection);
    setSelected(current => (keepSelection ? current : value.selected).filter(id => available.has(id)));
  }, [request]);
  useEffect(() => { void refresh().catch(reason => setError(reason.message)); return () => controller.current?.abort(); }, [refresh]);
  async function run(label: string, action: (signal: AbortSignal) => Promise<void>, adoptModels: boolean | "embedding" | "question" = false) { if (controller.current) return; const pending = new AbortController(); controller.current = pending; setBusy(label); setProgress(null); setError(""); try { await action(pending.signal); } catch (reason) { if (!pending.signal.aborted) setError(reason instanceof Error ? reason.message : copy.error); } finally { controller.current = null; setBusy(null); await refresh(true, adoptModels).catch(() => {}); } }
  function idsForRow(row: Settings["rows"][number]) {
    if (row.resourceId) return [row.resourceId];
    const descendants = new Set([row.id]); const ids: string[] = [];
    for (const item of settings?.rows ?? []) if (item.parentId && descendants.has(item.parentId)) { descendants.add(item.id); if (item.resourceId) ids.push(item.resourceId); }
    return [...new Set(ids)];
  }
  const selectionChanged = Boolean(settings && JSON.stringify([...selected].sort()) !== JSON.stringify([...settings.selected].sort()));
  const sameChoice = (left: AiModelSelection | null | undefined, right: AiModelSelection | null | undefined) => JSON.stringify(left ?? null) === JSON.stringify(right ?? null);
  const embeddingChanged = Boolean(settings && !sameChoice(embeddingAi, settings.ai.embedding.selection));
  const questionChanged = Boolean(settings && !sameChoice(questionAi, settings.ai.question.selection));
  const aiChanges = () => ({ ...(embeddingChanged ? { embeddingAi } : {}), ...(questionChanged ? { questionGenerationAi: questionAi } : {}) });
  useUnsavedChangesGuard({ isDirty: selectionChanged || embeddingChanged || questionChanged,
    onDiscard: () => { setSelected(settings?.selected ?? []); setEmbeddingAi(settings?.ai.embedding.selection ?? null); setQuestionAi(settings?.ai.question.selection ?? null); },
    onSave: async () => { await request("workflow-settings", body("PUT", { selected, ...aiChanges() })); await refresh(); } });
  function modelPicker(purpose: "generation" | "embedding") {
    if (!settings) return null;
    const embedding = purpose === "embedding", choice = embedding ? settings.ai.embedding : settings.ai.question;
    const changed = embedding ? embeddingChanged : questionChanged;
    return <section className="stack homework-ai-model-selection">
      <h4>{embedding ? copy.embeddingModelTitle : copy.questionModelTitle}</h4>
      <AiModelPicker connections={settings.ai.connections} value={embedding ? embeddingAi : questionAi} purpose={purpose}
        onChange={embedding ? setEmbeddingAi : setQuestionAi} disabled={busy !== null || (embedding && settings.enabled)}
        labels={{ connection: copy.aiConnection, model: copy.aiModel, inherit: copy.aiCourseDefault, unavailable: copy.aiUnavailable, noModels: embedding ? copy.aiNoEmbeddingModels : copy.aiNoGenerationModels }} />
      <p className="muted">{embedding ? copy.embeddingModelHelp : copy.questionModelHelp}</p>
      {!changed && choice.resolved && <p className="muted">{copy.aiInUse}: {choice.resolved.model}</p>}
      {!changed && choice.error && <p className="error">{choice.error}</p>}
      <div className="row wrap">
        <button type="button" className="secondary" disabled={!changed || busy !== null || (embedding && settings.enabled)} onClick={() => void run(copy.save, async signal => {
          await request("workflow-settings", body("PUT", embedding ? { embeddingAi } : { questionGenerationAi: questionAi }, signal));
        }, embedding ? "embedding" : "question")}><ActionIcon name="save" /> {copy.saveModel}</button>
        <a className="button secondary" href="/settings/ai-agents" target="_blank" rel="noreferrer"><ActionIcon name="settings" /> {copy.manageConnections}</a>
        <button type="button" className="secondary" disabled={busy !== null} onClick={() => void refresh(true).catch(reason => setError(reason.message))}><ActionIcon name="refresh" /> {copy.refreshModels}</button>
      </div>
    </section>;
  }
  const references = <section className="section stack homework-reference-materials"><h3>{copy.materials}</h3><p>{copy.materialHelp}</p>
    {error && <p className="error" role="alert">{error}</p>}
    {!settings && <p>{copy.loading}</p>}
    {modelPicker("embedding")}
    {settings?.rows.filter(row => row.kind === "folder" || row.resourceId).map(row => {
      const ids = idsForRow(row); const status = row.resourceId ? settings.statuses[row.resourceId] : null;
      const statusText = status?.state === "ready" ? copy.readyIndex : status?.state === "stale" ? copy.staleIndex : status?.state === "missing" ? copy.missingIndex : status?.state === "needs_model" ? copy.aiChooseEmbedding : copy.unsupportedIndex;
      return <div key={row.id} style={{ marginInlineStart: `${Math.min(10, row.depth) * 1.25}rem` }}><label className="homework-choice"><input type="checkbox" disabled={settings.enabled || !ids.length} checked={ids.length > 0 && ids.every(id => selected.includes(id))} ref={input => { if (input) input.indeterminate = ids.some(id => selected.includes(id)) && !ids.every(id => selected.includes(id)); }} onChange={event => setSelected(current => event.target.checked ? [...new Set([...current, ...ids])] : current.filter(id => !ids.includes(id)))} /> {row.title}</label>{status && <span className="muted"> — {statusText}{status.maxAgeHours ? ` · ${copy.freshness}: ${status.maxAgeHours}` : ""}{status.error ? ` · ${status.error}` : ""}</span>}</div>;
    })}
    {!selected.length && <p className="muted">{copy.noMaterials}</p>}
    <p className="muted">{copy.referenceSettingsHelp}</p>
  </section>;
  const settingsPanel = <section className="section stack homework-workflow-settings">
    <h3>{copy.workflowSettings}</h3>
    {error && <p className="error" role="alert">{error}</p>}
    {!settings && <p>{copy.loading}</p>}
    {modelPicker("generation")}
    <p>{copy.materials}: {selected.length}</p>
    {settings && <>
      <label className="field">{copy.concurrency}<input type="number" min={1} max={4} value={settings.concurrency} onChange={event => { const concurrency = Number(event.target.value); if (concurrency >= 1 && concurrency <= 4) void run(copy.save, async signal => { await request("workflow-settings", body("PUT", { concurrency }, signal)); }); }} /></label>
      <p role="status">{settings.enabled ? copy.enabledHelp : settings.prepared && !selectionChanged ? copy.prepared : copy.needsPreparation}</p>
      {hasUnsavedChanges && <p className="muted">{copy.saveFirst}</p>}
      <div className="row">
        <button type="button" className="secondary" disabled={settings.enabled} onClick={() => void run(copy.preparing, async signal => {
          await request("workflow-settings", body("PUT", { selected, ...aiChanges() }, signal));
          for (let index = 0; index < selected.length; index++) { signal.throwIfAborted(); await request("prepare-material", body("POST", { resourceId: selected[index] }, signal)); setProgress(Math.round(100 * (index + 1) / selected.length)); }
          signal.throwIfAborted(); await request("prepare-references", body("POST", undefined, signal));
        }, true)}><ActionIcon name="generate" /> {copy.embeddings}</button>
        <button type="button" disabled={!settings.enabled && (hasUnsavedChanges || !settings.prepared || selectionChanged || embeddingChanged || questionChanged)} onClick={() => void run(copy.save, async signal => { await request("workflow-settings", body("PUT", { enabled: !settings.enabled }, signal)); })}><ActionIcon name={settings.enabled ? "close" : "check"} /> {settings.enabled ? copy.disable : copy.enabled}</button>
      </div>
    </>}
  </section>;
  const progress = <ProgressDialog open={busy !== null} title={busy ?? copy.preparing} progressLabel={busy ?? copy.preparing} progress={progressValue} onCancel={() => controller.current?.abort()} cancelLabel={copy.cancel} />;
  return <>
    {references}
    {settingsPortalTarget === undefined ? settingsPanel : settingsPortalTarget ? createPortal(settingsPanel, settingsPortalTarget) : null}
    {settingsPortalTarget ? createPortal(progress, settingsPortalTarget.ownerDocument.body) : progress}
  </>;
}
