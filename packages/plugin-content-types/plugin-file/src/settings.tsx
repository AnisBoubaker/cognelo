import type { ChangeEvent, FormEvent } from "react";

export type FileContentSettingsFormProps = {
  title: string;
  detail?: string;
  error?: string;
  onTitleChange: (title: string) => void;
  onFileChange: (file: File | null) => void;
  onSubmit: (event: FormEvent) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
};

export function FileContentSettingsForm({ title, detail, error, onTitleChange, onFileChange, onSubmit, t }: FileContentSettingsFormProps) {
  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    onFileChange(event.target.files?.[0] ?? null);
  }

  return (
    <form className="form" onSubmit={onSubmit}>
      <div className="field">
        <label htmlFor="settings-file-content-title">{t("courseDetail.activityTitle")}</label>
        <input id="settings-file-content-title" value={title} onChange={(event) => onTitleChange(event.target.value)} required />
      </div>
      <div className="field">
        <label htmlFor="settings-file-content-file">{t("courseDetail.file")}</label>
        <input id="settings-file-content-file" type="file" onChange={handleFileChange} />
        {detail ? <p className="muted">{detail}</p> : null}
      </div>
      {error ? <p className="error">{error}</p> : null}
      <div className="row">
        <button type="submit">{t("courseDetail.saveMaterial")}</button>
      </div>
    </form>
  );
}
