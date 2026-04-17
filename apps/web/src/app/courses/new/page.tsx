"use client";

import { useRouter } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { CourseForm } from "@/components/course-form";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

export default function NewCoursePage() {
  const router = useRouter();
  const { t } = useI18n();

  return (
    <AppShell>
      <main className="page stack">
        <section>
          <p className="eyebrow">{t("newCourse.eyebrow")}</p>
          <h1>{t("newCourse.title")}</h1>
        </section>
        <section className="section">
          <CourseForm
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
