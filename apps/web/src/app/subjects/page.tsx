"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { RichTextEditor } from "@cognelo/activity-ui";
import { AppShell } from "@/components/app-shell";
import { api, type ProgrammingLanguageOption, type Subject, type SubjectProgrammingLanguage } from "@/lib/api";
import { locales, useI18n, type Locale } from "@/lib/i18n";
import { subjectMultipleProgrammingLanguages } from "@/lib/subject-programming-language";

export default function SubjectsPage() {
  const { locale, t } = useI18n();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [teachingLanguage, setTeachingLanguage] = useState<Locale>(locale);
  const [programmingLanguage, setProgrammingLanguage] = useState<SubjectProgrammingLanguage | "">("");
  const [programmingLanguages, setProgrammingLanguages] = useState<ProgrammingLanguageOption[]>([]);
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
    api.programmingLanguages()
      .then((result) => setProgrammingLanguages(result.languages))
      .catch((err) => setError(err instanceof Error ? err.message : t("subjects.programmingLanguagesLoadError")));
  }, [t]);

  async function createSubject(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await api.createSubject({ title, description, teachingLanguage, programmingLanguage: programmingLanguage || null, metadata: {} });
      setTitle("");
      setDescription("");
      setTeachingLanguage(locale);
      setProgrammingLanguage("");
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
            <button className="secondary" type="button" onClick={() => {
              setShowCreateForm((current) => {
                if (!current) setTeachingLanguage(locale);
                return !current;
              });
            }}>
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
                <RichTextEditor
                  id="subject-description"
                  value={description}
                  locale={locale}
                  minHeight={180}
                  ariaLabel={t("subjects.descriptionLabel")}
                  onChange={setDescription}
                />
              </div>
              <div className="field">
                <label htmlFor="subject-teaching-language">{t("subjects.teachingLanguageLabel")}</label>
                <select
                  id="subject-teaching-language"
                  value={teachingLanguage}
                  onChange={(event) => setTeachingLanguage(event.target.value as Locale)}
                >
                  {locales.map((language) => <option key={language} value={language}>{t(`locale.${language}`)}</option>)}
                </select>
                <p className="muted">{t("subjects.teachingLanguageHelp")}</p>
              </div>
              <div className="field">
                <label htmlFor="subject-programming-language">{t("subjects.programmingLanguageLabel")}</label>
                <select
                  id="subject-programming-language"
                  value={programmingLanguage}
                  onChange={(event) => setProgrammingLanguage(event.target.value as SubjectProgrammingLanguage | "")}
                >
                  <option value="">{t("subjects.programmingLanguageNone")}</option>
                  <option value={subjectMultipleProgrammingLanguages}>{t("subjects.programmingLanguageMultiple")}</option>
                  {programmingLanguages.map((language) => <option key={language.key} value={language.key}>{language.label}</option>)}
                </select>
                <p className="muted">{t("subjects.programmingLanguageHelp")}</p>
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
                    setTeachingLanguage(locale);
                    setProgrammingLanguage("");
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
                <Link className="table-row table-row-link table-row-subject" href={`/subjects/${subject.id}`} key={subject.id}>
                  <span className="table-main table-main-stack">
                    <strong>{subject.title}</strong>
                  </span>
                  <span className="table-meta muted">
                    {t("subjects.summary", {
                      banks: subject.activityBanks?.length ?? 0,
                      courses: subject.courses?.length ?? 0
                    })}
                  </span>
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
