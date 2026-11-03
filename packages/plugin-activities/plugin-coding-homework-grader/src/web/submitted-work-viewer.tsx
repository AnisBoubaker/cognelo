"use client";
import { useEffect, useId, useState } from "react";
import { CodeRenderer, SideNavigation, sideNavigationItemId, isActivityContentClosedError, useNotifications } from "@cognelo/activity-ui";
import type { CodingHomeworkLocale } from "./messages";
import { homeworkWorkflowCopy } from "./workflow-copy";
import type { HomeworkRequest } from "./workflow-types";

type FilePreview = { path: string; text?: string; error?: string };
export function SubmittedWorkViewer({ files, request, locale }: {
  files: Array<{ path: string; sizeBytes: number }>;
  request: HomeworkRequest;
  locale: CodingHomeworkLocale;
}) {
  const copy = homeworkWorkflowCopy(locale);
  const notifications = useNotifications();
  const id = useId();
  const [selection, setSelection] = useState(files[0]?.path ?? "");
  const selected = files.find(file => file.path === selection) ?? files[0];
  const selectedPath = selected?.path;
  const [preview, setPreview] = useState<FilePreview | null>(null);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!selectedPath) return;
    const pending = new AbortController();
    setPreview({ path: selectedPath });
    void request<{ path: string; text: string }>(`submitted-file?path=${encodeURIComponent(selectedPath)}`, { signal: pending.signal }).then(result => {
      if (!pending.signal.aborted) setPreview({ path: selectedPath, text: result.text });
    }).catch(reason => {
      if (pending.signal.aborted) return;
      const message = reason instanceof Error ? reason.message : copy.error;
      setPreview({ path: selectedPath, error: message });
      if (!isActivityContentClosedError(reason)) notifications.error(`${selectedPath}: ${message}`);
    });
    return () => pending.abort();
  }, [selectedPath, request, retry, copy.error, notifications]);
  if (!selected) return <p className="muted">{copy.empty}</p>;
  const visible = preview?.path === selected.path ? preview : null;
  const loading = !visible || (visible.text === undefined && !visible.error);
  const panelId = `${id}-panel`;
  return <div className="settings-layout homework-submitted-files">
    <SideNavigation ariaLabel={copy.submittedFiles} items={files.map(file => ({ id: file.path, label: file.path, isActive: file.path === selected.path }))}
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
