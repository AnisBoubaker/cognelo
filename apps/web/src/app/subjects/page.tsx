"use client";

import Link from "next/link";
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
  const [showCreateForm, setShowCreateForm] = useState(false);

  function loadSubjects() {
    api
      .subjects()
      .then((result) => setSubjects(result.subjects))
      .catch((err) => setError(err instanceof Error ? err.message : t("subjects.loadError")));
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
      setShowCreateForm(false);
      loadSubjects();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("subjects.createError"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell>
      <main className="page stack">
        <section className="hero-panel hero-panel-compact">
          <div className="hero-meta">
            <p className="eyebrow">{t("subjects.eyebrow")}</p>
            <h1>{t("nav.subjects")}</h1>
            <p className="muted">{t("subjects.subtitle")}</p>
          </div>
        </section>

        {error ? <p className="error">{error}</p> : null}

        <section className="section stack">
          <div className="section-heading">
            <div>
              <p className="eyebrow">{t("subjects.listEyebrow")}</p>
              <h2>{t("subjects.listTitle")}</h2>
            </div>
            <button className="secondary" type="button" onClick={() => setShowCreateForm((current) => !current)}>
              {showCreateForm ? t("common.cancel") : t("common.add")}
            </button>
          </div>
          {showCreateForm ? (
            <form className="form" onSubmit={createSubject}>
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
                  {saving ? t("common.saving") : t("common.create")}
                </button>
                <button
                  className="secondary"
                  type="button"
                  onClick={() => {
                    setShowCreateForm(false);
                    setTitle("");
                    setDescription("");
                  }}
                >
                  {t("common.cancel")}
                </button>
              </div>
            </form>
          ) : null}
          {subjects.length ? (
            <div className="table-list">
              {subjects.map((subject) => (
                <Link className="table-row table-row-link" href={`/subjects/${subject.id}`} key={subject.id}>
                  <span className="table-main table-main-stack">
                    <strong>{subject.title}</strong>
                    <span className="table-meta-note muted">{subject.description || t("common.noDescription")}</span>
                  </span>
                  <span className="table-meta muted">
                    {t("subjects.summary", {
                      banks: subject.activityBanks?.length ?? 0,
                      courses: subject.courses?.length ?? 0
                    })}
                  </span>
                  <span className="table-meta muted">{t("common.open")}</span>
                </Link>
              ))}
            </div>
          ) : (
            <p className="muted">{t("subjects.empty")}</p>
          )}
        </section>
      </main>
    </AppShell>
  );
}
