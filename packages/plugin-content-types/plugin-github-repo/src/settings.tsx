import type { FormEvent } from "react";

export type GithubRepoSettingsFormProps = {
  title: string;
  url: string;
  error?: string;
  onTitleChange: (title: string) => void;
  onUrlChange: (url: string) => void;
  onSubmit: (event: FormEvent) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
};

export function GithubRepoSettingsForm({ title, url, error, onTitleChange, onUrlChange, onSubmit, t }: GithubRepoSettingsFormProps) {
  return (
    <form className="form" onSubmit={onSubmit}>
      <div className="field">
        <label htmlFor="settings-github-repo-title">{t("courseDetail.activityTitle")}</label>
        <input id="settings-github-repo-title" value={title} onChange={(event) => onTitleChange(event.target.value)} required />
      </div>
      <div className="field">
        <label htmlFor="settings-github-repo-url">{t("courseDetail.githubEditLabel")}</label>
        <input
          id="settings-github-repo-url"
          type="url"
          value={url}
          onChange={(event) => onUrlChange(event.target.value)}
          placeholder="https://github.com/org/repo"
        />
      </div>
      {error ? <p className="error">{error}</p> : null}
      <div className="row">
        <button type="submit">{t("courseDetail.saveMaterial")}</button>
      </div>
    </form>
  );
}
