"use client";

import { FormEvent, useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { api, type Subject } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

export default function SubjectsPage() {
  const { t } = useI18n();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  function loadSubjects() {
    api
      .subjects()
      .then((result) => setSubjects(result.subjects))
      .catch((err) => setError(err instanceof Error ? err.message : "Unable to load subjects."));
  }

  useEffect(() => {
    loadSubjects();
  }, []);

  async function createSubject(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await api.createSubject({ title, description, metadata: {} });
      setTitle("");
      setDescription("");
      loadSubjects();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create subject.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell>
      <main className="page stack">
        <section className="hero-panel hero-panel-compact">
          <div className="hero-meta">
            <p className="eyebrow">Curriculum</p>
            <h1>{t("nav.subjects")}</h1>
            <p className="muted">Subjects contain shared course material and organize activity banks.</p>
          </div>
        </section>

        {error ? <p className="error">{error}</p> : null}

        <section className="section stack">
          <h2>Create subject</h2>
          <form className="form" onSubmit={createSubject}>
            <div className="field">
              <label htmlFor="subject-title">Title</label>
              <input id="subject-title" value={title} minLength={2} required onChange={(event) => setTitle(event.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="subject-description">Description</label>
              <textarea id="subject-description" value={description} onChange={(event) => setDescription(event.target.value)} />
            </div>
            <button type="submit" disabled={saving}>
              {saving ? t("common.saving") : t("common.create")}
            </button>
          </form>
        </section>

        <section className="grid">
          {subjects.map((subject) => (
            <article className="card" key={subject.id}>
              <span className="eyebrow">Subject</span>
              <h2>{subject.title}</h2>
              <p className="muted">{subject.description || t("common.noDescription")}</p>
              <p className="muted">
                {subject.activityBanks?.length ?? 0} activity banks · {subject.courses?.length ?? 0} courses
              </p>
            </article>
          ))}
        </section>
      </main>
    </AppShell>
  );
}
