"use client";

import { useId, type FormEvent } from "react";
import type { ContentPluginLocale } from "@cognelo/content-type-sdk";
import { readTextContent } from "./shared";
import { textContentCopy } from "./copy";

export type TextDisplaySettingsProps = {
  metadata: Record<string, unknown>;
  locale: ContentPluginLocale;
  isVisible: boolean;
  onMetadataChange: (metadata: Record<string, unknown>) => void;
  onVisibilityChange: (visible: boolean) => void;
};
export function TextDisplaySettings({ metadata, locale, isVisible, onMetadataChange, onVisibilityChange }: TextDisplaySettingsProps) {
  const id = useId();
  const copy = textContentCopy(locale);
  const { displayMode, openInNewTab } = readTextContent(metadata);
  return <div className="stack">
    <label className="checkbox-row"><input type="checkbox" checked={isVisible} onChange={(event) => onVisibilityChange(event.target.checked)} />{copy.visible}</label>
    <div className="field">
      <label htmlFor={`${id}-display`}>{copy.display}</label>
      <select id={`${id}-display`} value={displayMode} onChange={(event) => onMetadataChange({ ...metadata, displayMode: event.target.value })}>
        <option value="inline">{copy.inline}</option><option value="page">{copy.page}</option><option value="modal">{copy.modal}</option>
      </select>
    </div>
    {displayMode === "page" ? <label className="checkbox-row"><input type="checkbox" checked={openInNewTab} onChange={(event) => onMetadataChange({ ...metadata, openInNewTab: event.target.checked })} />{copy.newTab}</label> : null}
  </div>;
}
export type TextContentSettingsFormProps = TextDisplaySettingsProps & {
  error?: string;
  editorHref?: string;
  onSubmit: (event: FormEvent) => void;
};
export function TextContentSettingsForm({ error, editorHref, onSubmit, ...props }: TextContentSettingsFormProps) {
  const copy = textContentCopy(props.locale);
  return <form className="form" onSubmit={onSubmit}>
    {editorHref ? <a className="button secondary" href={editorHref}>{copy.edit}</a> : null}
    <TextDisplaySettings {...props} />
    {error ? <p className="error" role="alert">{error}</p> : null}
    <button type="submit">{copy.save}</button>
  </form>;
}
