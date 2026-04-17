"use client";

import { useRouter } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { CourseForm } from "@/components/course-form";
import { api } from "@/lib/api";

export default function NewCoursePage() {
  const router = useRouter();

  return (
    <AppShell>
      <main className="page stack">
        <section>
          <p className="eyebrow">New course</p>
          <h1>Create a course</h1>
        </section>
        <section className="section">
          <CourseForm
            submitLabel="Create course"
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
