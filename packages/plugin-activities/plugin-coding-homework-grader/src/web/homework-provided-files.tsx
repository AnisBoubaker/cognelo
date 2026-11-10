"use client";
import { useCallback, useEffect, useRef, useState, type ChangeEvent } from "react";
import { createPortal } from "react-dom";
import { ActionIcon, HelpLabel, ProgressDialog, useDialogs, useNotifications } from "@cognelo/activity-ui";
import { HomeworkFileViewer, type HomeworkFileReader } from "./homework-file-viewer";
import { providedFilesCopy } from "./provided-files-copy";
import { codingHomeworkMessages, type CodingHomeworkLocale } from "./messages";
import { homeworkWorkflowCopy } from "./workflow-copy";
import { body, homeworkFileBase64, type HomeworkRequest } from "./workflow-types";

type Workspace = { revision: string; files: Array<{ path: string; sizeBytes: number }> };
const route = "provided-files-workspace";
export function HomeworkProvidedFiles({ request, locale, disabled }: { request: HomeworkRequest; locale: CodingHomeworkLocale; disabled: boolean }) {
  const copy = providedFilesCopy(locale), common = homeworkWorkflowCopy(locale), activityCopy = codingHomeworkMessages[locale];
  const dialogs = useDialogs(), notifications = useNotifications();
  const [workspace, setWorkspace] = useState<Workspace | null>(null), [busy, setBusy] = useState(false), [running, setRunning] = useState(false), [loadFailed, setLoadFailed] = useState(false), [reload, setReload] = useState(0);
  const operation = useRef<AbortController | null>(null), mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; operation.current?.abort(); };
  }, []);
  useEffect(() => {
    const pending = new AbortController(); setWorkspace(null); setLoadFailed(false);
    void request<Workspace>(route, { signal: pending.signal }).then(next => { if (!pending.signal.aborted) setWorkspace(next); }).catch(reason => {
      if (!pending.signal.aborted) { setLoadFailed(true); notifications.error(reason instanceof Error ? reason.message : common.error); }
    });
    return () => pending.abort();
  }, [request, notifications, common.error, reload]);

  const readFile = useCallback<HomeworkFileReader>((filePath, signal) => request(`${route}?${new URLSearchParams({ path: filePath, revision: workspace?.revision ?? "" })}`, { signal }), [request, workspace?.revision]);

  async function change(confirm: () => Promise<boolean>, action: (signal: AbortSignal) => Promise<Workspace>) {
    if (operation.current || disabled || !workspace) return;
    const pending = new AbortController(); operation.current = pending; setBusy(true);
    try {
      if (!await confirm() || pending.signal.aborted) return;
      setRunning(true);
      const next = await action(pending.signal);
      if (mounted.current && !pending.signal.aborted) { setWorkspace(next); notifications.success(copy.saved); }
    } catch (reason) {
      if (mounted.current && !pending.signal.aborted) notifications.error(reason instanceof Error ? reason.message : common.error);
    } finally {
      // A request can complete just before cancellation. Reconcile the authoritative collection.
      if (mounted.current) {
        try { const next = await request<Workspace>(route); if (mounted.current) { setWorkspace(next); setLoadFailed(false); } }
        catch { if (mounted.current) setLoadFailed(true); }
        if (mounted.current) { setBusy(false); setRunning(false); }
      }
      if (operation.current === pending) operation.current = null;
    }
  }
  function upload(event: ChangeEvent<HTMLInputElement>, zip: boolean) {
    const files = Array.from(event.currentTarget.files ?? []); event.currentTarget.value = "";
    if (!files.length || !workspace) return;
    if (files.length > 1000 || files.reduce((sum, file) => sum + file.size, 0) > 25 * 1024 * 1024) { notifications.error(copy.limit); return; }
    const existing = new Set(workspace.files.map(file => file.path.normalize("NFC").toLowerCase()));
    const replacing = files.filter(file => existing.has(file.name.normalize("NFC").toLowerCase()));
    void change(async () => !workspace.files.length || (!zip && !replacing.length) || dialogs.confirm({ title: copy.replaceTitle, confirmLabel: common.confirm, message: zip ? copy.replaceZip : <>{copy.replaceFiles}<ul>{replacing.map(file => <li key={file.name}>{file.name}</li>)}</ul></> }), async signal => {
      const inputs = await Promise.all(files.map(async file => ({ fileName: file.name, mimeType: file.type, base64: await homeworkFileBase64(file) })));
      signal.throwIfAborted();
      return request<Workspace>(route, body("POST", { files: inputs, replaceAll: zip, expectedRevision: workspace.revision }, signal));
    });
  }
  const remove = async (filePath?: string) => change(() => dialogs.confirm({ title: filePath ? copy.removeTitle : common.removeAllFiles, confirmLabel: filePath ? common.removeFile : common.removeAllFiles, confirmVariant: "danger", message: filePath ? copy.removeFile.replace("{path}", filePath) : copy.removeAll }), signal => request<Workspace>(route, body("DELETE", { expectedRevision: workspace!.revision, ...(filePath ? { path: filePath } : { all: true }) }, signal)));
  const blocked = disabled || busy || !workspace;
  return <section className="stack homework-provided-files">
    <HelpLabel help={copy.help}><h3>{activityCopy.providedFiles}</h3></HelpLabel>
    <div className="inline-actions">
      <label className="button secondary" aria-disabled={blocked}><ActionIcon name="upload" />{common.upload}<input multiple hidden type="file" disabled={blocked} onChange={event => upload(event, false)} /></label>
      <label className="button secondary" aria-disabled={blocked}><ActionIcon name="upload" />{common.zip}<input accept=".zip,application/zip" hidden type="file" disabled={blocked} onChange={event => upload(event, true)} /></label>
      <button type="button" disabled={blocked || !workspace?.files.length} onClick={() => void remove()}><ActionIcon name="remove" />{common.removeAllFiles}</button>
      {loadFailed && <button type="button" disabled={busy} onClick={() => setReload(value => value + 1)}><ActionIcon name="refresh" />{common.retry}</button>}
    </div>
    {!workspace && !loadFailed && <p role="status">{common.loading}</p>}
    {workspace && (workspace.files.length ? <HomeworkFileViewer files={workspace.files} readFile={readFile} locale={locale} submitted={false} revision={workspace.revision} onDelete={remove} busy={blocked} ariaLabel={activityCopy.providedFiles} previewUnavailableLabel={copy.previewUnavailable} /> : <p className="muted">{copy.empty}</p>)}
    {typeof document !== "undefined" && createPortal(<ProgressDialog open={running} title={activityCopy.providedFiles} progressLabel={common.loading} cancelLabel={common.cancel} onCancel={() => operation.current?.abort()} />, document.body)}
  </section>;
}
