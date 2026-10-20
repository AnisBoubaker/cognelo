"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useBodyScrollLock } from "@cognelo/activity-ui";
import type { ContentTypeDefinition } from "@cognelo/content-type-sdk";
import type { CourseContentResource } from "@/lib/api";
import { resolveContentResourcePresentation, resolveContentTypeRenderer } from "@/lib/content-type-renderers";
import { useI18n } from "@/lib/i18n";

export type ResourceDisplayProps = { resource?: CourseContentResource | null; definition?: ContentTypeDefinition | null };
export function ContentResourceBody({ resource, definition }: ResourceDisplayProps) {
  const { locale, t } = useI18n();
  const renderer = resolveContentTypeRenderer(definition?.rendererKey);
  if (!resource || !definition || !renderer) return null;
  return <>{renderer({ resource, definition, locale, t })}</>;
}
export function ContentResourceInline(props: ResourceDisplayProps) {
  if (resolveContentResourcePresentation(props.definition, props.resource)?.displayMode !== "inline") return null;
  return <div className="content-resource-body"><ContentResourceBody {...props} /></div>;
}
export function ContentResourceModalTitle({ resource, definition, title }: ResourceDisplayProps & { title: string }) {
  const [open, setOpen] = useState(false);
  return <><button className="content-resource-title-button" type="button" onClick={() => setOpen(true)}>{title}</button>
    {open ? <ResourceModal resource={resource} definition={definition} title={title} onClose={() => setOpen(false)} /> : null}
  </>;
}
function ResourceModal({ title, onClose, ...props }: ResourceDisplayProps & { title: string; onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const id = useId();
  const { t } = useI18n();
  useBodyScrollLock(true);
  useEffect(() => {
    const dialog = dialogRef.current!;
    const focused = document.activeElement as HTMLElement | null;
    dialog.showModal();
    return () => { dialog.close(); focused?.focus(); };
  }, []);
  return createPortal(<dialog ref={dialogRef} className="content-resource-dialog" aria-labelledby={id} onCancel={(event) => { event.preventDefault(); onClose(); }} onClose={() => { if (!dialogRef.current?.open) onClose(); }} onClick={(event) => {
    if (event.target !== event.currentTarget) return;
    const rect = event.currentTarget.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) onClose();
  }}>
    <div className="row content-resource-dialog-header"><h2 id={id}>{title}</h2><button type="button" className="secondary" onClick={onClose} autoFocus>{t("common.close")}</button></div>
    <ContentResourceBody {...props} />
  </dialog>, document.body);
}
