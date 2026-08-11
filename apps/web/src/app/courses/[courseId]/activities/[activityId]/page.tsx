"use client";

import Link from "next/link";
import type { ActivityKnowledgeConceptSelection } from "@cognelo/contracts";
import { useParams, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { ActivityEditorTabs } from "@/components/activity-editor-tabs";
import { useAuth } from "@/components/auth-provider";
import { api, Activity, ActivityDefinition, Course } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { activityRenderers } from "@/lib/activity-renderers";

export default function ActivityPage() {
  const params = useParams<{ courseId: string; activityId: string }>();
  const { courseId, activityId } = params;
  const searchParams = useSearchParams();
  const testActivityId = searchParams.get("testActivityId");
  const { user } = useAuth();
  const { locale, t } = useI18n();
  const [course, setCourse] = useState<Course | null>(null);
  const [activity, setActivity] = useState<Activity | null>(null);
  const [activityDefinitions, setActivityDefinitions] = useState<ActivityDefinition[]>([]);
  const [hasQuestionAuthoringAgent, setHasQuestionAuthoringAgent] = useState(false);
  const [error, setError] = useState("");
  const conceptDraftRef = useRef<ActivityKnowledgeConceptSelection[]>([]);
  const updateConceptDraft = useCallback((selections: ActivityKnowledgeConceptSelection[]) => { conceptDraftRef.current = selections; }, []);

  const canManage = user?.roles.includes("admin") || user?.roles.includes("teacher");
  const ActivityRenderer =
    activity && activityDefinitions.some((definition) => definition.key === activity.activityType.key)
      ? activityRenderers[activity.activityType.key as keyof typeof activityRenderers]
      : null;

  useEffect(() => {
    async function refresh() {
      const [courseResult, activityResult, typeResult, aiAgentResult] = await Promise.all([
        api.course(courseId),
        api.activity(courseId, activityId),
        api.activityTypes(),
        api.aiAgentConnections()
      ]);
      setCourse(courseResult.course);
      setActivity(activityResult.activity);
      conceptDraftRef.current = activityResult.activity.knowledgeConcepts?.map((link) => ({ conceptId: link.conceptId, selectsAllSkills: link.selectsAllSkills, selectedSkills: link.selectedSkills })) ?? [];
      setActivityDefinitions(typeResult.registeredDefinitions);
      setHasQuestionAuthoringAgent(
        aiAgentResult.connections.some((connection) => connection.id === aiAgentResult.preferences.questionAuthoringAiAgentConnectionId && connection.isEnabled)
      );
    }

    refresh().catch((err) => setError(err instanceof Error ? err.message : t("activityPage.loadError")));
  }, [activityId, courseId, t]);

  async function saveActivity(input: { title: string; description: string; config: Record<string, unknown> }) {
    const result = await api.updateActivity(courseId, activityId, { ...input, knowledgeConceptSelections: conceptDraftRef.current });
    setActivity(result.activity);
    return result.activity;
  }

  async function saveConcepts(knowledgeConceptSelections: ActivityKnowledgeConceptSelection[]) {
    conceptDraftRef.current = knowledgeConceptSelections;
    const result = await api.updateActivity(courseId, activityId, { knowledgeConceptSelections });
    setActivity(result.activity);
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
            <p className="muted">{course ? `${t("parsons.inCourse", { title: course.title })}` : t("common.loading")}</p>
          </div>
          <div className="hero-actions">
            <Link className="button secondary" href={testActivityId ? `/courses/${courseId}/activities/${testActivityId}` : `/courses/${courseId}`}>
              {testActivityId ? "Back to Test" : t("parsons.backToCourse")}
            </Link>
          </div>
        </section>

        {error ? <p className="error">{error}</p> : null}

        {activity && ActivityRenderer && canManage ? (
          <ActivityEditorTabs
            concepts={course?.subject?.knowledgeConcepts ?? []}
            prerequisites={course?.subject?.knowledgePrerequisites ?? []}
            selectedConcepts={activity.knowledgeConcepts?.map((link) => ({ conceptId: link.conceptId, selectsAllSkills: link.selectsAllSkills, selectedSkills: link.selectedSkills })) ?? []}
            onSaveConcepts={saveConcepts}
            onConceptDraftChange={updateConceptDraft}
            t={t}
            locale={locale}
          >
          <ActivityRenderer
            activity={activity}
            activityRouteCourseId={courseId}
            canManage={Boolean(canManage)}
            course={course}
            hasQuestionAuthoringAgent={hasQuestionAuthoringAgent}
            onSave={saveActivity}
            t={t}
            locale={locale}
          />
          </ActivityEditorTabs>
        ) : activity && ActivityRenderer ? (
          <ActivityRenderer
            activity={activity}
            activityRouteCourseId={courseId}
            canManage={false}
            course={course}
            hasQuestionAuthoringAgent={hasQuestionAuthoringAgent}
            onSave={saveActivity}
            t={t}
            locale={locale}
          />
        ) : activity && canManage ? (
          <ActivityEditorTabs
            concepts={course?.subject?.knowledgeConcepts ?? []}
            prerequisites={course?.subject?.knowledgePrerequisites ?? []}
            selectedConcepts={activity.knowledgeConcepts?.map((link) => ({ conceptId: link.conceptId, selectsAllSkills: link.selectsAllSkills, selectedSkills: link.selectedSkills })) ?? []}
            onSaveConcepts={saveConcepts}
            onConceptDraftChange={updateConceptDraft}
            t={t}
            locale={locale}
          >
            <section className="section stack">
              <h2>{t("parsons.unsupportedTitle")}</h2>
              <p className="muted">{t("parsons.unsupportedText")}</p>
            </section>
          </ActivityEditorTabs>
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
