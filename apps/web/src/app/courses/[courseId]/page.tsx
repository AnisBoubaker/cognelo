"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { api, ActivityType, Course } from "@/lib/api";

export default function CourseDetailPage() {
  const params = useParams<{ courseId: string }>();
  const courseId = params.courseId;
  const [course, setCourse] = useState<Course | null>(null);
  const [activityTypes, setActivityTypes] = useState<ActivityType[]>([]);
  const [activityTitle, setActivityTitle] = useState("Placeholder activity");
  const [activityTypeKey, setActivityTypeKey] = useState("placeholder");
  const [error, setError] = useState("");

  async function refresh() {
    const [courseResult, typeResult] = await Promise.all([api.course(courseId), api.activityTypes()]);
    setCourse(courseResult.course);
    setActivityTypes(typeResult.activityTypes);
  }

  useEffect(() => {
    refresh().catch((err) => setError(err instanceof Error ? err.message : "Unable to load course."));
  }, [courseId]);

  async function createActivity(event: FormEvent) {
    event.preventDefault();
    setError("");
    try {
      await api.createActivity(courseId, {
        title: activityTitle,
        activityTypeKey,
        lifecycle: "draft",
        description: "",
        config: {},
        metadata: { researchTags: [] },
        position: course?.activities?.length ?? 0
      });
      await refresh();
      setActivityTitle("Placeholder activity");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create activity.");
    }
  }

  return (
    <AppShell>
      <main className="page stack">
        {course ? (
          <>
            <section className="row">
              <div>
                <p className="eyebrow">{course.status}</p>
                <h1>{course.title}</h1>
                <p className="muted">{course.description || "No description yet."}</p>
              </div>
              <Link className="button secondary" href={`/courses/${course.id}/edit`}>
                Edit
              </Link>
            </section>
            {error ? <p className="error">{error}</p> : null}
            <div className="split">
              <section className="section stack">
                <div>
                  <p className="eyebrow">Activities</p>
                  <h2>Attached activities</h2>
                </div>
                {course.activities?.length ? (
                  course.activities.map((activity) => (
                    <article className="card" key={activity.id}>
                      <span className="eyebrow">{activity.activityType.name}</span>
                      <h3>{activity.title}</h3>
                      <p className="muted">Lifecycle: {activity.lifecycle}</p>
                    </article>
                  ))
                ) : (
                  <p className="muted">No activities yet.</p>
                )}
              </section>
              <section className="section">
                <form className="form" onSubmit={createActivity}>
                  <div>
                    <p className="eyebrow">Activity shell</p>
                    <h2>Add activity</h2>
                  </div>
                  <div className="field">
                    <label htmlFor="activityTitle">Title</label>
                    <input
                      id="activityTitle"
                      value={activityTitle}
                      onChange={(event) => setActivityTitle(event.target.value)}
                      required
                      minLength={2}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="activityType">Type</label>
                    <select
                      id="activityType"
                      value={activityTypeKey}
                      onChange={(event) => setActivityTypeKey(event.target.value)}
                    >
                      {activityTypes.map((type) => (
                        <option key={type.id} value={type.key}>
                          {type.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <button type="submit">Attach activity</button>
                </form>
              </section>
            </div>
            <section className="section stack">
              <div>
                <p className="eyebrow">Materials</p>
                <h2>Course material</h2>
              </div>
              {course.materials?.length ? (
                course.materials.map((material) => (
                  <article className="card" key={material.id}>
                    <span className="eyebrow">{material.kind}</span>
                    <h3>{material.title}</h3>
                    <p className="muted">{material.body || material.url || "Material metadata only."}</p>
                  </article>
                ))
              ) : (
                <p className="muted">No materials yet.</p>
              )}
            </section>
          </>
        ) : (
          <p>Loading course...</p>
        )}
      </main>
    </AppShell>
  );
}
