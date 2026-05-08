"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { api, type ActivityBank, type Subject } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

export default function ActivityBanksPage() {
  const router = useRouter();
  const { t } = useI18n();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [activityBanks, setActivityBanks] = useState<ActivityBank[]>([]);
  const [bankSubjectId, setBankSubjectId] = useState("");
  const [bankTitle, setBankTitle] = useState("");
  const [bankDescription, setBankDescription] = useState("");
  const [error, setError] = useState("");
  const [savingBank, setSavingBank] = useState(false);

  async function loadPage() {
    const [subjectsResult, banksResult] = await Promise.all([api.subjects(), api.activityBanks()]);
    setSubjects(subjectsResult.subjects);
    setActivityBanks(banksResult.activityBanks);
    setBankSubjectId((current) => current || subjectsResult.subjects[0]?.id || "");
  }

  useEffect(() => {
    loadPage().catch((err) => setError(err instanceof Error ? err.message : t("activityBanks.loadError")));
  }, []);

  async function createActivityBank(event: FormEvent) {
    event.preventDefault();
    setSavingBank(true);
    setError("");
    try {
      const result = await api.createActivityBank({
        subjectId: bankSubjectId,
        title: bankTitle,
        description: bankDescription,
        metadata: {}
      });
      router.push(`/activity-banks/${result.activityBank.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("activityBanks.createError"));
    } finally {
      setSavingBank(false);
    }
  }

  return (
    <AppShell>
      <main className="page stack">
        <section className="hero-panel hero-panel-compact">
          <div className="hero-meta">
            <p className="eyebrow">{t("activityBanks.eyebrow")}</p>
            <h1>{t("nav.activityBanks")}</h1>
            <p className="muted">{t("activityBanks.subtitle")}</p>
          </div>
        </section>

        {error ? <p className="error">{error}</p> : null}

        <section className="split">
          <div className="section stack">
            <div className="section-heading">
              <div>
                <p className="eyebrow">{t("activityBanks.listEyebrow")}</p>
                <h2>{t("activityBanks.listTitle")}</h2>
              </div>
            </div>
            {activityBanks.length ? (
              <div className="table-list">
                {activityBanks.map((bank) => (
                  <Link className="table-row table-row-link" href={`/activity-banks/${bank.id}`} key={bank.id}>
                    <span className="table-main table-main-stack">
                      <strong>{bank.title}</strong>
                      <span className="table-meta-note muted">{bank.subject?.title ?? t("activityBanks.noSubject")}</span>
                    </span>
                    <span className="table-meta muted">{t("activityBanks.activityCount", { count: bank.activities?.length ?? 0 })}</span>
                    <span className="table-meta muted">{bank.owner?.name ?? bank.owner?.email ?? ""}</span>
                    <span className="table-meta muted">{t("common.open")}</span>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="muted">{t("activityBanks.empty")}</p>
            )}
          </div>

          <div className="section stack">
            <h2>{t("activityBanks.addTitle")}</h2>
            <form className="form" onSubmit={createActivityBank}>
              <div className="field">
                <label htmlFor="bank-subject">{t("activityBanks.subjectLabel")}</label>
                <select id="bank-subject" value={bankSubjectId} onChange={(event) => setBankSubjectId(event.target.value)} required>
                  {subjects.map((subject) => (
                    <option key={subject.id} value={subject.id}>
                      {subject.title}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="bank-title">{t("activityBanks.titleLabel")}</label>
                <input id="bank-title" value={bankTitle} minLength={2} required onChange={(event) => setBankTitle(event.target.value)} />
              </div>
              <div className="field">
                <label htmlFor="bank-description">{t("activityBanks.descriptionLabel")}</label>
                <textarea id="bank-description" value={bankDescription} onChange={(event) => setBankDescription(event.target.value)} />
              </div>
              <button type="submit" disabled={savingBank || !bankSubjectId}>
                {savingBank ? t("common.saving") : t("common.create")}
              </button>
            </form>
          </div>
        </section>
      </main>
    </AppShell>
  );
}
