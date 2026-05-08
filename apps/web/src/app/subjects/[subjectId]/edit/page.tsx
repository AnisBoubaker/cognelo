"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useUnsavedChangesGuard } from "@cognelo/activity-ui";
import { useParams, useRouter } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { api, type Subject } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

export default function EditSubjectPage() {
  const params = useParams<{ subjectId: string }>();
  const subjectId = params.subjectId;
  const router = useRouter();
  const { t } = useI18n();
  const [subject, setSubject] = useState<Subject | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [savedSnapshot, setSavedSnapshot] = useState({ title: "", description: "" });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api
      .subject(subjectId)
      .then((result) => {
        setSubject(result.subject);
        setTitle(result.subject.title);
        setDescription(result.subject.description ?? "");
        setSavedSnapshot({ title: result.subject.title, description: result.subject.description ?? "" });
      })
      .catch((err) => setError(err instanceof Error ? err.message : t("editSubject.loadError")));
  }, [subjectId, t]);

  const currentSnapshot = useMemo(() => ({ title, description }), [description, title]);
  const hasUnsavedChanges = currentSnapshot.title !== savedSnapshot.title || currentSnapshot.description !== savedSnapshot.description;

  const discardChanges = useCallback(() => {
    setTitle(savedSnapshot.title);
    setDescription(savedSnapshot.description);
    setError("");
  }, [savedSnapshot]);

  const saveSubjectChanges = useCallback(async () => {
    setSaving(true);
    setError("");
    try {
      const result = await api.updateSubject(subjectId, { title, description });
      setSavedSnapshot({ title, description });
      router.push(`/subjects/${result.subject.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("editSubject.saveError"));
      throw err;
    } finally {
      setSaving(false);
    }
  }, [description, router, subjectId, t, title]);

  useUnsavedChangesGuard(
    useMemo(
      () => ({
        isDirty: hasUnsavedChanges,
        onSave: saveSubjectChanges,
        onDiscard: discardChanges
      }),
      [discardChanges, hasUnsavedChanges, saveSubjectChanges]
    )
  );

  async function saveSubject(event: FormEvent) {
    event.preventDefault();
    await saveSubjectChanges();
  }

  return (
    <AppShell>
      <main className="page stack">
        <section>
          <p className="eyebrow">{t("editSubject.eyebrow")}</p>
          <h1>{subject?.title ?? t("editSubject.fallbackTitle")}</h1>
        </section>

        {error ? <p className="error">{error}</p> : null}

        {subject ? (
          <section className="section stack">
            <form className="form" onSubmit={saveSubject}>
              <div className="field">
                <label htmlFor="subject-title">{t("subjects.titleLabel")}</label>
                <input id="subject-title" value={title} minLength={2} required onChange={(event) => setTitle(event.target.value)} />
              </div>
              <div className="field">
                <label htmlFor="subject-description">{t("subjects.descriptionLabel")}</label>
                <textarea id="subject-description" value={description} onChange={(event) => setDescription(event.target.value)} />
              </div>
              <div className="hero-actions">
                <button type="submit" disabled={saving}>
                  {saving ? t("common.saving") : t("common.save")}
                </button>
                <Link className="button secondary" href={`/subjects/${subject.id}`}>
                  {t("common.cancel")}
                </Link>
              </div>
            </form>
          </section>
        ) : null}
      </main>
    </AppShell>
  );
}
