"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useNotifications, useUnsavedChangesGuard } from "@cognelo/activity-ui";
import type { CourseInput } from "@cognelo/contracts";
import type { Course, Subject } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

type Props = {
  initial?: Pick<Course, "subjectId" | "title" | "description" | "status">;
  subjects: Subject[];
  submitLabel: string;
  onSubmit: (input: CourseInput) => Promise<void>;
};

export function CourseForm({ initial, subjects, submitLabel, onSubmit }: Props) {
  const { t } = useI18n();
  const notifications = useNotifications();
  const [title, setTitle] = useState(initial?.title ?? "");
  const [subjectId, setSubjectId] = useState(initial?.subjectId ?? subjects[0]?.id ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [status, setStatus] = useState(initial?.status ?? "draft");
  const [savedSnapshot, setSavedSnapshot] = useState(() => courseSnapshot(initial, subjects[0]?.id ?? ""));
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!subjectId && subjects[0]?.id) {
      setSubjectId(subjects[0].id);
      setSavedSnapshot((current) => (current.subjectId ? current : courseSnapshot(initial, subjects[0].id)));
    }
  }, [initial, subjectId, subjects]);

  const currentSnapshot = useMemo(() => ({ subjectId, title, description, status }), [description, status, subjectId, title]);
  const hasUnsavedChanges = !courseSnapshotsEqual(currentSnapshot, savedSnapshot);

  const discardChanges = useCallback(() => {
    setSubjectId(savedSnapshot.subjectId);
    setTitle(savedSnapshot.title);
    setDescription(savedSnapshot.description);
    setStatus(savedSnapshot.status);
    setError("");
  }, [savedSnapshot]);

  const saveCourse = useCallback(async () => {
    setError("");
    setSaving(true);
    try {
      await onSubmit({ subjectId, title, description, status });
      setSavedSnapshot({ subjectId, title, description, status });
    } catch (err) {
      notifications.error(err instanceof Error ? err.message : t("courseForm.saveError"));
      setError("");
      throw err;
    } finally {
      setSaving(false);
    }
  }, [description, notifications, onSubmit, status, subjectId, t, title]);

  useUnsavedChangesGuard(
    useMemo(
      () => ({
        isDirty: hasUnsavedChanges,
        onSave: saveCourse,
        onDiscard: discardChanges
      }),
      [discardChanges, hasUnsavedChanges, saveCourse]
    )
  );

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    await saveCourse();
  }

  return (
    <form className="form" onSubmit={handleSubmit}>
      <div className="field">
        <label htmlFor="subjectId">{t("courseForm.subject")}</label>
        <select id="subjectId" value={subjectId} onChange={(event) => setSubjectId(event.target.value)} required>
          {subjects.map((subject) => (
            <option key={subject.id} value={subject.id}>
              {subject.title}
            </option>
          ))}
        </select>
      </div>
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
      <button type="submit" disabled={saving || !subjectId}>
        {saving ? t("common.saving") : submitLabel}
      </button>
    </form>
  );
}

function courseSnapshot(initial: Props["initial"], fallbackSubjectId: string) {
  return {
    subjectId: initial?.subjectId ?? fallbackSubjectId,
    title: initial?.title ?? "",
    description: initial?.description ?? "",
    status: initial?.status ?? "draft"
  };
}

function courseSnapshotsEqual(
  left: ReturnType<typeof courseSnapshot>,
  right: ReturnType<typeof courseSnapshot>
) {
  return left.subjectId === right.subjectId && left.title === right.title && left.description === right.description && left.status === right.status;
}
