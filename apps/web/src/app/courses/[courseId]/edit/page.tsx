"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { CourseForm } from "@/components/course-form";
import { api, Course } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

export default function EditCoursePage() {
  const params = useParams<{ courseId: string }>();
  const courseId = params.courseId;
  const router = useRouter();
  const { t } = useI18n();
  const [course, setCourse] = useState<Course | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .course(courseId)
      .then((result) => setCourse(result.course))
      .catch((err) => setError(err instanceof Error ? err.message : t("editCourse.loadError")));
  }, [courseId, t]);

  return (
    <AppShell>
      <main className="page stack">
        <section>
          <p className="eyebrow">{t("editCourse.eyebrow")}</p>
          <h1>{course?.title ?? t("editCourse.fallbackTitle")}</h1>
        </section>
        {error ? <p className="error">{error}</p> : null}
        {course ? (
          <section className="section">
            <CourseForm
              initial={course}
              submitLabel={t("courseForm.save")}
              onSubmit={async (input) => {
                const result = await api.updateCourse(courseId, input);
                router.push(`/courses/${result.course.id}`);
              }}
            />
          </section>
        ) : null}
      </main>
    </AppShell>
  );
}
