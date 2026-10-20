import type { FormEvent } from "react";
import type { ContentPluginLocale } from "@cognelo/content-type-sdk";

const copy = {
  en: { text: "Link text", url: "URL", description: "Description (optional)", newTab: "Open in a new tab" },
  fr: { text: "Texte du lien", url: "URL", description: "Description (facultative)", newTab: "Ouvrir dans un nouvel onglet" },
  zh: { text: "链接文字", url: "网址", description: "说明（可选）", newTab: "在新标签页中打开" },
  ar: { text: "نص الرابط", url: "عنوان URL", description: "الوصف (اختياري)", newTab: "فتح في علامة تبويب جديدة" }
};

export function LinkContentSettingsForm({ title, url, metadata, locale, error, onTitleChange, onUrlChange, onMetadataChange, onSubmit, t }: {
  title: string; url: string; metadata: Record<string, unknown>; locale: ContentPluginLocale; error?: string;
  onTitleChange: (value: string) => void; onUrlChange: (value: string) => void;
  onMetadataChange: (value: Record<string, unknown>) => void; onSubmit: (event: FormEvent) => void;
  t: (key: string) => string;
}) {
  const labels = copy[locale];
  return <form className="form" onSubmit={onSubmit}>
    <div className="field"><label htmlFor="settings-link-text">{labels.text}</label><input id="settings-link-text" value={title} onChange={(event) => onTitleChange(event.target.value)} required maxLength={180} /></div>
    <div className="field"><label htmlFor="settings-link-url">{labels.url}</label><input id="settings-link-url" type="url" value={url} onChange={(event) => onUrlChange(event.target.value)} required maxLength={4000} placeholder="https://example.org" /></div>
    <div className="field"><label htmlFor="settings-link-description">{labels.description}</label><textarea id="settings-link-description" value={typeof metadata.description === "string" ? metadata.description : ""} onChange={(event) => onMetadataChange({ ...metadata, description: event.target.value })} maxLength={2000} rows={3} /></div>
    <label className="checkbox-row"><input type="checkbox" checked={metadata.openInNewTab !== false} onChange={(event) => onMetadataChange({ ...metadata, openInNewTab: event.target.checked })} />{labels.newTab}</label>
    {error ? <p className="error">{error}</p> : null}
    <div className="row"><button type="submit">{t("courseDetail.saveMaterial")}</button></div>
  </form>;
}
