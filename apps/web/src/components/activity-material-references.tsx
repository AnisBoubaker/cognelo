"use client";
import { createPortal } from "react-dom";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ActivityMaterialReferencesView, MaterialReferenceRow } from "@cognelo/contracts";
import { ActionIcon, EditActionBar, ProgressDialog, getEditActionBarCopy, useNotifications, useUnsavedChangesGuard, type ActivityReferenceAuthoringState } from "@cognelo/activity-ui";
import { apiRequest } from "@/lib/api";
import { materialReferenceCopy } from "@/lib/material-reference-copy";
import { useContentFolders } from "@/lib/use-content-folders";
import { useAuth } from "@/components/auth-provider";
import { ActivityMaterialReferencePreview } from "./activity-material-reference-preview";

export function ActivityMaterialReferences({ courseId, activityId, locale, onStateChange, active = true }: { active?: boolean; courseId: string; activityId: string; locale: string; onStateChange: (state: ActivityReferenceAuthoringState) => void }) {
  const copy = materialReferenceCopy(locale), actions = getEditActionBarCopy(locale), notifications = useNotifications(), { user } = useAuth();
  const [data, setData] = useState<ActivityMaterialReferencesView | null>(null), [selected, setSelected] = useState<string[]>([]), [query, setQuery] = useState("");
  const [busy, setBusy] = useState<"save" | "prepare" | null>(null), [progress, setProgress] = useState<number | null>(null), [currentMaterial, setCurrentMaterial] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({}), [preview, setPreview] = useState<string | null>(null), [loadFailed, setLoadFailed] = useState(false);
  const draftDirty = useRef(false);
  const controller = useRef<AbortController | null>(null), loadVersion = useRef(0);
  const base = `/courses/${courseId}/activities/${activityId}/material-references`;
  const request = useCallback(<T,>(route: string, init?: RequestInit) => apiRequest<T>(route ? `${base}/${route}` : base, init), [base]);
  const refresh = useCallback(async (adopt = false) => {
    const version = ++loadVersion.current, value = await request<ActivityMaterialReferencesView>("");
    if (version !== loadVersion.current) return;
    setData(value); setLoadFailed(false);
    const valid = new Set(value.rows.flatMap(row => row.resourceId ? [row.resourceId] : []));
    setSelected(current => (adopt || !draftDirty.current ? value.selected : current).filter(id => valid.has(id)));
  }, [request]);
  const report = useCallback((error: unknown) => notifications.error(error instanceof Error ? error.message : copy.error), [notifications, copy.error]);
  useEffect(() => {
    const version = loadVersion;
    void refresh(true).catch(error => { setLoadFailed(true); report(error); });
    const focus = () => { if (!document.hidden && !controller.current) void refresh(false).catch(report); };
    window.addEventListener("focus", focus);
    return () => { version.current++; controller.current?.abort(); window.removeEventListener("focus", focus); };
  }, [refresh, report]);
  useEffect(() => { if (active) void refresh(false).catch(report); }, [active, refresh, report]);
  const dirty = Boolean(data && JSON.stringify([...selected].sort()) !== JSON.stringify([...data.selected].sort()));
  draftDirty.current = dirty;
  const selectedCount = data?.selected.length ?? 0;
  const loaded = Boolean(data), prepared = Boolean(data?.prepared && !dirty), referenceRevision = `${data?.revision ?? ""}:${data?.embedding.identity ?? ""}:${data?.prepared ?? false}`;
  useEffect(() => onStateChange({ loaded, dirty, prepared, selectedCount, revision: referenceRevision }), [loaded, dirty, prepared, selectedCount, referenceRevision, onStateChange]);
  const folders = useContentFolders({ storageKey: user ? `cognelo-reference-folders:${user.id}:${courseId}:${activityId}` : null, contentItems: data?.rows ?? [] });
  const byId = useMemo(() => new Map((data?.rows ?? []).map(row => [row.id, row])), [data?.rows]);
  const idsForRow = (row: MaterialReferenceRow) => {
    if (row.resourceId) return [row.resourceId];
    const parents = new Set([row.id]), ids: string[] = [];
    for (const child of data?.rows ?? []) if (child.parentId && parents.has(child.parentId)) { parents.add(child.id); if (child.resourceId) ids.push(child.resourceId); }
    return [...new Set(ids)];
  };
  const normalized = query.trim().toLocaleLowerCase(locale);
  const matched = new Set<string>();
  if (normalized) for (const row of data?.rows ?? []) if (row.title.toLocaleLowerCase(locale).includes(normalized)) {
    matched.add(row.id); let parent = row.parentId; while (parent && !matched.has(parent)) { matched.add(parent); parent = byId.get(parent)?.parentId ?? null; }
    if (row.kind === "folder") for (const child of data?.rows ?? []) { let ancestor = child.parentId; while (ancestor) { if (ancestor === row.id) { matched.add(child.id); break; } ancestor = byId.get(ancestor)?.parentId ?? null; } }
  }
  const visibleRows = (data?.rows ?? []).filter(row => {
    if (normalized) return matched.has(row.id);
    let parent = row.parentId; while (parent) { if (folders.collapsedFolderIds.has(parent)) return false; parent = byId.get(parent)?.parentId ?? null; }
    return true;
  });
  async function save() {
    if (!data || controller.current) throw new Error(actions.saving);
    const pending = new AbortController(); controller.current = pending; setBusy("save");
    try {
      const value = await request<ActivityMaterialReferencesView>("", { method: "PUT", body: JSON.stringify({ selected, revision: data.revision }), signal: pending.signal });
      setData(value); setSelected(value.selected);
    } catch (error) { if (!pending.signal.aborted) report(error); throw error; }
    finally { controller.current = null; setBusy(null); }
  }
  useUnsavedChangesGuard({ isDirty: dirty, onSave: save, onDiscard: () => setSelected(data?.selected ?? []) });
  async function prepare() {
    if (!data || dirty || controller.current) return;
    const pending = new AbortController(); controller.current = pending; setBusy("prepare"); setErrors({}); setProgress(null); setPreview(null);
    try {
      for (const [index, id] of data.selected.entries()) {
        pending.signal.throwIfAborted();
        const title = data.rows.find(row => row.resourceId === id)?.title ?? copy.title; setCurrentMaterial(title);
        try { await request("prepare-material", { method: "POST", body: JSON.stringify({ resourceId: id, revision: data.revision }), signal: pending.signal }); }
        catch (error) { if (pending.signal.aborted) throw error; const message = error instanceof Error ? error.message : copy.error; setErrors(current => ({ ...current, [id]: message })); throw new Error(`${title}: ${message}`); }
        setProgress(Math.round(100 * (index + 1) / data.selected.length));
      }
      pending.signal.throwIfAborted();
      const value = await request<ActivityMaterialReferencesView>("prepare", { method: "POST", body: JSON.stringify({ revision: data.revision }), signal: pending.signal }); setData(value); setSelected(value.selected);
    } catch (error) { if (!pending.signal.aborted) report(error); await refresh(false).catch(report); }
    finally { controller.current = null; setBusy(null); setCurrentMaterial(""); }
  }
  return <section className="section stack activity-reference-materials">
    <div><h3>{copy.title}</h3><p className="muted">{copy.help}</p></div>
    <div className="activity-reference-model row wrap"><div><strong>{copy.model}</strong><p>{data?.embedding.resolved?.model ?? copy.unavailable}</p>
      {data?.locked && data.embedding.preparedModel && data.embedding.preparedModel !== data.embedding.resolved?.model && <p className="muted">{copy.pinnedModel}: {data.embedding.preparedModel}</p>}</div>
      <a className="button secondary" href={`/courses/${courseId}?tab=settings&section=ai#material-embeddings`}><ActionIcon name="settings" />{copy.configure}</a></div>
    {data?.embedding.error && <p role="status">{data.embedding.error}</p>}
    {!data && <p role="status">{loadFailed ? copy.error : copy.loading}</p>}
    <div className="row wrap"><label className="field activity-reference-search">{copy.search}<input type="search" value={query} onChange={event => setQuery(event.currentTarget.value)} /></label>
      <button type="button" className="secondary" disabled={!data} onClick={folders.expandAllFolders}><ActionIcon name="down" />{copy.expand}</button><button type="button" className="secondary" disabled={!data} onClick={folders.collapseAllFolders}><ActionIcon name="up" />{copy.collapse}</button>
      <button type="button" className="secondary" disabled={Boolean(busy)} onClick={() => void refresh(!data).catch(report)}><ActionIcon name="refresh" />{copy.refresh}</button></div>
    <p className="muted">{copy.selected.replace("{count}", String(selected.length))}</p>
    {data?.locked && <p role="status">{copy.locked}</p>}
    <div className="activity-reference-tree">{visibleRows.map(row => {
      const ids = idsForRow(row), checked = ids.length > 0 && ids.every(id => selected.includes(id)), partial = !checked && ids.some(id => selected.includes(id));
      const status = row.resourceId ? data?.statuses[row.resourceId] : undefined, error = row.resourceId ? errors[row.resourceId] : undefined;
      const label = error ? copy.unsupported : status?.state === "ready" ? copy.ready : status?.state === "stale" ? copy.stale : status?.state === "missing" ? copy.missing : status?.state === "needs_model" ? copy.modelRequired : copy.unsupported;
      const hasPreview = Boolean(row.resourceId && (status?.index || (data?.prepared && data.selected.includes(row.resourceId))));
      return <div key={row.id} className={`activity-reference-entry${row.kind === "folder" ? " is-folder" : ""}`} style={{ "--reference-depth": Math.min(8, row.depth) } as React.CSSProperties}>
        <div className="activity-reference-row">
          {row.kind === "folder" ? <button type="button" className="secondary icon-button" aria-label={row.title} aria-expanded={!folders.collapsedFolderIds.has(row.id) || Boolean(normalized)} onClick={() => folders.toggleFolder(row.id)}><ActionIcon name={folders.collapsedFolderIds.has(row.id) ? "folder" : "folderOpen"} /></button> : <span className="activity-reference-indent" aria-hidden="true" />}
          <label className="activity-reference-choice"><input type="checkbox" aria-label={row.title} aria-describedby={row.hidden ? "reference-hidden-" + row.id : undefined} disabled={data?.locked || Boolean(busy) || !ids.length} checked={checked} ref={element => { if (element) element.indeterminate = partial; }} onChange={event => { const checked = event.currentTarget.checked; setSelected(current => checked ? [...new Set([...current, ...ids])] : current.filter(id => !ids.includes(id))); }} /><span>{row.title}{row.hidden && <small id={"reference-hidden-" + row.id}>{copy.hidden}</small>}</span></label>
          {status && <span className={`metadata-badge ${status.state === "ready" && !error ? "is-success" : "is-warning"}`}>{label}</span>}
          {hasPreview && <button type="button" className="secondary icon-button" title={copy.preview} aria-label={`${copy.preview}: ${row.title}`} aria-expanded={preview === row.resourceId} onClick={() => setPreview(current => current === row.resourceId ? null : row.resourceId)}><ActionIcon name="visible" /></button>}
        </div>
        {(error || status?.error) && <p className="error">{error ?? status?.error}</p>}
        {row.resourceId && preview === row.resourceId && <ActivityMaterialReferencePreview id={`reference-preview-${row.id}`} resourceId={row.resourceId} request={request} locale={locale} onClose={() => setPreview(null)} />}
      </div>;
    })}</div>
    {data && !visibleRows.length && <p>{copy.empty}</p>}
    <p className="muted">{copy.archiveHelp}</p>
    <div className="row wrap"><button type="button" disabled={!data || data.locked || dirty || Boolean(busy) || (!data.embedding.resolved && selected.length > 0)} onClick={() => void prepare()}><ActionIcon name="generate" />{copy.prepare}</button><p role="status">{dirty ? copy.saveFirst : data?.prepared ? copy.prepared : copy.needsPreparation}</p></div>
    <EditActionBar isDirty={dirty} isSaving={busy === "save"} saveDisabled={Boolean(data?.locked || busy === "prepare")} savedLabel={actions.saved} unsavedLabel={actions.unsaved} saveLabel={actions.save} savingLabel={actions.saving} cancelLabel={actions.cancel} onCancel={() => setSelected(data?.selected ?? [])} onSave={() => void save().catch(() => {})} />
    {busy === "prepare" && createPortal(<ProgressDialog open title={copy.preparing} progressLabel={currentMaterial || copy.preparing} progress={progress} cancelLabel={actions.cancel} onCancel={() => controller.current?.abort()} />, document.body)}
  </section>;
}
