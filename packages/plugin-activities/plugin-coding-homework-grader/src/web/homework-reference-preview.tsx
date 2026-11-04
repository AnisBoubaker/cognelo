"use client";
import { useEffect, useRef, useState } from "react";
import { ActionIcon, useNotifications } from "@cognelo/activity-ui";
import type { CodingHomeworkLocale } from "./messages";
import { homeworkWorkflowCopy } from "./workflow-copy";
import type { HomeworkRequest } from "./workflow-types";

type Preview = { indexId: string; title: string; prepared: boolean; offset: number; total: number; nextOffset: number | null; passages: Array<{ number: number; title: string; text: string }> };
export function HomeworkReferencePreview({ id, resourceId, request, locale, onClose }: { id: string; resourceId: string; request: HomeworkRequest; locale: CodingHomeworkLocale; onClose: () => void }) {
  const copy = homeworkWorkflowCopy(locale), notifications = useNotifications();
  const passages = useRef<HTMLDivElement | null>(null);
  const [page, setPage] = useState<{ offset: number; indexId?: string; retry?: number }>({ offset: 0 });
  const [value, setValue] = useState<Preview | null>(null), [failed, setFailed] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    setValue(null); setFailed(false);
    const params = new URLSearchParams({ resourceId, offset: String(page.offset), ...(page.indexId ? { indexId: page.indexId } : {}) });
    void request<Preview>(`reference-preview?${params}`, { signal: controller.signal }).then(result => {
      if (!controller.signal.aborted) {
        setValue(result);
        requestAnimationFrame(() => { if (!controller.signal.aborted) passages.current?.focus({ preventScroll: true }); });
      }
    }).catch(error => {
      if (!controller.signal.aborted) { setFailed(true); notifications.error(error instanceof Error ? error.message : copy.indexPreviewUnavailable); }
    });
    return () => controller.abort();
  }, [copy.indexPreviewUnavailable, notifications, page, request, resourceId]);
  return <section id={id} className="section stack homework-reference-preview" aria-label={copy.indexedText}>
    <div className="row wrap"><h4>{copy.indexedText}{value ? ` · ${value.title}` : ""}</h4><button className="secondary" type="button" onClick={onClose}><ActionIcon name="close" /> {copy.close}</button></div>
    <p className="muted">{copy.indexPreviewHelp}</p>
    {!value && !failed && <p role="status">{copy.loading}</p>}
    {failed && <div className="row wrap"><p role="status">{copy.indexPreviewUnavailable}</p><button type="button" className="secondary" onClick={() => setPage({ offset: 0, retry: Date.now() })}><ActionIcon name="refresh" /> {copy.retry}</button></div>}
    {value && <>
      <p>{value.prepared ? copy.indexPreviewPrepared : copy.indexPreviewLatest}</p>
      <p role="status">{copy.indexPreviewRange.replace("{from}", String(value.offset + 1)).replace("{to}", String(value.offset + value.passages.length)).replace("{total}", String(value.total))}</p>
      <div ref={passages} tabIndex={0} aria-label={copy.indexedText} style={{ maxHeight: "28rem", overflow: "auto" }}>
        {value.passages.map(passage => <section key={passage.number} className="inline-panel"><h5>{passage.number}. {passage.title}</h5><pre style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{passage.text}</pre></section>)}
      </div>
      <div className="row wrap">
        <button type="button" className="secondary" disabled={value.offset === 0} onClick={() => setPage({ offset: Math.max(0, value.offset - 10), indexId: value.indexId })}><ActionIcon name="back" /> {copy.indexPreviewPrevious}</button>
        <button type="button" className="secondary" disabled={value.nextOffset === null} onClick={() => { if (value.nextOffset !== null) setPage({ offset: value.nextOffset, indexId: value.indexId }); }}><ActionIcon name="next" /> {copy.indexPreviewNext}</button>
      </div>
    </>}
  </section>;
}
