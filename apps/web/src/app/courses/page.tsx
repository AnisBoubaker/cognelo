"use client";

import { MarkdownRenderer } from "@cognelo/activity-ui";
import Link from "next/link";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/components/auth-provider";
import { api, Course } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

export default function CoursesPage() {
  const { user } = useAuth();
  const { t } = useI18n();
  const [courses, setCourses] = useState<Course[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .courses()
      .then((result) => setCourses(result.courses))
      .catch((err) => setError(err instanceof Error ? err.message : t("courses.loadError")));
  }, [t]);

  return (
    <AppShell>
      <main className="page stack">
        <section className="hero-panel row hero-actions">
          <div className="hero-meta">
            <p className="eyebrow">{t("courses.eyebrow")}</p>
            <h1>{t("courses.title")}</h1>
          </div>
          <Link className="button" href="/courses/new">
            {t("courses.create")}
          </Link>
        </section>
        {error ? <p className="error">{error}</p> : null}
        <section className="grid">
          {courses.map((course) => (
            <Link
              className="card"
              key={course.id}
              href={
                user?.roles.includes("admin") ||
                user?.roles.includes("teacher") ||
                (course.groups?.length ?? 0) !== 1
                  ? `/courses/${course.id}`
                  : `/courses/${course.id}/groups/${course.groups?.[0]?.id ?? ""}`
              }
            >
              <span className="eyebrow">{t(`status.${course.status}`)}</span>
              <h2>{course.title}</h2>
              {course.description ? (
                <MarkdownRenderer markdown={course.description} className="muted" compact />
              ) : (
                <p className="muted">{t("courses.emptyDescription")}</p>
              )}
              <p className="muted">{t("courses.activityCount", { count: course.activities?.length ?? 0 })}</p>
            </Link>
          ))}
        </section>
      </main>
    </AppShell>
  );
}
