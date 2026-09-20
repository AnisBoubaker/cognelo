"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { TestGradeBreakdown } from "@/components/test-grade-breakdown";
import { useAuth } from "@/components/auth-provider";
import { api, ApiError, Activity, ActivityDefinition, Course, CourseGroup, DeletedSubmissionAudit, GradeChallenge, SafeExamBrowserAccess, SafeExamBrowserLaunch, StudentGradeFeedback, StudentReleasedGradeRow } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { activityRenderers } from "@/lib/activity-renderers";
import { readSafeExamBrowserProof } from "@/lib/safe-exam-browser";

export default function GroupActivityPage() {
  const params = useParams<{ courseId: string; groupId: string; activityId: string }>();
  const { courseId, groupId, activityId } = params;
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const { locale, t } = useI18n();
  const [course, setCourse] = useState<Course | null>(null);
  const [group, setGroup] = useState<CourseGroup | null>(null);
  const [activity, setActivity] = useState<Activity | null>(null);
  const [activityDefinitions, setActivityDefinitions] = useState<ActivityDefinition[]>([]);
  const [releasedGrade, setReleasedGrade] = useState<StudentReleasedGradeRow | null>(null);
  const [gradeChallenges, setGradeChallenges] = useState<GradeChallenge[]>([]);
  const [challengeExplanation, setChallengeExplanation] = useState("");
  const [selectedChallengeReferenceKey, setSelectedChallengeReferenceKey] = useState("");
  const [isSubmittingChallenge, setIsSubmittingChallenge] = useState(false);
  const [deletedSubmissions, setDeletedSubmissions] = useState<DeletedSubmissionAudit[]>([]);
  const [canStartNewAttempt, setCanStartNewAttempt] = useState<boolean | null>(null);
  const [hasPreviousSubmissions, setHasPreviousSubmissions] = useState<boolean | null>(null);
  const [selectedTab, setSelectedTab] = useState<"attempt" | "previous" | "deleted">("attempt");
  const [isActivityUnavailable, setIsActivityUnavailable] = useState(false);
  const [hasQuestionAuthoringAgent, setHasQuestionAuthoringAgent] = useState(false);
  const [safeExamBrowserAccess, setSafeExamBrowserAccess] = useState<SafeExamBrowserAccess | null>(null);
  const [safeExamBrowserLaunch, setSafeExamBrowserLaunch] = useState<SafeExamBrowserLaunch | null>(null);
  const [isSafeExamBrowserGateOpen, setIsSafeExamBrowserGateOpen] = useState(false);
  const [isPreparingSafeExamBrowser, setIsPreparingSafeExamBrowser] = useState(false);
  const [safeExamBrowserError, setSafeExamBrowserError] = useState("");
  const [error, setError] = useState("");
  const safeExamBrowserLaunchRequestRef = useRef(false);
  const aiFeedbackViewRecordedRef = useRef("");
  const safeExamBrowserLaunchToken = searchParams.get("sebLaunch");

  const membershipRole = course?.memberships?.find((membership) => membership.userId === user?.id)?.role;
  const canManage =
    user?.roles.includes("admin") ||
    membershipRole === "owner" ||
    membershipRole === "teacher" ||
    membershipRole === "ta";
  const ActivityRenderer =
    activity && activityDefinitions.some((definition) => definition.key === activity.activityType.key)
      ? activityRenderers[activity.activityType.key as keyof typeof activityRenderers]
      : null;

  useEffect(() => {
    setCanStartNewAttempt(null);
    setHasPreviousSubmissions(null);
    setIsActivityUnavailable(false);
    setSelectedTab("attempt");
    setSafeExamBrowserLaunch(null);
    setIsSafeExamBrowserGateOpen(false);
    setIsPreparingSafeExamBrowser(false);
    safeExamBrowserLaunchRequestRef.current = false;
    aiFeedbackViewRecordedRef.current = "";
    setSafeExamBrowserError("");
    setSelectedChallengeReferenceKey("");
    setChallengeExplanation("");
  }, [activityId, courseId, groupId]);

  useEffect(() => {
    async function refresh() {
      const [courseResult, groupResult, typeResult, aiAgentResult] = await Promise.all([
        api.course(courseId),
        api.group(courseId, groupId),
        api.activityTypes(),
        api.aiAgentConnections()
      ]);
      setCourse(courseResult.course);
      setGroup(groupResult.group);
      setActivityDefinitions(typeResult.registeredDefinitions);
      setHasQuestionAuthoringAgent(
        aiAgentResult.connections.some((connection) => connection.id === aiAgentResult.preferences.questionAuthoringAiAgentConnectionId && connection.isEnabled)
      );

      const role = courseResult.course.memberships?.find((membership) => membership.userId === user?.id)?.role;
      const userCanManage = user?.roles.includes("admin") || role === "owner" || role === "teacher" || role === "ta";
      let sebAccessResult = await api.groupActivitySafeExamBrowserAccess(courseId, groupId, activityId);
      setSafeExamBrowserAccess(sebAccessResult.access);
      if (!userCanManage && sebAccessResult.access.requiresSafeExamBrowser && !sebAccessResult.access.accessGranted) {
        if (safeExamBrowserLaunchToken) {
          try {
            const proof = await readSafeExamBrowserProof(window);
            await api.activateGroupActivitySafeExamBrowser(courseId, groupId, activityId, {
              token: safeExamBrowserLaunchToken,
              ...(proof.configKeyHash ? { configKeyHash: proof.configKeyHash } : {}),
              ...(proof.version ? { version: proof.version } : {})
            });
            window.history.replaceState({}, "", `/courses/${courseId}/groups/${groupId}/activities/assigned/${activityId}`);
            sebAccessResult = await api.groupActivitySafeExamBrowserAccess(courseId, groupId, activityId);
            setSafeExamBrowserAccess(sebAccessResult.access);
            if (!sebAccessResult.access.accessGranted) {
              throw new Error("Safe Exam Browser access was not granted.");
            }
          } catch {
            setActivity(null);
            setIsSafeExamBrowserGateOpen(true);
            setSafeExamBrowserError(t("groupPage.safeExamBrowserActivationError"));
            return;
          }
        } else {
          setActivity(null);
          setReleasedGrade(null);
          setDeletedSubmissions([]);
          setIsSafeExamBrowserGateOpen(true);
          setSafeExamBrowserError("");
          return;
        }
      }
      let activityResult: Awaited<ReturnType<typeof api.groupActivity>>;
      try {
        activityResult = await api.groupActivity(courseId, groupId, activityId);
        setActivity(activityResult.activity);
        setIsActivityUnavailable(false);
      } catch (err) {
        if (!userCanManage && err instanceof ApiError && err.code === "GROUP_ACTIVITY_NOT_AVAILABLE") {
          setActivity(null);
          setReleasedGrade(null);
          setDeletedSubmissions([]);
          setIsActivityUnavailable(true);
          setError("");
          return;
        }
        throw err;
      }

      if (userCanManage) {
        setReleasedGrade(null);
        setDeletedSubmissions([]);
      } else {
        const [gradesResult, submissionsResult] = await Promise.all([
          api.studentGroupGrades(courseId, groupId),
          api.studentActivitySubmissions(courseId, groupId, activityId)
        ]);
        const gradeRow = gradesResult.grades.rows.find((row) => row.activityId === activityId && row.score !== null) ?? null;
        setReleasedGrade(gradeRow);
        setDeletedSubmissions(submissionsResult.audit.deletedSubmissions);
      }
    }

    refresh().catch((err) => setError(err instanceof Error ? err.message : t("activityPage.loadError")));
  }, [activityId, courseId, groupId, safeExamBrowserLaunchToken, t, user]);

  useEffect(() => {
    if (!releasedGrade?.selectedAttemptId) {
      setGradeChallenges([]);
      return;
    }
    api.attemptGradeChallenges(courseId, releasedGrade.selectedAttemptId)
      .then((result) => setGradeChallenges(result.challenges))
      .catch(() => setGradeChallenges([]));
  }, [courseId, releasedGrade?.selectedAttemptId]);

  useEffect(() => {
    if (!releasedGrade?.selectedAttemptId || !hasAiFeedback(releasedGrade.feedback)) return;
    const viewKey = `${releasedGrade.selectedAttemptId}:${releasedGrade.gradedAt ?? "released"}`;
    if (aiFeedbackViewRecordedRef.current === viewKey) return;
    aiFeedbackViewRecordedRef.current = viewKey;
    api.recordActivityAttemptAiFeedbackViewed(courseId, releasedGrade.selectedAttemptId).catch(() => {
      aiFeedbackViewRecordedRef.current = "";
    });
  }, [courseId, releasedGrade]);

  async function submitGradeChallenge() {
    const references = getAiFeedbackReferences(releasedGrade?.feedback);
    const availableReferences = references.filter((reference) => !gradeChallenges.some(
      (challenge) => challenge.feedbackRef === reference.feedbackRef && challenge.feedbackVersion === reference.feedbackVersion
    ));
    const feedbackReference = availableReferences.find((reference) => feedbackReferenceKey(reference) === selectedChallengeReferenceKey)
      ?? availableReferences[0];
    if (!releasedGrade?.selectedAttemptId || !feedbackReference || challengeExplanation.trim().length < 20) return;
    setIsSubmittingChallenge(true);
    try {
      const result = await api.createGradeChallenge(courseId, releasedGrade.selectedAttemptId, {
        ...feedbackReference,
        explanation: challengeExplanation.trim()
      });
      setGradeChallenges((current) => [result.challenge, ...current]);
      setChallengeExplanation("");
      setSelectedChallengeReferenceKey("");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("groupPage.challengeError"));
    } finally {
      setIsSubmittingChallenge(false);
    }
  }

  useEffect(() => {
    if (!isSafeExamBrowserGateOpen || safeExamBrowserLaunch || isPreparingSafeExamBrowser || safeExamBrowserLaunchRequestRef.current) return;
    safeExamBrowserLaunchRequestRef.current = true;
    setIsPreparingSafeExamBrowser(true);
    api.launchGroupActivityInSafeExamBrowser(courseId, groupId, activityId)
      .then((result) => {
        if (!result.launch) throw new Error("Safe Exam Browser launch is unavailable.");
        setSafeExamBrowserLaunch(result.launch);
      })
      .catch(() => setSafeExamBrowserError(t("groupPage.safeExamBrowserLaunchError")))
      .finally(() => setIsPreparingSafeExamBrowser(false));
  }, [activityId, courseId, groupId, isPreparingSafeExamBrowser, isSafeExamBrowserGateOpen, safeExamBrowserLaunch, t]);

  useEffect(() => {
    const newAttemptAvailable = canStartNewAttempt !== false;
    const previousAvailable = hasPreviousSubmissions === true;
    const previousKnownUnavailable = hasPreviousSubmissions === false;
    const deletedAvailable = deletedSubmissions.length > 0;

    if (selectedTab === "attempt" && !newAttemptAvailable) {
      if (previousAvailable) {
        setSelectedTab("previous");
      } else if (previousKnownUnavailable && deletedAvailable) {
        setSelectedTab("deleted");
      }
      return;
    }
    if (selectedTab === "previous" && previousKnownUnavailable) {
      setSelectedTab(newAttemptAvailable ? "attempt" : deletedAvailable ? "deleted" : "attempt");
      return;
    }
    if (selectedTab === "deleted" && !deletedAvailable) {
      setSelectedTab(newAttemptAvailable ? "attempt" : previousAvailable ? "previous" : "attempt");
    }
  }, [canStartNewAttempt, deletedSubmissions.length, hasPreviousSubmissions, selectedTab]);

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

  const aiFeedbackReferences = getAiFeedbackReferences(releasedGrade?.feedback);

  return (
    <AppShell>
      <main className="page stack">
        <section className="hero-panel hero-panel-compact">
          <div className="hero-meta">
            <p className="eyebrow">{localizedActivityName()}</p>
            <h1>{activity?.title ?? safeExamBrowserAccess?.title ?? t("common.loading")}</h1>
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

        {isActivityUnavailable ? (
          <section className="section stack">
            <div>
              <p className="eyebrow">{t("groupPage.activityUnavailableEyebrow")}</p>
              <h2>{t("groupPage.activityUnavailableTitle")}</h2>
              <p className="muted">{t("groupPage.activityUnavailableText")}</p>
            </div>
          </section>
        ) : null}

        {releasedGrade?.gradeKind === "final" ? (
          <section className="section stack">
            <div>
              <p className="eyebrow">{t("groupPage.finalGradeLabel")}</p>
              <h2>{formatGradebookScore(releasedGrade.score, releasedGrade.maxScore)}</h2>
              {releasedGrade.latePenaltyApplied && releasedGrade.latePenaltyPercent !== null ? (
                <p className="muted">-{releasedGrade.latePenaltyPercent}%</p>
              ) : null}
              <StudentFeedback feedback={releasedGrade.feedback} maxScore={releasedGrade.maxScore} t={t} />
              {aiFeedbackReferences.length ? (
                <GradeChallengePanel
                  references={aiFeedbackReferences}
                  challenges={gradeChallenges}
                  explanation={challengeExplanation}
                  isSubmitting={isSubmittingChallenge}
                  selectedReferenceKey={selectedChallengeReferenceKey}
                  onExplanationChange={setChallengeExplanation}
                  onSelectedReferenceKeyChange={setSelectedChallengeReferenceKey}
                  onSubmit={submitGradeChallenge}
                  t={t}
                />
              ) : null}
            </div>
          </section>
        ) : null}

        {!isActivityUnavailable && (hasPreviousSubmissions === true || deletedSubmissions.length || canStartNewAttempt === false) ? (
          <div className="tab-strip" role="tablist" aria-label={activity?.title ?? t("common.loading")}>
            {canStartNewAttempt !== false ? (
              <button
                aria-selected={selectedTab === "attempt"}
                className="tab-button"
                role="tab"
                type="button"
                onClick={() => setSelectedTab("attempt")}
              >
                {t("courseDetail.newAttemptTab")}
              </button>
            ) : null}
            {hasPreviousSubmissions === true ? (
              <button
                aria-selected={selectedTab === "previous"}
                className="tab-button"
                role="tab"
                type="button"
                onClick={() => setSelectedTab("previous")}
              >
                {t("courseDetail.previousSubmissionsTitle")}
              </button>
            ) : null}
            {deletedSubmissions.length ? (
              <button
                aria-selected={selectedTab === "deleted"}
                className="tab-button"
                role="tab"
                type="button"
                onClick={() => setSelectedTab("deleted")}
              >
                {t("courseDetail.deletedSubmissionsTitle")}
              </button>
            ) : null}
          </div>
        ) : null}

        {!isActivityUnavailable && (
          (selectedTab === "attempt" && (
            canStartNewAttempt !== false || activity?.activityType.key === "test"
          )) || selectedTab === "previous"
        ) ? (
          activity && ActivityRenderer ? (
            <ActivityRenderer
              activity={activity}
              activityRouteCourseId={courseId}
              canManage={Boolean(canManage)}
              course={course ? { id: course.id, title: course.title } : null}
              groupId={groupId}
              hasQuestionAuthoringAgent={hasQuestionAuthoringAgent}
              onSubmitted={() => router.push(`/courses/${courseId}/groups/${groupId}`)}
              onSave={saveActivity}
              showReleasedAnswers={releasedGrade?.gradeKind === "final"}
              releasedMaxScore={releasedGrade?.maxScore ?? undefined}
              studentViewMode={selectedTab === "previous" ? "previous" : "attempt"}
              onNewAttemptAvailabilityChange={setCanStartNewAttempt}
              onPreviousSubmissionsAvailabilityChange={setHasPreviousSubmissions}
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
          )
        ) : null}

        {!isActivityUnavailable && deletedSubmissions.length && selectedTab === "deleted" ? (
          <section className="section stack">
            <div>
              <p className="eyebrow">{t("courseDetail.deletedSubmissionsTitle")}</p>
              <h2>{t("courseDetail.deletedSubmissionsTitle")}</h2>
            </div>
            <DeletedSubmissionList deletedSubmissions={deletedSubmissions} t={t} />
          </section>
        ) : null}

        {isSafeExamBrowserGateOpen ? (
          <div className="dialog-backdrop" role="presentation">
            <section aria-labelledby="safe-exam-browser-dialog-title" aria-modal="true" className="dialog-panel stack" role="dialog">
              <div>
                <p className="eyebrow">{t("groupPage.safeExamBrowserEyebrow")}</p>
                <h2 id="safe-exam-browser-dialog-title">{t("groupPage.safeExamBrowserTitle")}</h2>
              </div>
              <p>{t("groupPage.safeExamBrowserMessage")}</p>
              <p className="muted">{t("groupPage.safeExamBrowserFallback")}</p>
              {safeExamBrowserError ? <p className="error" role="alert">{safeExamBrowserError}</p> : null}
              <div className="row">
                <a
                  className="button secondary"
                  href={safeExamBrowserAccess?.downloadSafeExamBrowserUrl ?? "https://safeexambrowser.org/download_en.html"}
                  rel="noreferrer"
                  target="_blank"
                >
                  {t("groupPage.safeExamBrowserDownloadApplication")}
                </a>
                {safeExamBrowserLaunch ? (
                  <a className="button secondary" href={safeExamBrowserLaunch.downloadUrl}>
                    {t("groupPage.safeExamBrowserDownloadConfiguration")}
                  </a>
                ) : null}
              </div>
              <div className="dialog-actions">
                <button className="secondary" type="button" onClick={() => router.push(`/courses/${courseId}/groups/${groupId}`)}>
                  {t("common.cancel")}
                </button>
                <button
                  disabled={!safeExamBrowserLaunch || isPreparingSafeExamBrowser}
                  type="button"
                  onClick={() => {
                    if (safeExamBrowserLaunch) window.location.href = safeExamBrowserLaunch.launchUrl;
                  }}
                >
                  {isPreparingSafeExamBrowser ? t("groupPage.safeExamBrowserOpening") : t("groupPage.safeExamBrowserOpen")}
                </button>
              </div>
            </section>
          </div>
        ) : null}
      </main>
    </AppShell>
  );
}

function DeletedSubmissionList({
  deletedSubmissions,
  t
}: {
  deletedSubmissions: DeletedSubmissionAudit[];
  t: (key: string, params?: Record<string, string | number>) => string;
}) {
  return (
    <div className="stack stack-tight">
      {deletedSubmissions.map((deletion) => (
        <div className="inline-panel stack stack-tight" key={deletion.eventId}>
          <strong>
            {t("courseDetail.deletedSubmissionSummary", {
              number: deletion.attemptNumber ?? "-",
              date: formatDateTime(deletion.deletedAt)
            })}
          </strong>
          {deletion.actor ? <p className="muted">{t("courseDetail.deletedSubmissionActor", { name: deletion.actor.name ?? deletion.actor.email })}</p> : null}
          {deletion.reason ? <p className="muted">{t("courseDetail.deletedSubmissionReason", { reason: deletion.reason })}</p> : null}
          <p className="muted">
            {t("courseDetail.deletedSubmissionWhat")}: {formatDeletedSubmissionRecord(deletion)}
          </p>
          <DeletedSubmissionSolution deletion={deletion} t={t} />
        </div>
      ))}
    </div>
  );
}

function DeletedSubmissionSolution({
  deletion,
  t
}: {
  deletion: DeletedSubmissionAudit;
  t: (key: string, params?: Record<string, string | number>) => string;
}) {
  const code = formatDeletedParsonsCode(deletion);

  return (
    <div className="stack stack-tight">
      <strong>{t("courseDetail.deletedSubmissionSolution")}</strong>
      {code ? <pre className="code-block">{code}</pre> : <p className="muted">{t("courseDetail.deletedSubmissionSolutionUnavailable")}</p>}
    </div>
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
  const parsonsDetails = getParsonsFeedbackDetails(feedback);
  const assessmentDetails = feedback.kind === "ai_assessment_feedback" || feedback.kind === "assessment_feedback"
    ? feedback.details ?? {}
    : null;
  const assessmentSummary = typeof assessmentDetails?.summary === "string" ? assessmentDetails.summary.trim() : "";
  const assessmentStrengths = readStringArray(assessmentDetails?.strengths);
  const assessmentImprovements = readStringArray(assessmentDetails?.improvements);
  const assessmentCriteria = readAiCriteria(assessmentDetails?.criteria);
  const assessmentQuestionFeedback = readAiQuestionFeedback(assessmentDetails?.questionFeedback);
  const hasAssessmentFeedback = Boolean(
    assessmentSummary
    || assessmentStrengths.length
    || assessmentImprovements.length
    || assessmentCriteria.length
    || assessmentQuestionFeedback.length
  );

  return (
    <div className="stack stack-tight">
      {feedback.feedbackText?.trim() ? (
        <div className="stack stack-tight">
          <strong>{t("groupPage.feedbackTitle")}</strong>
          <p className="muted">{feedback.feedbackText}</p>
        </div>
      ) : null}
      {assessmentDetails && hasAssessmentFeedback ? (
        <div className="stack stack-tight">
          <strong>{t("groupPage.aiFeedbackTitle")}</strong>
          {assessmentSummary ? <p style={{ whiteSpace: "pre-wrap" }}>{assessmentSummary}</p> : null}
          {assessmentStrengths.length ? (
            <div>
              <strong>{t("groupPage.aiFeedbackStrengths")}</strong>
              {assessmentStrengths.map((item, index) => <p className="muted" key={index} style={{ whiteSpace: "pre-wrap" }}>{item}</p>)}
            </div>
          ) : null}
          {assessmentImprovements.length ? (
            <div>
              <strong>{t("groupPage.aiFeedbackImprovements")}</strong>
              {assessmentImprovements.map((item, index) => <p className="muted" key={index} style={{ whiteSpace: "pre-wrap" }}>{item}</p>)}
            </div>
          ) : null}
          {assessmentCriteria.map((criterion) => (
            <div className="inline-panel" key={criterion.id}>
              <strong>{criterion.title} · {criterion.scorePercent}%</strong>
              {criterion.feedback.trim() ? <p className="muted">{criterion.feedback}</p> : null}
            </div>
          ))}
          {assessmentQuestionFeedback.map((entry) => (
            <p className="muted" key={entry.questionId}>{entry.explanation}</p>
          ))}
        </div>
      ) : null}
      {parsonsDetails.messages.length ? (
        <div className="stack stack-tight">
          <strong>{t("groupPage.feedbackTitle")}</strong>
          {parsonsDetails.messages.map((message) => (
            <p className="muted" key={message.type}>
              {message.type === "order"
                ? t("parsons.orderFeedback", { count: message.count })
                : t("parsons.indentFeedback", { count: message.count })}
            </p>
          ))}
        </div>
      ) : null}
      {parsonsDetails.grading.length ? (
        <div className="stack stack-tight">
          <strong>{t("groupPage.gradingBreakdownTitle")}</strong>
          {scaleFeedbackGrading(parsonsDetails.grading, maxScore).map((component) => (
            <p className="muted" key={component.type}>
              {t(component.type === "order" ? "groupPage.parsonsOrderScore" : "groupPage.parsonsIndentationScore", {
                score: formatGradeNumber(component.awarded),
                max: formatGradeNumber(component.possible)
              })}
            </p>
          ))}
        </div>
      ) : null}
      <TestGradeBreakdown feedback={feedback} heading={t("groupPage.gradingBreakdownTitle")} />
    </div>
  );
}

function GradeChallengePanel({
  references,
  challenges,
  explanation,
  isSubmitting,
  selectedReferenceKey,
  onExplanationChange,
  onSelectedReferenceKeyChange,
  onSubmit,
  t
}: {
  references: AiFeedbackReference[];
  challenges: GradeChallenge[];
  explanation: string;
  isSubmitting: boolean;
  selectedReferenceKey: string;
  onExplanationChange: (value: string) => void;
  onSelectedReferenceKeyChange: (value: string) => void;
  onSubmit: () => Promise<void>;
  t: (key: string, params?: Record<string, string | number>) => string;
}) {
  const availableReferences = references.filter((reference) => !challenges.some(
    (challenge) => challenge.feedbackRef === reference.feedbackRef && challenge.feedbackVersion === reference.feedbackVersion
  ));
  const effectiveSelectedKey = availableReferences.some((reference) => feedbackReferenceKey(reference) === selectedReferenceKey)
    ? selectedReferenceKey
    : feedbackReferenceKey(availableReferences[0]);
  return (
    <section className="inline-panel stack stack-tight">
      {challenges.map((challenge) => {
        const reference = references.find((candidate) => candidate.feedbackRef === challenge.feedbackRef && candidate.feedbackVersion === challenge.feedbackVersion);
        return (
          <div className="stack stack-tight" key={challenge.id}>
            <strong>{reference?.label ?? t("groupPage.challengeTitle")}</strong>
            <p>{challenge.explanation}</p>
            <p className="muted">{t(`groupPage.challengeStatus.${challenge.status}`)}</p>
            {challenge.teacherResponse ? (
              <div>
                <strong>{t("groupPage.challengeTeacherResponse")}</strong>
                <p>{challenge.teacherResponse}</p>
              </div>
            ) : null}
          </div>
        );
      })}
      {availableReferences.length ? (
        <div className="stack stack-tight">
          <strong>{t("groupPage.challengeGrade")}</strong>
          <p className="muted">{t("groupPage.challengeHelp")}</p>
          {availableReferences.length > 1 ? (
            <label className="field">
              <span>{t("groupPage.challengeFeedbackLabel")}</span>
              <select value={effectiveSelectedKey} onChange={(event) => onSelectedReferenceKeyChange(event.target.value)}>
                {availableReferences.map((reference) => (
                  <option key={feedbackReferenceKey(reference)} value={feedbackReferenceKey(reference)}>
                    {reference.label ?? t("groupPage.aiFeedbackTitle")}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <textarea
            maxLength={8000}
            rows={4}
            value={explanation}
            onChange={(event) => onExplanationChange(event.target.value)}
          />
          <button disabled={isSubmitting || explanation.trim().length < 20} type="button" onClick={() => void onSubmit()}>
            {isSubmitting ? t("common.saving") : t("groupPage.submitChallenge")}
          </button>
        </div>
      ) : null}
    </section>
  );
}

type AiFeedbackReference = { feedbackRef: string; feedbackVersion: number; label: string | null };

function getAiFeedbackReferences(feedback: StudentGradeFeedback | null | undefined): AiFeedbackReference[] {
  if (!feedback?.details) return [];
  if (feedback.kind === "test" && Array.isArray(feedback.details.items)) {
    return feedback.details.items.flatMap((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return [];
      const itemRecord = item as Record<string, unknown>;
      const itemFeedback = itemRecord.feedback;
      if (!itemFeedback || typeof itemFeedback !== "object" || Array.isArray(itemFeedback)) return [];
      const aiFeedback = (itemFeedback as Record<string, unknown>).aiFeedback;
      if (!aiFeedback || typeof aiFeedback !== "object" || Array.isArray(aiFeedback)) return [];
      const nested = aiFeedback as Record<string, unknown>;
      if (typeof nested.feedbackRef === "string" && typeof nested.feedbackVersion === "number" && nested.challengeAllowed === true) {
        return [{
          feedbackRef: nested.feedbackRef,
          feedbackVersion: nested.feedbackVersion,
          label: typeof itemRecord.title === "string" ? itemRecord.title : null
        }];
      }
      return [];
    });
  }
  if (feedback.kind !== "ai_assessment_feedback") return [];
  const feedbackRef = feedback.details.feedbackRef;
  const feedbackVersion = feedback.details.feedbackVersion;
  const challengeAllowed = feedback.details.challengeAllowed;
  return typeof feedbackRef === "string" && typeof feedbackVersion === "number" && challengeAllowed === true
    ? [{ feedbackRef, feedbackVersion, label: null }]
    : [];
}

function feedbackReferenceKey(reference: AiFeedbackReference | undefined) {
  return reference ? `${reference.feedbackRef}:${reference.feedbackVersion}` : "";
}

function hasAiFeedback(feedback: StudentGradeFeedback | null | undefined) {
  if (!feedback?.details) return false;
  if (feedback.kind === "ai_assessment_feedback") {
    return typeof feedback.details.feedbackRef === "string" && typeof feedback.details.feedbackVersion === "number";
  }
  if (feedback.kind !== "test" || !Array.isArray(feedback.details.items)) return false;
  return feedback.details.items.some((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return false;
    const itemFeedback = (item as Record<string, unknown>).feedback;
    if (!itemFeedback || typeof itemFeedback !== "object" || Array.isArray(itemFeedback)) return false;
    const aiFeedback = (itemFeedback as Record<string, unknown>).aiFeedback;
    if (!aiFeedback || typeof aiFeedback !== "object" || Array.isArray(aiFeedback)) return false;
    return typeof (aiFeedback as Record<string, unknown>).feedbackRef === "string";
  });
}

function readStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.flatMap((item) => typeof item === "string" && item.trim() ? [item.trim()] : [])
    : [];
}

function readAiCriteria(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry, index) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return [];
    const criterion = entry as Record<string, unknown>;
    return typeof criterion.title === "string" && typeof criterion.feedback === "string" && typeof criterion.scorePercent === "number"
      ? [{ id: typeof criterion.id === "string" ? criterion.id : String(index), title: criterion.title, feedback: criterion.feedback, scorePercent: criterion.scorePercent }]
      : [];
  });
}

function readAiQuestionFeedback(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry, index) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return [];
    const feedback = entry as Record<string, unknown>;
    return typeof feedback.explanation === "string"
      ? [{ questionId: typeof feedback.questionId === "string" ? feedback.questionId : String(index), explanation: feedback.explanation }]
      : [];
  });
}

type ParsonsFeedbackMessage = { type: "order" | "indentation"; count: number };
type ParsonsFeedbackGrading = { type: "order" | "indentation"; awardedRaw: number; possibleRaw: number };

function getParsonsFeedbackDetails(feedback: StudentGradeFeedback) {
  const details = feedback.kind === "parsons" && feedback.details && typeof feedback.details === "object" ? feedback.details : {};
  const messages = Array.isArray(details.messages)
    ? details.messages
        .map((message) => {
          const item = message && typeof message === "object" ? (message as Record<string, unknown>) : null;
          const type = item?.type;
          const count = typeof item?.count === "number" ? item.count : null;
          return (type === "order" || type === "indentation") && count !== null ? { type, count } : null;
        })
        .filter((message): message is ParsonsFeedbackMessage => message !== null)
    : [];
  const grading = Array.isArray(details.grading)
    ? details.grading
        .map((component) => {
          const item = component && typeof component === "object" ? (component as Record<string, unknown>) : null;
          const type = item?.type;
          const awardedRaw = typeof item?.awardedRaw === "number" ? item.awardedRaw : null;
          const possibleRaw = typeof item?.possibleRaw === "number" ? item.possibleRaw : null;
          return (type === "order" || type === "indentation") && awardedRaw !== null && possibleRaw !== null
            ? { type, awardedRaw, possibleRaw }
            : null;
        })
        .filter((component): component is ParsonsFeedbackGrading => component !== null)
    : [];
  return { messages, grading };
}

function scaleFeedbackGrading(grading: ParsonsFeedbackGrading[], maxScore: number) {
  const rawTotal = grading.reduce((sum, component) => sum + component.possibleRaw, 0);
  const scale = rawTotal > 0 ? maxScore / rawTotal : 1;
  return grading.map((component) => ({
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

function formatDateTime(value: string) {
  return new Date(value).toLocaleString();
}

function formatDeletedSubmissionRecord(deletion: DeletedSubmissionAudit) {
  const parts = [
    deletion.submittedAt ? `submitted ${formatDateTime(deletion.submittedAt)}` : null,
    deletion.gradedAt ? `graded ${formatDateTime(deletion.gradedAt)}` : null,
    deletion.pluginKey,
    deletion.pluginAttemptRef ? `ref ${deletion.pluginAttemptRef}` : null
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : JSON.stringify(deletion.metadata);
}

type DeletedParsonsBlock = {
  id: string;
  displayText: string;
  currentIndent: number;
};

function formatDeletedParsonsCode(deletion: DeletedSubmissionAudit) {
  const blocks = getDeletedParsonsBlocks(deletion);
  if (!blocks.length) {
    return "";
  }
  return blocks.map((block) => `${"  ".repeat(Math.max(0, block.currentIndent))}${block.displayText}`).join("\n");
}

function getDeletedParsonsBlocks(deletion: DeletedSubmissionAudit): DeletedParsonsBlock[] {
  const submittedState = asRecord(deletion.metadata.submittedState);
  const blocks = Array.isArray(submittedState?.blocks) ? submittedState.blocks : [];
  return blocks
    .flatMap((block, index) => {
      const record = asRecord(block);
      if (!record || typeof record.displayText !== "string") {
        return [];
      }
      return [
        {
          id: typeof record.id === "string" ? record.id : `block-${index}`,
          displayText: record.displayText,
          currentIndent: typeof record.currentIndent === "number" ? record.currentIndent : 0
        }
      ];
    });
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}
