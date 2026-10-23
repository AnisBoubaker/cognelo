"use client";

import { AppIcon } from "@/components/app-icon";

import Link from "next/link";
import type { ActivityKnowledgeConceptSelection } from "@cognelo/contracts";
import { useParams, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { ActivityEditorTabs } from "@/components/activity-editor-tabs";
import { api, Activity, ActivityDefinition, Course } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { activityEditorHref, activityReportHref, activityReportReturnContext } from "@/lib/activity-editor-navigation";
import { activityRenderers } from "@/lib/activity-renderers";

export default function ActivityPage() {
  const params = useParams<{ courseId: string; activityId: string }>();
  const { courseId, activityId } = params;
  const searchParams = useSearchParams();
  const testActivityId = searchParams.get("testActivityId");
  const returnContext = activityReportReturnContext(searchParams);
  const { locale, t } = useI18n();
  const [course, setCourse] = useState<Course | null>(null);
  const [activity, setActivity] = useState<Activity | null>(null);
  const [activityDefinitions, setActivityDefinitions] = useState<ActivityDefinition[]>([]);
  const [hasQuestionAuthoringAgent, setHasQuestionAuthoringAgent] = useState(false);
  const [error, setError] = useState("");
  const conceptDraftRef = useRef<ActivityKnowledgeConceptSelection[]>([]);
  const updateConceptDraft = useCallback((selections: ActivityKnowledgeConceptSelection[]) => { conceptDraftRef.current = selections; }, []);

  const canManage = Boolean(course?.permissions?.canManageCourse);
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
      conceptDraftRef.current = activityResult.activity.knowledgeConcepts?.map((link) => ({ conceptId: link.conceptId, selectsAllSkills: link.selectsAllSkills, selectedSkills: link.selectedSkills, selectedSkillIds: link.selectedSkillIds, selectedMisconceptions: link.selectedMisconceptions, selectedMisconceptionIds: link.selectedMisconceptionIds })) ?? [];
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

  const backHref = testActivityId
    ? activityEditorHref(courseId, testActivityId, returnContext)
    : returnContext ? activityReportHref(courseId, activityId, returnContext) : `/courses/${courseId}`;
  const backLabel = testActivityId ? t("courseDetail.backToTest")
    : returnContext ? t(returnContext.report === "overview" ? "courseDetail.backToActivityOverview" : "courseDetail.backToStudentResults")
      : t("parsons.backToCourse");

  const activityContext = (
    <div className="row activity-editor-context">
      <div className="workspace-context">
        <h1>{activity?.title ?? t("common.loading")}</h1>
        <span className="muted">{course?.title} · {localizedActivityName()}</span>
      </div>
      <Link className="button secondary" href={backHref}>
        <AppIcon name="back" />
        {backLabel}
      </Link>
    </div>
  );

  return (
    <AppShell>
      <main className="page stack">
        {error ? <p className="error">{error}</p> : null}

        {!canManage ? activityContext : null}
        {activity && ActivityRenderer && canManage ? (
          <ActivityEditorTabs
            toolbar={activityContext}
            concepts={course?.subject?.knowledgeConcepts ?? []}
            prerequisites={course?.subject?.knowledgePrerequisites ?? []}
            selectedConcepts={activity.knowledgeConcepts?.map((link) => ({ conceptId: link.conceptId, selectsAllSkills: link.selectsAllSkills, selectedSkills: link.selectedSkills, selectedSkillIds: link.selectedSkillIds, selectedMisconceptions: link.selectedMisconceptions, selectedMisconceptionIds: link.selectedMisconceptionIds })) ?? []}
            onSaveConcepts={saveConcepts}
            onConceptDraftChange={updateConceptDraft}
            t={t}
            locale={locale}
            showGradingTab={activityDefinitions.find((definition) => definition.key === activity.activityType.key)?.authoring?.gradingTab === true}
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
            toolbar={activityContext}
            concepts={course?.subject?.knowledgeConcepts ?? []}
            prerequisites={course?.subject?.knowledgePrerequisites ?? []}
            selectedConcepts={activity.knowledgeConcepts?.map((link) => ({ conceptId: link.conceptId, selectsAllSkills: link.selectsAllSkills, selectedSkills: link.selectedSkills, selectedSkillIds: link.selectedSkillIds, selectedMisconceptions: link.selectedMisconceptions, selectedMisconceptionIds: link.selectedMisconceptionIds })) ?? []}
            onSaveConcepts={saveConcepts}
            onConceptDraftChange={updateConceptDraft}
            t={t}
            locale={locale}
            showGradingTab={activityDefinitions.find((definition) => definition.key === activity.activityType.key)?.authoring?.gradingTab === true}
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
