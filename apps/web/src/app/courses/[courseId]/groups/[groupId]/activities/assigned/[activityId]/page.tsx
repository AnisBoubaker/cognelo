"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/components/auth-provider";
import { api, Activity, ActivityDefinition, Course, CourseGroup } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { activityRenderers } from "@/lib/activity-renderers";

export default function GroupActivityPage() {
  const params = useParams<{ courseId: string; groupId: string; activityId: string }>();
  const { courseId, groupId, activityId } = params;
  const { user } = useAuth();
  const { locale, t } = useI18n();
  const [course, setCourse] = useState<Course | null>(null);
  const [group, setGroup] = useState<CourseGroup | null>(null);
  const [activity, setActivity] = useState<Activity | null>(null);
  const [activityDefinitions, setActivityDefinitions] = useState<ActivityDefinition[]>([]);
  const [error, setError] = useState("");

  const membershipRole = course?.memberships?.find((membership) => membership.userId === user?.id)?.role;
  const canManage = user?.roles.includes("admin") || membershipRole === "owner" || membershipRole === "teacher";
  const ActivityRenderer = activity ? activityRenderers[activity.activityType.key as keyof typeof activityRenderers] : null;

  useEffect(() => {
    async function refresh() {
      const [courseResult, groupResult, activityResult, typeResult] = await Promise.all([
        api.course(courseId),
        api.group(courseId, groupId),
        api.groupActivity(courseId, groupId, activityId),
        api.activityTypes()
      ]);
      setCourse(courseResult.course);
      setGroup(groupResult.group);
      setActivity(activityResult.activity);
      setActivityDefinitions(typeResult.registeredDefinitions);
    }

    refresh().catch((err) => setError(err instanceof Error ? err.message : t("activityPage.loadError")));
  }, [activityId, courseId, groupId, t]);

  async function saveActivity(input: { title: string; description: string; config: Record<string, unknown> }) {
    const result = await api.updateActivity(courseId, activityId, input);
    setActivity(result.activity);
    return result.activity;
  }

  function localizedActivityName() {
    if (!activity) {
      return t("common.loading");
    }

    const definition = activityDefinitions.find((candidate) => candidate.key === activity.activityType.key);
    const localized = definition?.i18n?.[locale];
    return localized?.name ?? definition?.name ?? activity.activityType.name;
  }

  return (
    <AppShell>
      <main className="page stack">
        <section className="hero-panel hero-panel-compact">
          <div className="hero-meta">
            <p className="eyebrow">{localizedActivityName()}</p>
            <h1>{activity?.title ?? t("common.loading")}</h1>
            <p className="muted">
              {group ? group.title : t("common.loading")}
              {course ? ` · ${course.title}` : ""}
            </p>
          </div>
          <div className="hero-actions">
            <Link className="button secondary" href={`/courses/${courseId}/groups/${groupId}`}>
              {t("groupPage.backToCourse")}
            </Link>
          </div>
        </section>

        {error ? <p className="error">{error}</p> : null}

        {activity && ActivityRenderer ? (
          <ActivityRenderer
            activity={activity}
            canManage={Boolean(canManage)}
            course={course ? { id: course.id, title: course.title } : null}
            groupId={groupId}
            onSave={saveActivity}
            t={t}
            locale={locale}
          />
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
