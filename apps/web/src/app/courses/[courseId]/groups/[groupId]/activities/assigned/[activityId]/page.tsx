"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/components/auth-provider";
import { api, Activity, ActivityDefinition, Course, CourseGroup, StudentGradeFeedback, StudentReleasedGradeRow } from "@/lib/api";
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
  const [releasedGrade, setReleasedGrade] = useState<StudentReleasedGradeRow | null>(null);
  const [hasQuestionAuthoringAgent, setHasQuestionAuthoringAgent] = useState(false);
  const [error, setError] = useState("");

  const membershipRole = course?.memberships?.find((membership) => membership.userId === user?.id)?.role;
  const canManage = user?.roles.includes("admin") || membershipRole === "owner" || membershipRole === "teacher";
  const ActivityRenderer =
    activity && activityDefinitions.some((definition) => definition.key === activity.activityType.key)
      ? activityRenderers[activity.activityType.key as keyof typeof activityRenderers]
      : null;

  useEffect(() => {
    async function refresh() {
      const [courseResult, groupResult, activityResult, typeResult, aiAgentResult] = await Promise.all([
        api.course(courseId),
        api.group(courseId, groupId),
        api.groupActivity(courseId, groupId, activityId),
        api.activityTypes(),
        api.aiAgentConnections()
      ]);
      setCourse(courseResult.course);
      setGroup(groupResult.group);
      setActivity(activityResult.activity);
      setActivityDefinitions(typeResult.registeredDefinitions);
      setHasQuestionAuthoringAgent(
        aiAgentResult.connections.some((connection) => connection.id === aiAgentResult.preferences.questionAuthoringAiAgentConnectionId && connection.isEnabled)
      );

      const role = courseResult.course.memberships?.find((membership) => membership.userId === user?.id)?.role;
      const userCanManage = user?.roles.includes("admin") || role === "owner" || role === "teacher";
      if (userCanManage) {
        setReleasedGrade(null);
      } else {
        const gradesResult = await api.studentGroupGrades(courseId, groupId);
        const gradeRow = gradesResult.grades.rows.find((row) => row.activityId === activityId && row.score !== null) ?? null;
        setReleasedGrade(gradeRow);
      }
    }

    refresh().catch((err) => setError(err instanceof Error ? err.message : t("activityPage.loadError")));
  }, [activityId, courseId, groupId, t, user]);

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

        {releasedGrade ? (
          <section className="section stack">
            <div>
              <p className="eyebrow">{t("groupPage.releasedGradeEyebrow")}</p>
              <h2>{formatGradebookScore(releasedGrade.score, releasedGrade.maxScore)}</h2>
              {releasedGrade.latePenaltyApplied && releasedGrade.latePenaltyPercent !== null ? (
                <p className="muted">-{releasedGrade.latePenaltyPercent}%</p>
              ) : null}
              <StudentFeedback feedback={releasedGrade.feedback} maxScore={releasedGrade.maxScore} t={t} />
            </div>
          </section>
        ) : null}

        {activity && ActivityRenderer ? (
          <ActivityRenderer
            activity={activity}
            activityRouteCourseId={courseId}
            canManage={Boolean(canManage)}
            course={course ? { id: course.id, title: course.title } : null}
            groupId={groupId}
            hasQuestionAuthoringAgent={hasQuestionAuthoringAgent}
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

function StudentFeedback({
  feedback,
  maxScore,
  t
}: {
  feedback: StudentGradeFeedback | null;
  maxScore: number;
  t: (key: string, params?: Record<string, string | number>) => string;
}) {
  if (!feedback) {
    return null;
  }

  return (
    <div className="stack stack-tight">
      {feedback.feedbackText ? (
        <div className="stack stack-tight">
          <strong>{t("groupPage.feedbackTitle")}</strong>
          <p className="muted">{feedback.feedbackText}</p>
        </div>
      ) : null}
      {feedback.messages.length ? (
        <div className="stack stack-tight">
          <strong>{t("groupPage.feedbackTitle")}</strong>
          {feedback.messages.map((message) => (
            <p className="muted" key={message.type}>
              {message.type === "order"
                ? t("parsons.orderFeedback", { count: message.count })
                : t("parsons.indentFeedback", { count: message.count })}
            </p>
          ))}
        </div>
      ) : null}
      {feedback.grading.length ? (
        <div className="stack stack-tight">
          <strong>{t("groupPage.gradingBreakdownTitle")}</strong>
          {scaleFeedbackGrading(feedback, maxScore).map((component) => (
            <p className="muted" key={component.type}>
              {t(component.type === "order" ? "groupPage.parsonsOrderScore" : "groupPage.parsonsIndentationScore", {
                score: formatGradeNumber(component.awarded),
                max: formatGradeNumber(component.possible)
              })}
            </p>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function scaleFeedbackGrading(feedback: StudentGradeFeedback, maxScore: number) {
  const rawTotal = feedback.grading.reduce((sum, component) => sum + component.possibleRaw, 0);
  const scale = rawTotal > 0 ? maxScore / rawTotal : 1;
  return feedback.grading.map((component) => ({
    type: component.type,
    awarded: component.awardedRaw * scale,
    possible: component.possibleRaw * scale
  }));
}

function formatGradebookScore(score: number | null, maxScore: number) {
  if (score === null) {
    return "-";
  }
  return `${formatGradeNumber(score)} / ${formatGradeNumber(maxScore)}`;
}

function formatGradeNumber(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}
