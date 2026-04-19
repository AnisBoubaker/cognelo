"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/components/auth-provider";
import { api, Activity, Course } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { activityRenderers } from "@/lib/activity-renderers";

export default function ActivityPage() {
  const params = useParams<{ courseId: string; activityId: string }>();
  const { courseId, activityId } = params;
  const { user } = useAuth();
  const { t } = useI18n();
  const [course, setCourse] = useState<Course | null>(null);
  const [activity, setActivity] = useState<Activity | null>(null);
  const [error, setError] = useState("");

  const canManage = user?.roles.includes("admin") || user?.roles.includes("teacher");
  const ActivityRenderer = activity ? activityRenderers[activity.activityType.key as keyof typeof activityRenderers] : null;

  useEffect(() => {
    async function refresh() {
      const [courseResult, activityResult] = await Promise.all([api.course(courseId), api.activity(courseId, activityId)]);
      setCourse(courseResult.course);
      setActivity(activityResult.activity);
    }

    refresh().catch((err) => setError(err instanceof Error ? err.message : t("activityPage.loadError")));
  }, [activityId, courseId, t]);

  async function saveActivity(input: { title: string; description: string; config: Record<string, unknown> }) {
    const result = await api.updateActivity(courseId, activityId, input);
    setActivity(result.activity);
    return result.activity;
  }

  return (
    <AppShell>
      <main className="page stack">
        <section className="hero-panel stack">
          <div className="hero-meta">
            <p className="eyebrow">{activity?.activityType.name ?? t("common.loading")}</p>
            <h1>{activity?.title ?? t("common.loading")}</h1>
            <p className="muted">{course ? `${t("parsons.inCourse", { title: course.title })}` : t("common.loading")}</p>
          </div>
          <div className="row">
            <Link className="button secondary" href={`/courses/${courseId}`}>
              {t("parsons.backToCourse")}
            </Link>
          </div>
        </section>

        {error ? <p className="error">{error}</p> : null}

        {activity && ActivityRenderer ? (
          <ActivityRenderer activity={activity} canManage={Boolean(canManage)} course={course} onSave={saveActivity} t={t} />
        ) : activity ? (
          <section className="section stack">
            <h2>{t("parsons.unsupportedTitle")}</h2>
            <p className="muted">{t("parsons.unsupportedText")}</p>
          </section>
        ) : (
          <p>{t("common.loading")}</p>
        )}
      </main>
    </AppShell>
  );
}
