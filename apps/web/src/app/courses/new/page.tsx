"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { CourseForm } from "@/components/course-form";
import { api, type Subject } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

export default function NewCoursePage() {
  const router = useRouter();
  const { t } = useI18n();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .subjects()
      .then((result) => setSubjects(result.subjects))
      .catch((err) => setError(err instanceof Error ? err.message : t("courses.loadError")));
  }, [t]);

  return (
    <AppShell>
      <main className="page stack">
        <section>
          <p className="eyebrow">{t("newCourse.eyebrow")}</p>
          <h1>{t("newCourse.title")}</h1>
        </section>
        {error ? <p className="error">{error}</p> : null}
        <section className="section">
          <CourseForm
            subjects={subjects}
            submitLabel={t("courseForm.create")}
            onSubmit={async (input) => {
              const result = await api.createCourse(input);
              router.push(`/courses/${result.course.id}`);
            }}
          />
        </section>
      </main>
    </AppShell>
  );
}
