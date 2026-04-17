"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { CourseForm } from "@/components/course-form";
import { api, Course } from "@/lib/api";

export default function EditCoursePage() {
  const params = useParams<{ courseId: string }>();
  const courseId = params.courseId;
  const router = useRouter();
  const [course, setCourse] = useState<Course | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .course(courseId)
      .then((result) => setCourse(result.course))
      .catch((err) => setError(err instanceof Error ? err.message : "Unable to load course."));
  }, [courseId]);

  return (
    <AppShell>
      <main className="page stack">
        <section>
          <p className="eyebrow">Edit course</p>
          <h1>{course?.title ?? "Course"}</h1>
        </section>
        {error ? <p className="error">{error}</p> : null}
        {course ? (
          <section className="section">
            <CourseForm
              initial={course}
              submitLabel="Save course"
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
