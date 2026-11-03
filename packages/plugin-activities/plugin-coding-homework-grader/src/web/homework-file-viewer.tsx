"use client";
import { useEffect, useId, useRef, useState } from "react";
import { CodeRenderer, SideNavigation, sideNavigationItemId, isActivityContentClosedError, useNotifications } from "@cognelo/activity-ui";
import type { CodingHomeworkLocale } from "./messages";
import { homeworkWorkflowCopy } from "./workflow-copy";
import type { HomeworkRequest } from "./workflow-types";

type FilePreview = { path: string; revision?: number; text?: string; error?: string };
export type HomeworkFileReader = (path: string, signal: AbortSignal) => Promise<{ path: string; text: string }>;
export function HomeworkFileViewer({ files, request, readFile, locale, submitted, revision, onDelete, busy }: {
  files: Array<{ path: string; sizeBytes: number }>;
  locale: CodingHomeworkLocale;
  submitted: boolean; revision?: number; onDelete?: (path: string) => Promise<void>; busy?: boolean;
} & ({ request: HomeworkRequest; readFile?: never } | { request?: never; readFile: HomeworkFileReader })) {
  const copy = homeworkWorkflowCopy(locale);
  const notifications = useNotifications();
  const id = useId();
  const viewer = useRef<HTMLDivElement | null>(null);
  const [selection, setSelection] = useState(files[0]?.path ?? "");
  const selected = files.find(file => file.path === selection) ?? files[0];
  const selectedPath = selected?.path;
  useEffect(() => { if (selection !== (selectedPath ?? "")) setSelection(selectedPath ?? ""); }, [selectedPath, selection]);
  const [preview, setPreview] = useState<FilePreview | null>(null);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!selectedPath) return;
    const pending = new AbortController();
    setPreview({ path: selectedPath, revision });
    const loadingFile = readFile ? readFile(selectedPath, pending.signal) : request<{ path: string; text: string }>(`${submitted ? "submitted-file" : "prepared-file"}?path=${encodeURIComponent(selectedPath)}`, { signal: pending.signal });
    void loadingFile.then(result => {
      if (!pending.signal.aborted) setPreview({ path: selectedPath, revision, text: result.text });
    }).catch(reason => {
      if (pending.signal.aborted) return;
      const message = reason instanceof Error ? reason.message : copy.error;
      setPreview({ path: selectedPath, revision, error: message });
      if (!isActivityContentClosedError(reason)) notifications.error(`${selectedPath}: ${message}`);
    });
    return () => pending.abort();
  }, [selectedPath, request, readFile, retry, copy.error, notifications, revision, submitted]);
  if (!selected) return <p className="muted">{copy.empty}</p>;
  const visible = preview?.path === selected.path && preview.revision === revision ? preview : null;
  const loading = !visible || (visible.text === undefined && !visible.error);
  const panelId = `${id}-panel`;
  return <div ref={viewer} className={`settings-layout homework-submitted-files${onDelete ? " has-file-actions" : ""}`}>
    <SideNavigation ariaLabel={submitted ? copy.submittedFiles : copy.preparedFiles} items={files.map(file => ({ id: file.path, label: file.path, isActive: file.path === selected.path, ...(!submitted && onDelete ? { action: { label: `${copy.removeFile}: ${file.path}`, disabled: busy, onClick: () => { void onDelete(file.path).then(() => viewer.current?.querySelector<HTMLButtonElement>('[role="tab"][aria-selected="true"]')?.focus()); } } } : {}) }))}
      tabs={{ idPrefix: id, panelId, onSelect: setSelection }} />
    <section id={panelId} role="tabpanel" aria-labelledby={sideNavigationItemId(id, selected.path)} tabIndex={0} aria-busy={loading} className="stack homework-submitted-file-panel">
      {loading && <p role="status" className="muted">{copy.loading}</p>}
      {visible?.error && <div className="stack"><p role="alert" className="error">{visible.error}</p><button type="button" className="secondary" onClick={() => setRetry(value => value + 1)}>{copy.retry}</button></div>}
      {visible?.text !== undefined && <div className="homework-submitted-file-content">
        {visible.text ? <CodeRenderer code={visible.text} language={/\.(c|h)$/i.test(selected.path) ? "c" : "text"} showLineNumbers /> : <p className="muted">{copy.emptyFile}</p>}
      </div>}
    </section>
  </div>;
}
