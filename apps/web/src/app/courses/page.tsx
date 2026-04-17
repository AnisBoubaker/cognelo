"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { api, Course } from "@/lib/api";

export default function CoursesPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .courses()
      .then((result) => setCourses(result.courses))
      .catch((err) => setError(err instanceof Error ? err.message : "Unable to load courses."));
  }, []);

  return (
    <AppShell>
      <main className="page stack">
        <div className="row">
          <div>
            <p className="eyebrow">Courses</p>
            <h1>Course workspace</h1>
          </div>
          <Link className="button" href="/courses/new">
            Create course
          </Link>
        </div>
        {error ? <p className="error">{error}</p> : null}
        <section className="grid">
          {courses.map((course) => (
            <Link className="card" key={course.id} href={`/courses/${course.id}`}>
              <span className="eyebrow">{course.status}</span>
              <h2>{course.title}</h2>
              <p className="muted">{course.description || "No description yet."}</p>
              <p className="muted">{course.activities?.length ?? 0} activities</p>
            </Link>
          ))}
        </section>
      </main>
    </AppShell>
  );
}
