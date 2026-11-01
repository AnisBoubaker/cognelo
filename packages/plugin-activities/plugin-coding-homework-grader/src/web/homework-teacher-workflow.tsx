"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActionIcon, ProgressDialog, useDialogs, useUnsavedChangesGuard } from "@cognelo/activity-ui";
import type { CodingHomeworkLocale } from "./messages";
import type { CodingHomeworkAuthoringSubmissionRequirements } from "./client";
import { homeworkWorkflowCopy, homeworkStatusLabel } from "./workflow-copy";
import { body, homeworkFileBase64, type HomeworkRequest } from "./workflow-types";

type Solution = { files: Array<{ path: string }>; functions: Array<{ key: string; functionName: string; sourcePath: string; signature?: { returnType: string; parameterTypes: string[] } }> };
export function HomeworkSolutionSelector({ request, locale, requirements, onChange }: { request: HomeworkRequest; locale: CodingHomeworkLocale; requirements: CodingHomeworkAuthoringSubmissionRequirements; onChange: (value: CodingHomeworkAuthoringSubmissionRequirements) => void }) {
  const copy = homeworkWorkflowCopy(locale); const [solution, setSolution] = useState<Solution | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState(""); const controller = useRef<AbortController | null>(null);
  useEffect(() => { void request<Solution>("teacher-solution").then(setSolution).catch(reason => setError(reason.message)); return () => controller.current?.abort(); }, [request]);
  const selected = new Set(requirements.requiredFunctions.map(fn => `${fn.filePath}:${fn.name}`));
  function select(keys: string[]) { onChange({ ...requirements, requiredFunctions: solution?.functions.filter(fn => keys.includes(fn.key)).map(fn => ({ name: fn.functionName, filePath: fn.sourcePath, required: true, ...fn.signature })) ?? [] }); }
  async function run(action: (signal: AbortSignal) => Promise<void>) { const pending = new AbortController(); controller.current = pending; setBusy(true); setError(""); try { await action(pending.signal); } catch (reason) { if (!pending.signal.aborted) setError(reason instanceof Error ? reason.message : copy.error); } finally { setBusy(false); controller.current = null; } }
  return <section className="stack"><h3>{copy.solution}</h3><p className="muted">{copy.solutionHelp}</p>
    <div className="row"><label className="button secondary"><ActionIcon name="upload" /> {copy.upload}<input type="file" accept=".c,.h,.zip" multiple hidden onChange={event => { const files = Array.from(event.target.files ?? []); event.target.value = ""; void run(async signal => { for (const file of files) { signal.throwIfAborted(); setSolution(await request("teacher-solution", body("PUT", { fileName: file.name, base64: await homeworkFileBase64(file) }, signal))); } }); }} /></label>
    <button type="button" className="secondary" disabled={!solution?.functions.length} onClick={() => void run(async signal => { const result = await request<{ selectedFunctionKeys: string[] }>("select-functions", body("POST", undefined, signal)); select(result.selectedFunctionKeys); })}><ActionIcon name="generate" /> {copy.selectAi}</button></div>
    {error && <p className="error" role="alert">{error}</p>}
    {solution?.files.length ? <><h4>{copy.requiredFiles}</h4>{solution.files.map(file => <label key={file.path}><input type="checkbox" checked={requirements.requiredFiles.some(item => item.path === file.path)} onChange={event => onChange({ ...requirements, requiredFiles: event.target.checked ? [...requirements.requiredFiles.filter(item => item.path !== file.path), { path: file.path }] : requirements.requiredFiles.filter(item => item.path !== file.path) })} /> <code>{file.path}</code></label>)}</> : null}
    {solution?.functions.length ? <><h4>{copy.requiredFunctions}</h4>{solution.functions.map(fn => <label key={fn.key}><input type="checkbox" checked={selected.has(fn.key)} onChange={event => select(event.target.checked ? [...selected, fn.key] : [...selected].filter(key => key !== fn.key))} /><code>{fn.signature ? `${fn.signature.returnType} ${fn.functionName}(${fn.signature.parameterTypes.join(", ") || "void"})` : fn.functionName}</code> <span className="muted">{fn.sourcePath}</span></label>)}</> : null}
    <ProgressDialog open={busy} title={copy.solution} progressLabel={copy.loading} cancelLabel={copy.cancel} onCancel={() => controller.current?.abort()} />
  </section>;
}

type Settings = { rows: Array<{ id: string; parentId: string | null; kind: string; title: string; depth: number; resourceId: string | null }>; selected: string[]; statuses: Record<string, { state: string; maxAgeHours?: number | null; error?: string }>; enabled: boolean; prepared: boolean; concurrency: number };
type Submission = { id: string; student: string; status: string; cancelled: boolean; processingError: string | null };
export function HomeworkTeacherWorkflow({ request, locale, hasUnsavedChanges }: { request: HomeworkRequest; locale: CodingHomeworkLocale; hasUnsavedChanges: boolean }) {
  const copy = homeworkWorkflowCopy(locale), dialogs = useDialogs();
  const [settings, setSettings] = useState<Settings | null>(null), [selected, setSelected] = useState<string[]>([]), [submissions, setSubmissions] = useState<Submission[]>([]);
  const [error, setError] = useState(""), [busy, setBusy] = useState<string | null>(null), [progress, setProgress] = useState<number | null>(null);
  const controller = useRef<AbortController | null>(null);
  const refresh = useCallback(async () => { const value = await request<Settings>("workflow-settings"); setSettings(value); setSelected(value.selected); }, [request]);
  const refreshSubmissions = useCallback(async () => { setSubmissions((await request<{ submissions: Submission[] }>("manage-submissions")).submissions); }, [request]);
  useEffect(() => { void Promise.all([refresh(), refreshSubmissions()]).catch(reason => setError(reason.message)); return () => controller.current?.abort(); }, [refresh, refreshSubmissions]);
  async function run(label: string, action: (signal: AbortSignal) => Promise<void>) { const pending = new AbortController(); controller.current = pending; setBusy(label); setProgress(null); setError(""); try { await action(pending.signal); } catch (reason) { if (!pending.signal.aborted) setError(reason instanceof Error ? reason.message : copy.error); } finally { controller.current = null; setBusy(null); await refresh().catch(() => {}); } }
  function idsForRow(row: Settings["rows"][number]) {
    if (row.resourceId) return [row.resourceId];
    const descendants = new Set([row.id]); const ids: string[] = [];
    for (const item of settings?.rows ?? []) if (item.parentId && descendants.has(item.parentId)) { descendants.add(item.id); if (item.resourceId) ids.push(item.resourceId); }
    return [...new Set(ids)];
  }
  const selectionChanged = Boolean(settings && JSON.stringify([...selected].sort()) !== JSON.stringify([...settings.selected].sort()));
  useUnsavedChangesGuard({ isDirty: selectionChanged, onDiscard: () => setSelected(settings?.selected ?? []), onSave: async () => { await request("workflow-settings", body("PUT", { selected })); await refresh(); } });
  return <section className="section stack"><h3>{copy.materials}</h3><p>{copy.materialHelp}</p>
    {error && <p className="error" role="alert">{error}</p>}
    {!settings && <p>{copy.loading}</p>}
    {settings?.rows.filter(row => row.kind === "folder" || row.resourceId).map(row => {
      const ids = idsForRow(row); const status = row.resourceId ? settings.statuses[row.resourceId] : null;
      const statusText = status?.state === "ready" ? copy.readyIndex : status?.state === "stale" ? copy.staleIndex : status?.state === "missing" ? copy.missingIndex : copy.unsupportedIndex;
      return <div key={row.id} style={{ marginInlineStart: `${Math.min(10, row.depth) * 1.25}rem` }}><label><input type="checkbox" disabled={settings.enabled || !ids.length} checked={ids.length > 0 && ids.every(id => selected.includes(id))} ref={input => { if (input) input.indeterminate = ids.some(id => selected.includes(id)) && !ids.every(id => selected.includes(id)); }} onChange={event => setSelected(current => event.target.checked ? [...new Set([...current, ...ids])] : current.filter(id => !ids.includes(id)))} /> {row.title}</label>{status && <span className="muted"> — {statusText}{status.maxAgeHours ? ` · ${copy.freshness}: ${status.maxAgeHours}` : ""}{status.error ? ` · ${status.error}` : ""}</span>}</div>;
    })}
    {!selected.length && <p className="muted">{copy.noMaterials}</p>}
    {settings && <>
      <label className="field">{copy.concurrency}<input type="number" min={1} max={4} value={settings.concurrency} onChange={event => { const concurrency = Number(event.target.value); if (concurrency >= 1 && concurrency <= 4) void run(copy.save, async signal => { await request("workflow-settings", body("PUT", { concurrency }, signal)); }); }} /></label>
      <p role="status">{settings.enabled ? copy.enabledHelp : settings.prepared && !selectionChanged ? copy.prepared : copy.needsPreparation}</p>
      {hasUnsavedChanges && <p className="muted">{copy.saveFirst}</p>}
      <div className="row">
        <button type="button" className="secondary" disabled={settings.enabled} onClick={() => void run(copy.preparing, async signal => {
          await request("workflow-settings", body("PUT", { selected }, signal));
          for (let index = 0; index < selected.length; index++) { signal.throwIfAborted(); await request("prepare-material", body("POST", { resourceId: selected[index] }, signal)); setProgress(Math.round(100 * (index + 1) / selected.length)); }
          signal.throwIfAborted(); await request("prepare-references", body("POST", undefined, signal));
        })}><ActionIcon name="generate" /> {copy.embeddings}</button>
        <button type="button" disabled={!settings.enabled && (hasUnsavedChanges || !settings.prepared || selectionChanged)} onClick={() => void run(copy.save, async signal => { await request("workflow-settings", body("PUT", { enabled: !settings.enabled }, signal)); })}><ActionIcon name={settings.enabled ? "close" : "check"} /> {settings.enabled ? copy.disable : copy.enabled}</button>
      </div>
    </>}
    <div className="row"><h3>{copy.management}</h3><button type="button" className="secondary" onClick={() => void refreshSubmissions().catch(reason => setError(reason.message))}><ActionIcon name="refresh" /> {copy.refresh}</button></div>
    {!submissions.length && <p>{copy.noSubmissions}</p>}
    <ul className="stack">{submissions.map(submission => <li key={submission.id}><div className="row"><strong>{submission.student}</strong><span>{homeworkStatusLabel(locale, submission.status)}</span>{!submission.cancelled && <button type="button" className="secondary" onClick={async () => {
      const reason = await dialogs.prompt({ title: copy.cancelSubmission, message: copy.cancelDetail, inputLabel: copy.cancelReason, required: true, maxLength: 2000, confirmLabel: copy.cancelSubmission });
      if (reason?.trim()) await run(copy.cancelSubmission, async signal => { await request("manage-submissions", body("DELETE", { submissionId: submission.id, reason }, signal)); await refreshSubmissions(); });
    }}><ActionIcon name="close" /> {copy.cancelSubmission}</button>}</div>{submission.processingError && <p className="error">{submission.processingError}</p>}</li>)}</ul>
    <ProgressDialog open={busy !== null} title={busy ?? copy.preparing} progressLabel={busy ?? copy.preparing} progress={progress} onCancel={() => controller.current?.abort()} cancelLabel={copy.cancel} />
  </section>;
}
