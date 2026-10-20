"use client";

import { useState } from "react";
import { EditActionBar, getEditActionBarCopy, MarkdownRenderer, RichTextEditor, useNotifications, useUnsavedChangesGuard } from "@cognelo/activity-ui";
import type { ContentPluginLocale } from "@cognelo/content-type-sdk";
import { readTextContent } from "./shared";
import { TextDisplaySettings } from "./settings";
import { textContentCopy } from "./copy";

type Draft = { title: string; body: string; displayMode: "inline" | "page" | "modal"; openInNewTab: boolean };
export function TextContentEditor({ title, metadata, isVisible, locale, onSave }: {
  title: string;
  metadata: Record<string, unknown>;
  isVisible: boolean;
  locale: ContentPluginLocale;
  onSave: (payload: Draft, visible: boolean) => Promise<void>;
}) {
  const initial = { title, ...readTextContent(metadata) };
  const [draft, setDraft] = useState(initial);
  const [visible, setVisible] = useState(isVisible);
  const [saved, setSaved] = useState({ draft: initial, visible: isVisible });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const copy = textContentCopy(locale);
  const actionCopy = getEditActionBarCopy(locale);
  const { notify } = useNotifications();
  const isDirty = JSON.stringify(draft) !== JSON.stringify(saved.draft) || visible !== saved.visible;
  const reset = () => { setDraft(saved.draft); setVisible(saved.visible); setError(""); };
  async function save() {
    if (!draft.title.trim() || draft.title.trim().length > 180 || draft.body.length > 20000) return false;
    setBusy(true); setError("");
    try {
      await onSave(draft, visible);
      setSaved({ draft, visible });
      notify({ variant: "success", message: copy.saved });
      return true;
    } catch (err) { setError(err instanceof Error ? err.message : String(err)); return false; }
    finally { setBusy(false); }
  }
  useUnsavedChangesGuard({ isDirty, onSave: async () => { if (!await save()) throw new Error("Unable to save text material."); }, onDiscard: reset });
  return <>
    <form id="text-material-editor" className="form" onSubmit={(event) => { event.preventDefault(); void save(); }}>
      <fieldset disabled={busy} className="text-material-editor-fields">
        <div className="field"><label htmlFor="text-material-title">{copy.title}</label><input id="text-material-title" required maxLength={180} value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} /></div>
        <div className="field"><label htmlFor="text-material-body">{copy.content}</label><RichTextEditor id="text-material-body" ariaLabel={copy.content} locale={locale} minHeight={420} disabled={busy} value={draft.body} onChange={(body) => setDraft((current) => ({ ...current, body }))} /></div>
        <details className="text-material-settings"><summary>{copy.settings}</summary><TextDisplaySettings metadata={draft} locale={locale} isVisible={visible} onVisibilityChange={setVisible} onMetadataChange={(value) => setDraft({ title: draft.title, ...readTextContent(value) })} /></details>
      </fieldset>
      {error ? <p className="error" role="alert">{error}</p> : null}
    </form>
    <EditActionBar form="text-material-editor" isDirty={isDirty} isSaving={busy} savedLabel={actionCopy.saved} unsavedLabel={actionCopy.unsaved} saveLabel={copy.save} savingLabel={actionCopy.saving} cancelLabel={actionCopy.cancel} onCancel={reset} saveDisabled={!draft.title.trim() || draft.body.length > 20000} />
  </>;
}
export function TextContentViewer({ metadata }: { metadata: Record<string, unknown> }) {
  return <MarkdownRenderer markdown={readTextContent(metadata).body} />;
}
