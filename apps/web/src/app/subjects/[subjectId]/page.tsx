"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { api, type Subject } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

export default function SubjectDetailPage() {
  const params = useParams<{ subjectId: string }>();
  const subjectId = params.subjectId;
  const { t } = useI18n();
  const [subject, setSubject] = useState<Subject | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .subject(subjectId)
      .then((result) => setSubject(result.subject))
      .catch((err) => setError(err instanceof Error ? err.message : t("subjectDetail.loadError")));
  }, [subjectId, t]);

  return (
    <AppShell>
      <main className="page stack">
        <section className="hero-panel hero-panel-compact">
          <div className="hero-meta">
            <p className="eyebrow">{t("subjectDetail.eyebrow")}</p>
            <h1>{subject?.title ?? t("subjectDetail.fallbackTitle")}</h1>
            <p className="muted">{subject?.description || t("common.noDescription")}</p>
          </div>
          {subject ? (
            <div className="hero-actions">
              <Link className="button secondary" href="/subjects">
                {t("common.back")}
              </Link>
              <Link className="button" href={`/subjects/${subject.id}/edit`}>
                {t("common.edit")}
              </Link>
            </div>
          ) : null}
        </section>

        {error ? <p className="error">{error}</p> : null}

        {subject ? (
          <section className="split">
            <div className="section stack">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">{t("subjectDetail.activityBanksEyebrow")}</p>
                  <h2>{t("subjectDetail.activityBanksTitle")}</h2>
                </div>
              </div>
              {subject.activityBanks?.length ? (
                <div className="table-list">
                  {subject.activityBanks.map((bank) => (
                    <Link className="table-row table-row-link" href={`/activity-banks/${bank.id}`} key={bank.id}>
                      <span className="table-main table-main-stack">
                        <strong>{bank.title}</strong>
                        <span className="table-meta-note muted">{bank.description || t("common.noDescription")}</span>
                      </span>
                      <span className="table-meta muted">{t("common.open")}</span>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="muted">{t("subjectDetail.emptyActivityBanks")}</p>
              )}
            </div>

            <div className="section stack">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">{t("subjectDetail.coursesEyebrow")}</p>
                  <h2>{t("subjectDetail.coursesTitle")}</h2>
                </div>
              </div>
              {subject.courses?.length ? (
                <div className="table-list">
                  {subject.courses.map((course) => (
                    <Link className="table-row table-row-link" href={`/courses/${course.id}`} key={course.id}>
                      <span className="table-main table-main-stack">
                        <strong>{course.title}</strong>
                        <span className="table-meta-note muted">{course.description || t("common.noDescription")}</span>
                      </span>
                      <span className="table-meta muted">{t("common.open")}</span>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="muted">{t("subjectDetail.emptyCourses")}</p>
              )}
            </div>
          </section>
        ) : null}
      </main>
    </AppShell>
  );
}
