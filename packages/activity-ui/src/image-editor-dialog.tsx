"use client";

/* eslint-disable @next/next/no-img-element -- Preview sources are local object URLs or authenticated media routes that Next Image cannot optimize reliably. */

import { type FormEvent, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import type { MarkdownImageSize, MarkdownImageSizeMode } from "./image-sizing";

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
  sizeMode: string;
  sizePixels: string;
  sizeOriginalPercent: string;
  sizeContainerPercent: string;
  sizeValuePixels: string;
  sizeValueOriginalPercent: string;
  sizeValueContainerPercent: string;
  sizeInvalidPixels: string;
  sizeInvalidOriginalPercent: string;
  sizeInvalidContainerPercent: string;
  sizeDimensionsUnavailable: string;
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
  initialSize?: MarkdownImageSize;
  mode: "add" | "edit";
  onCancel: () => void;
  onConfirm: (value: { alt: string; file: File | null; size: MarkdownImageSize; title: string }) => Promise<void>;
  onRemove?: () => void;
};

export function ImageEditorDialog({
  copy,
  initialAlt = "",
  initialSrc = "",
  initialTitle = "",
  initialSize = { mode: "original-percent", originalWidth: null, value: 100 },
  mode,
  onCancel,
  onConfirm,
  onRemove
}: ImageEditorDialogProps) {
  const [alt, setAlt] = useState(initialAlt);
  const [title, setTitle] = useState(initialTitle);
  const [file, setFile] = useState<File | null>(null);
  const [sizeMode, setSizeMode] = useState<MarkdownImageSizeMode>(initialSize.mode);
  const [sizeValue, setSizeValue] = useState(String(initialSize.value));
  const [originalWidth, setOriginalWidth] = useState(initialSize.originalWidth ?? 0);
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
    const parsedSize = Number(sizeValue);
    const sizeError = validateImageSize(sizeMode, parsedSize, copy);
    if (sizeError) {
      setError(sizeError);
      return;
    }
    setBusy(true);
    setError("");
    try {
      const resolvedOriginalWidth = sizeMode === "original-percent" && !originalWidth
        ? await loadImageWidth(preview)
        : originalWidth;
      if (sizeMode === "original-percent" && !resolvedOriginalWidth) {
        setError(copy.sizeDimensionsUnavailable);
        setBusy(false);
        return;
      }
      await onConfirm({
        alt: alt.trim(),
        file,
        size: {
          mode: sizeMode,
          originalWidth: sizeMode === "original-percent" ? resolvedOriginalWidth || null : null,
          value: normalizeImageSizeValue(sizeMode, parsedSize)
        },
        title: title.trim()
      });
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
                onChange={(event) => {
                  setFile(event.target.files?.[0] ?? null);
                  setOriginalWidth(0);
                }}
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
            <div className="image-editor-size-fields">
              <label className="field">
                <span>{copy.sizeMode}</span>
                <select
                  disabled={busy}
                  value={sizeMode}
                  onChange={(event) => setSizeMode(event.target.value as MarkdownImageSizeMode)}
                >
                  <option value="pixels">{copy.sizePixels}</option>
                  <option value="original-percent">{copy.sizeOriginalPercent}</option>
                  <option value="container-percent">{copy.sizeContainerPercent}</option>
                </select>
              </label>
              <label className="field">
                <span>{sizeMode === "pixels"
                  ? copy.sizeValuePixels
                  : sizeMode === "original-percent"
                    ? copy.sizeValueOriginalPercent
                    : copy.sizeValueContainerPercent}</span>
                <input
                  disabled={busy}
                  inputMode="decimal"
                  max={sizeMode === "pixels" ? 10000 : sizeMode === "original-percent" ? 500 : 100}
                  min={1}
                  step={sizeMode === "pixels" ? 1 : 0.1}
                  type="number"
                  value={sizeValue}
                  onChange={(event) => setSizeValue(event.target.value)}
                />
              </label>
            </div>
          </div>

          <div className="image-editor-preview" aria-label={copy.preview}>
            {preview ? (
              <img
                alt={alt || ""}
                src={preview}
                style={{ height: "auto", width: previewImageWidth(sizeMode, Number(sizeValue), originalWidth) }}
                onLoad={(event) => setOriginalWidth(event.currentTarget.naturalWidth)}
              />
            ) : <span className="muted">{copy.preview}</span>}
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

function validateImageSize(mode: MarkdownImageSizeMode, value: number, copy: ImageEditorCopy) {
  if (!Number.isFinite(value) || value < 1) {
    return mode === "pixels"
      ? copy.sizeInvalidPixels
      : mode === "original-percent"
        ? copy.sizeInvalidOriginalPercent
        : copy.sizeInvalidContainerPercent;
  }
  if (mode === "pixels" && (!Number.isInteger(value) || value > 10000)) return copy.sizeInvalidPixels;
  if (mode === "original-percent" && value > 500) return copy.sizeInvalidOriginalPercent;
  if (mode === "container-percent" && value > 100) return copy.sizeInvalidContainerPercent;
  return "";
}

function normalizeImageSizeValue(mode: MarkdownImageSizeMode, value: number) {
  return mode === "pixels" ? Math.round(value) : Math.round(value * 10) / 10;
}

function previewImageWidth(mode: MarkdownImageSizeMode, value: number, originalWidth: number) {
  if (!Number.isFinite(value) || value <= 0) return undefined;
  if (mode === "container-percent") return `${Math.min(value, 100)}%`;
  if (mode === "original-percent") return originalWidth > 0 ? `${Math.max(1, Math.round(originalWidth * value / 100))}px` : undefined;
  return `${Math.round(value)}px`;
}

async function loadImageWidth(source: string) {
  if (!source) return 0;
  return new Promise<number>((resolve) => {
    const image = new Image();
    image.onload = () => resolve(image.naturalWidth);
    image.onerror = () => resolve(0);
    image.src = source;
  });
}
