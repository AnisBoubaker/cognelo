"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { StudentPreviewBanner } from "@/components/student-preview-banner";
import { activityRenderers } from "@/lib/activity-renderers";
import { api, type Activity, type ActivityDefinition, type StudentPreviewWorkspace } from "@/lib/api";
import { clearStudentPreviewSession } from "@/lib/student-preview-state-host";
import { useI18n } from "@/lib/i18n";

export default function StudentViewActivityPage() {
  const { courseId, groupId, activityId } = useParams<{ courseId: string; groupId: string; activityId: string }>();
  const searchParams = useSearchParams();
  const { locale, t } = useI18n();
  const [sessionId, setSessionId] = useState(() => searchParams.get("previewSession") || crypto.randomUUID());
  const [workspace, setWorkspace] = useState<StudentPreviewWorkspace | null>(null);
  const [activity, setActivity] = useState<Activity | null>(null);
  const [definitions, setDefinitions] = useState<ActivityDefinition[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    window.history.replaceState({}, "", `/courses/${courseId}/groups/${groupId}/student-view/activities/${activityId}?previewSession=${encodeURIComponent(sessionId)}`);
  }, [activityId, courseId, groupId, sessionId]);

  useEffect(() => {
    Promise.all([
      api.studentPreviewWorkspace(courseId, groupId),
      api.studentPreviewActivity(courseId, groupId, activityId),
      api.activityTypes()
    ]).then(([workspaceResult, activityResult, typeResult]) => {
      setWorkspace(workspaceResult.workspace);
      setActivity(activityResult.activity);
      setDefinitions(typeResult.registeredDefinitions);
    }).catch((reason) => setError(reason instanceof Error ? reason.message : t("studentView.loadError")));
  }, [activityId, courseId, groupId, t]);

  const Renderer = activity && definitions.some((definition) => definition.key === activity.activityType.key)
    ? activityRenderers[activity.activityType.key as keyof typeof activityRenderers]
    : null;
  const backHref = `/courses/${courseId}/groups/${groupId}/student-view?previewSession=${encodeURIComponent(sessionId)}`;

  function resetPreview() {
    clearStudentPreviewSession(courseId, groupId, sessionId);
    setSessionId(crypto.randomUUID());
  }

  return (
    <AppShell>
      <main className="page stack">
        <StudentPreviewBanner groupTitle={workspace?.group.title} onReset={resetPreview} t={t} />
        <section className="hero-panel hero-panel-compact">
          <div className="hero-meta"><p className="eyebrow">{activity?.activityType.name ?? t("common.loading")}</p><h1>{activity?.title ?? t("common.loading")}</h1><p className="muted">{workspace ? `${workspace.course.title} · ${workspace.group.title}` : ""}</p></div>
          <div className="hero-actions"><Link className="button secondary" href={backHref}>{t("groupPage.backToCourse")}</Link></div>
        </section>
        {error ? <p className="error">{error}</p> : null}
        {activity?.assignment?.metadata?.requireSafeExamBrowser === true ? <p className="inline-panel">{t("studentView.safeExamBrowserNotice")}</p> : null}
        {activity?.activityType.key === "coding-homework-grader" ? (
          <section className="section stack"><h2>{activity.title}</h2><p className="muted">{t("studentView.uploadActivityUnavailable")}</p></section>
        ) : activity && Renderer && workspace ? (
          <Renderer
            key={sessionId}
            activity={activity}
            activityRouteCourseId={courseId}
            canManage={false}
            course={{ id: workspace.course.id, title: workspace.course.title }}
            groupId={groupId}
            locale={locale}
            onSave={async () => activity}
            onSubmitted={() => undefined}
            studentPreview={{ sessionId }}
            studentViewMode="attempt"
            t={t}
          />
        ) : activity ? <section className="section"><p className="muted">{t("studentView.unsupportedActivity")}</p></section> : !error ? <p>{t("common.loading")}</p> : null}
      </main>
    </AppShell>
  );
}
