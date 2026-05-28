import type { FormEvent } from "react";

export type TextContentSettingsFormProps = {
  title: string;
  body: string;
  error?: string;
  onTitleChange: (title: string) => void;
  onBodyChange: (body: string) => void;
  onSubmit: (event: FormEvent) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
};

export function TextContentSettingsForm({ title, body, error, onTitleChange, onBodyChange, onSubmit, t }: TextContentSettingsFormProps) {
  return (
    <form className="form" onSubmit={onSubmit}>
      <div className="field">
        <label htmlFor="settings-text-content-title">{t("courseDetail.activityTitle")}</label>
        <input id="settings-text-content-title" value={title} onChange={(event) => onTitleChange(event.target.value)} required />
      </div>
      <div className="field">
        <label htmlFor="settings-text-content-body">{t("courseDetail.materialBody")}</label>
        <textarea id="settings-text-content-body" value={body} onChange={(event) => onBodyChange(event.target.value)} rows={12} />
      </div>
      {error ? <p className="error">{error}</p> : null}
      <div className="row">
        <button type="submit">{t("courseDetail.saveMaterial")}</button>
      </div>
    </form>
  );
}
