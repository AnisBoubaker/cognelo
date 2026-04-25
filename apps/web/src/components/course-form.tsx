"use client";

import { FormEvent, useState } from "react";
import { useNotifications } from "@cognelo/activity-ui";
import type { CourseInput } from "@cognelo/contracts";
import type { Course } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

type Props = {
  initial?: Pick<Course, "title" | "description" | "status">;
  submitLabel: string;
  onSubmit: (input: CourseInput) => Promise<void>;
};

export function CourseForm({ initial, submitLabel, onSubmit }: Props) {
  const { t } = useI18n();
  const notifications = useNotifications();
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [status, setStatus] = useState(initial?.status ?? "draft");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setSaving(true);
    try {
      await onSubmit({ title, description, status });
    } catch (err) {
      notifications.error(err instanceof Error ? err.message : t("courseForm.saveError"));
      setError("");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="form" onSubmit={handleSubmit}>
      <div className="field">
        <label htmlFor="title">{t("courseForm.title")}</label>
        <input id="title" value={title} onChange={(event) => setTitle(event.target.value)} required minLength={2} />
      </div>
      <div className="field">
        <label htmlFor="description">{t("courseForm.description")}</label>
        <textarea id="description" value={description} onChange={(event) => setDescription(event.target.value)} />
      </div>
      <div className="field">
        <label htmlFor="status">{t("courseForm.status")}</label>
        <select id="status" value={status} onChange={(event) => setStatus(event.target.value as typeof status)}>
          <option value="draft">{t("status.draft")}</option>
          <option value="published">{t("status.published")}</option>
          <option value="archived">{t("status.archived")}</option>
        </select>
      </div>
      {error ? <p className="error">{error}</p> : null}
      <button type="submit" disabled={saving}>
        {saving ? t("common.saving") : submitLabel}
      </button>
    </form>
  );
}
