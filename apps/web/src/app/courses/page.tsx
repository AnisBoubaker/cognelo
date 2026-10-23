"use client";

import { AppIcon } from "@/components/app-icon";

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
  const canCreateCourses =
    user?.roles.includes("admin") || user?.roles.includes("course_manager") || user?.roles.includes("teacher");

  useEffect(() => {
    api
      .courses()
      .then((result) => setCourses(result.courses))
      .catch((err) => setError(err instanceof Error ? err.message : t("courses.loadError")));
  }, [t]);

  return (
    <AppShell>
      <main className="page stack">
        <h1 className="sr-only">{t("courses.title")}</h1>
        {error ? <p className="error">{error}</p> : null}
        {canCreateCourses ? (
          <div className="section-actions">
            <Link className="button" href="/courses/new"><AppIcon name="add" /> {t("courses.create")}</Link>
          </div>
        ) : null}
        <section className="grid">
          {courses.map((course) => (
            <Link
              className="card"
              key={course.id}
              href={
                user?.roles.includes("admin") ||
                user?.roles.includes("course_manager") ||
                user?.roles.includes("teacher") ||
                (course.groups?.length ?? 0) !== 1
                  ? `/courses/${course.id}`
                  : `/courses/${course.id}/groups/${course.groups?.[0]?.id ?? ""}`
              }
            >
              {user?.roles.includes("admin") || course.memberships?.some((membership) => membership.userId === user?.id && membership.role !== "student") ? (
                <span className="eyebrow">{t(`status.${course.status}`)}</span>
              ) : null}
              <h2>{course.title}</h2>
              {course.subject ? <p className="muted">{course.subject.title}</p> : null}
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
