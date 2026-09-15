"use client";

import { type FormEvent, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

export type ImageEditorCopy = {
  eyebrow: string;
  addTitle: string;
  editTitle: string;
  help: string;
  file: string;
  replaceFile: string;
  altText: string;
  altHelp: string;
  optionalTitle: string;
  preview: string;
  requiredFile: string;
  requiredAlt: string;
  cancel: string;
  insert: string;
  update: string;
  remove: string;
  close: string;
};

export type ImageEditorDialogProps = {
  copy: ImageEditorCopy;
  initialAlt?: string;
  initialSrc?: string;
  initialTitle?: string;
  mode: "add" | "edit";
  onCancel: () => void;
  onConfirm: (value: { alt: string; file: File | null; title: string }) => Promise<void>;
  onRemove?: () => void;
};

export function ImageEditorDialog({
  copy,
  initialAlt = "",
  initialSrc = "",
  initialTitle = "",
  mode,
  onCancel,
  onConfirm,
  onRemove
}: ImageEditorDialogProps) {
  const [alt, setAlt] = useState(initialAlt);
  const [title, setTitle] = useState(initialTitle);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const selectedPreview = useMemo(() => file ? URL.createObjectURL(file) : "", [file]);
  const preview = selectedPreview || initialSrc;

  useEffect(() => () => {
    if (selectedPreview) URL.revokeObjectURL(selectedPreview);
  }, [selectedPreview]);

  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape" && !busy) {
        event.preventDefault();
        onCancel();
      }
    }
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [busy, onCancel]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    event.stopPropagation();
    if (mode === "add" && !file) {
      setError(copy.requiredFile);
      return;
    }
    if (!alt.trim()) {
      setError(copy.requiredAlt);
      return;
    }
    setBusy(true);
    setError("");
    try {
      await onConfirm({ alt: alt.trim(), file, title: title.trim() });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Upload failed.");
      setBusy(false);
    }
  }

  return createPortal(
    <div className="dialog-backdrop image-editor-backdrop" role="presentation" onMouseDown={busy ? undefined : onCancel}>
      <form
        aria-labelledby="image-editor-title"
        aria-modal="true"
        className="dialog-panel image-editor-dialog"
        role="dialog"
        onMouseDown={(event) => event.stopPropagation()}
        onSubmit={submit}
      >
        <div className="section-heading image-editor-heading">
          <div>
            <p className="eyebrow">{copy.eyebrow}</p>
            <h2 id="image-editor-title">{mode === "add" ? copy.addTitle : copy.editTitle}</h2>
            <p className="muted">{copy.help}</p>
          </div>
          <button aria-label={copy.close} className="secondary icon-button" disabled={busy} type="button" onClick={onCancel}>×</button>
        </div>

        <div className="image-editor-layout">
          <div className="stack stack-tight">
            <label className="field">
              <span>{mode === "add" ? copy.file : copy.replaceFile}</span>
              <input
                accept="image/png,image/jpeg,image/gif,image/webp"
                autoFocus={mode === "add"}
                disabled={busy}
                type="file"
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              />
            </label>
            <label className="field">
              <span>{copy.altText}</span>
              <input
                autoFocus={mode === "edit"}
                disabled={busy}
                type="text"
                value={alt}
                onChange={(event) => setAlt(event.target.value)}
              />
              <small className="muted">{copy.altHelp}</small>
            </label>
            <label className="field">
              <span>{copy.optionalTitle}</span>
              <input disabled={busy} type="text" value={title} onChange={(event) => setTitle(event.target.value)} />
            </label>
          </div>

          <div className="image-editor-preview" aria-label={copy.preview}>
            {/* The source is a local object URL or an authenticated media route; Next Image cannot optimize either reliably. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {preview ? <img alt={alt || ""} src={preview} /> : <span className="muted">{copy.preview}</span>}
          </div>
        </div>

        {error ? <p className="form-error" role="alert">{error}</p> : null}

        <div className="dialog-actions image-editor-actions">
          {onRemove ? <button className="danger-button" disabled={busy} type="button" onClick={onRemove}>{copy.remove}</button> : null}
          <span />
          <button className="secondary" disabled={busy} type="button" onClick={onCancel}>{copy.cancel}</button>
          <button disabled={busy} type="submit">{mode === "add" ? copy.insert : copy.update}</button>
        </div>
      </form>
    </div>,
    document.body
  );
}
