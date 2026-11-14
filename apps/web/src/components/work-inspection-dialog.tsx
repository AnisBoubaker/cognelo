"use client";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { AppDateTime, CodeRenderer, DialogHeader, MarkdownRenderer, SideNavigation, sideNavigationItemId, useBodyScrollLock, useNotifications } from "@cognelo/activity-ui";
import type { WorkInspection, WorkInspectionBlock, WorkInspectionFile } from "@cognelo/contracts";
import { api, type CourseGradebookRow } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { AppIcon } from "./app-icon";

type FileBlock = Extract<WorkInspectionBlock, { kind: "file" }>;
function InspectionFiles({ files, read }: { files: FileBlock[]; read: (key: string, signal: AbortSignal) => Promise<WorkInspectionFile> }) {
  const { t } = useI18n(), notifications = useNotifications(), id = useId();
  const [selection, setSelection] = useState(files[0]?.path ?? ""), [retry, setRetry] = useState(0);
  const selected = files.find(file => file.path === selection) ?? files[0];
  const selectedKey = selected?.key;
  const [visible, setVisible] = useState<{ key: string; file?: WorkInspectionFile; error?: string } | null>(null);
  useEffect(() => {
    if (!selectedKey) return;
    const controller = new AbortController(); setVisible(null);
    void read(selectedKey, controller.signal).then(file => { if (!controller.signal.aborted) setVisible({ key: selectedKey, file }); })
      .catch(error => { if (!controller.signal.aborted) { const message = error instanceof Error ? error.message : t("workInspection.loadError"); setVisible({ key: selectedKey, error: message }); notifications.error(message); } });
    return () => controller.abort();
  }, [selectedKey, read, retry, notifications, t]);
  if (!selected) return null;
  const current = visible?.key === selected.key ? visible : null, panelId = `${id}-panel`;
  return <div className="settings-layout work-inspection-files">
    <SideNavigation ariaLabel={t("workInspection.files")} items={files.map(file => ({ id: file.path, label: file.path, isActive: file.path === selected.path }))} tabs={{ idPrefix: id, panelId, onSelect: setSelection }} />
    <section role="tabpanel" tabIndex={0} id={panelId} aria-labelledby={sideNavigationItemId(id, selected.path)} className="stack">
      {!current ? <p role="status">{t("common.loading")}</p> : null}
      {current?.error ? <div><p role="alert" className="error">{current.error}</p><button className="secondary" type="button" onClick={() => setRetry(value => value + 1)}>{t("workInspection.retry")}</button></div> : null}
      {current?.file ? <><CodeRenderer code={current.file.text} language={selected.language ?? "text"} showLineNumbers />{current.file.truncated ? <p className="muted">{t("workInspection.truncated")}</p> : null}</> : null}
    </section>
  </div>;
}

export function WorkInspectionDialog({ courseId, row, onClose }: { courseId: string; row: CourseGradebookRow; onClose: () => void }) {
  const { locale, t } = useI18n(), notifications = useNotifications();
  const [snapshot, setSnapshot] = useState<WorkInspection | null>(null), [loading, setLoading] = useState(false), [error, setError] = useState("");
  const [itemId, setItemId] = useState<string | undefined>();
  const request = useRef<AbortController | null>(null), panel = useRef<HTMLElement | null>(null), id = useId();
  const closeButton = useRef<HTMLButtonElement | null>(null);
  useBodyScrollLock(true);
  useEffect(() => {
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !event.defaultPrevented && (document.activeElement === document.body || panel.current?.contains(document.activeElement))) { event.preventDefault(); onClose(); }
    };
    document.addEventListener("keydown", escape);
    return () => document.removeEventListener("keydown", escape);
  }, [onClose]);
  const load = useCallback(async () => {
    request.current?.abort(); const controller = new AbortController(); request.current = controller; setLoading(true); setError("");
    try { const result = await api.inspectActivityWork(courseId, row.activityId, row.groupId, row.participantId, itemId, controller.signal); if (!controller.signal.aborted) setSnapshot(result); }
    catch (failure) { if (!controller.signal.aborted) { const message = failure instanceof Error ? failure.message : t("workInspection.loadError"); setError(message); notifications.error(message); } }
    finally { if (request.current === controller) { setLoading(false); if (document.activeElement === document.body) closeButton.current?.focus(); } }
  }, [courseId, row.activityId, row.groupId, row.participantId, itemId, notifications, t]);
  useEffect(() => { setSnapshot(previous => previous ? { ...previous, sections: [], savedAt: null } : null); void load(); return () => request.current?.abort(); }, [load]);
  const readFile = useCallback((key: string, signal: AbortSignal) => api.inspectActivityWorkFile(courseId, row.activityId, row.groupId, row.participantId, key, signal), [courseId, row.activityId, row.groupId, row.participantId]);
  return <div className="dialog-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <section ref={panel} className="dialog-panel stack work-inspection-dialog" role="dialog" aria-modal="true" aria-labelledby={`${id}-title`} onKeyDown={event => {
      if (event.key === "Escape") { event.preventDefault(); onClose(); }
      if (event.key === "Tab") {
        const controls = panel.current?.querySelectorAll<HTMLElement>('button:not(:disabled),select:not(:disabled),a[href],input:not(:disabled),textarea:not(:disabled),[tabindex="0"]');
        if (!controls?.length) return;
        const first = controls[0], last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    }}>
      <DialogHeader closeLabel={t("common.close")} onClose={onClose} closeButtonRef={closeButton} autoFocusClose actions={<button className="secondary" type="button" disabled={loading} onClick={() => void load()}><AppIcon name="refresh" />{t("workInspection.refresh")}</button>}>
        <h2 id={`${id}-title`}>{t("workInspection.title")}</h2><p>{snapshot?.participantName ?? row.participantName} · {snapshot?.groupTitle ?? row.groupTitle}</p>
      </DialogHeader>
      <p className="muted">{t("workInspection.savedOnly")}</p>
      {snapshot?.attemptNumber ? <p>{t("activityLogs.attempt", { number: snapshot.attemptNumber })}</p> : null}
      {snapshot?.savedAt ? <p className="muted">{t("workInspection.savedAt")} <AppDateTime value={snapshot.savedAt} locale={locale} options={{ dateStyle: "medium", timeStyle: "medium" }} /></p> : null}
      {snapshot?.items?.length ? <div className="field"><label htmlFor={`${id}-question`}>{t("workInspection.question")}</label><select id={`${id}-question`} value={itemId ?? snapshot.selectedItemId} onChange={event => setItemId(event.target.value)}>{snapshot.items.map((item, index) => <option key={item.id} value={item.id}>{index + 1}. {item.title}</option>)}</select></div> : null}
      {loading ? <p role="status">{t("common.loading")}</p> : null}
      {error ? <p role="alert" className="error">{error}</p> : null}
      {!loading && snapshot?.sections.length === 0 ? <p className="muted">{t("workInspection.empty")}</p> : null}
      {snapshot?.sections.map(section => <section className="stack work-inspection-section" key={section.id}>
        {section.title ? <h3>{section.title}</h3> : null}
        {section.blocks.filter(block => block.kind !== "file").map((block, index) => block.kind === "code" ? <CodeRenderer key={index} code={block.text} language={block.language ?? "text"} showLineNumbers />
          : block.kind === "markdown" ? <MarkdownRenderer key={index} markdown={block.text} /> : block.kind === "text" ? <p key={index} className="work-inspection-answer">{block.text || t("workInspection.noAnswer")}</p> : null)}
        {section.blocks.some(block => block.kind === "file") ? <InspectionFiles files={section.blocks.filter((block): block is FileBlock => block.kind === "file")} read={readFile} /> : null}
      </section>)}
    </section>
  </div>;
}
