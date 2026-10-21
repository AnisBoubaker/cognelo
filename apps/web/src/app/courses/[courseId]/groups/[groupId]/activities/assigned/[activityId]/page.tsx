"use client";

import { useApplicationTime, formatZonedDateTime } from "@cognelo/activity-ui";


import { CodeRenderer } from "@cognelo/activity-ui";
import Link from "next/link";
import { useServerCountdown } from "@/lib/use-server-countdown";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { CodingExerciseStudentGradeReport } from "@cognelo/plugin-coding-exercises";
import { AppShell } from "@/components/app-shell";
import { ActivityLiveControlPortal } from "@/components/activity-live-controls";
import { ActivitySolutionPanel } from "@/components/activity-solution-panel";
import { ActivityMessenger } from "@/components/activity-messenger";
import { TestGradeBreakdown } from "@/components/test-grade-breakdown";
import { useAuth } from "@/components/auth-provider";
import { api, ApiError, Activity, ActivityDefinition, Course, CourseGroup, DeletedSubmissionAudit, GradeChallenge, SafeExamBrowserAccess, SafeExamBrowserLaunch, StudentGradeFeedback, StudentReleasedGradeRow, TimedActivityRuntime } from "@/lib/api";
import { getGradeChallengeReferences, type GradeChallengeReference } from "@/lib/grade-challenges";
import { useI18n } from "@/lib/i18n";
import { activityRenderers, studentSubmissionHistoryTypes } from "@/lib/activity-renderers";
import { deletedSubmissionCode, deletedSubmissionFiles } from "@/lib/deleted-submission-code";
import { readSafeExamBrowserProof } from "@/lib/safe-exam-browser";
import { formatRemainingTime, getTestCountdownTone } from "@/lib/test-countdown";

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
  const [unlockedAttemptRevision, setUnlockedAttemptRevision] = useState(0);
  const canStartNewAttemptRef = useRef<boolean | null>(null);
  const continuationVersionRef = useRef<string | null>(null);
  const [hasPreviousSubmissions, setHasPreviousSubmissions] = useState<boolean | null>(null);
  const [solutionAvailable, setSolutionAvailable] = useState(false);
  const [showSolution, setShowSolution] = useState(false);
  const [selectedTab, setSelectedTab] = useState<"attempt" | "previous" | "deleted">("attempt");
  const [isActivityUnavailable, setIsActivityUnavailable] = useState(false);
  const [hasQuestionAuthoringAgent, setHasQuestionAuthoringAgent] = useState(false);
  const [safeExamBrowserAccess, setSafeExamBrowserAccess] = useState<SafeExamBrowserAccess | null>(null);
  const [safeExamBrowserLaunch, setSafeExamBrowserLaunch] = useState<SafeExamBrowserLaunch | null>(null);
  const [isSafeExamBrowserGateOpen, setIsSafeExamBrowserGateOpen] = useState(false);
  const [isPreparingSafeExamBrowser, setIsPreparingSafeExamBrowser] = useState(false);
  const [safeExamBrowserError, setSafeExamBrowserError] = useState("");
  const [error, setError] = useState("");
  const [timedRuntime, setTimedRuntime] = useState<TimedActivityRuntime | null>(null);
  const [timingStatus, setTimingStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const timedRemainingSeconds = useServerCountdown(timedRuntime?.timing);
  const [timedAutoSubmitRequestId, setTimedAutoSubmitRequestId] = useState(0);
  const [startingTimedAttempt, setStartingTimedAttempt] = useState(false);
  const safeExamBrowserLaunchRequestRef = useRef(false);
  const safeExamBrowserLaunchDismissedRef = useRef(false);
  const aiFeedbackViewRecordedRef = useRef("");
  const autoSubmittedTimedAttemptRef = useRef<string | null>(null);
  const safeExamBrowserLaunchToken = searchParams.get("sebLaunch");

  const membershipRole = course?.memberships?.find((membership) => membership.userId === user?.id)?.role;
  const canManage =
    user?.roles.includes("admin") ||
    membershipRole === "owner" ||
    membershipRole === "teacher" ||
    membershipRole === "ta";
  const isLearner = !canManage && Boolean(
    group?.participants?.some((participant) => participant.userId === user?.id && participant.role === "student")
  );
  const hasStandaloneActivity = Boolean(activity?.id && activity.activityType.key !== "test");
  const ActivityRenderer =
    activity && activityDefinitions.some((definition) => definition.key === activity.activityType.key)
      ? activityRenderers[activity.activityType.key as keyof typeof activityRenderers]
      : null;

  useEffect(() => {
    canStartNewAttemptRef.current = canStartNewAttempt;
  }, [canStartNewAttempt]);

  useEffect(() => {
    setCanStartNewAttempt(null);
    setHasPreviousSubmissions(null);
    setIsActivityUnavailable(false);
    setSelectedTab("attempt");
    setSolutionAvailable(false);
    setShowSolution(false);
    setSafeExamBrowserLaunch(null);
    setIsSafeExamBrowserGateOpen(false);
    setIsPreparingSafeExamBrowser(false);
    safeExamBrowserLaunchRequestRef.current = false;
    safeExamBrowserLaunchDismissedRef.current = false;
    aiFeedbackViewRecordedRef.current = "";
    setSafeExamBrowserError("");
    setSelectedChallengeReferenceKey("");
    setChallengeExplanation("");
    setTimedRuntime(null);
    setTimingStatus("idle");
    setTimedAutoSubmitRequestId(0);
    autoSubmittedTimedAttemptRef.current = null;
  }, [activityId, courseId, groupId]);

  useEffect(() => {
    if (!hasStandaloneActivity || !isLearner) {
      setTimedRuntime(null);
        setTimingStatus("idle");
      return;
    }
    let cancelled = false;
    setTimingStatus("loading");
    api.timedActivityRuntime(courseId, groupId, activityId)
      .then(({ runtime }) => {
        if (cancelled) return;
        continuationVersionRef.current = runtime.attempt?.reopenedAt ?? null;
        setTimedRuntime(runtime);
        setTimingStatus("ready");
      })
      .catch((loadError) => {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : t("groupPage.timedActivityLoadError"));
          setTimingStatus("error");
        }
      });
    return () => { cancelled = true; };
  }, [hasStandaloneActivity, activityId, courseId, groupId, isLearner, t]);

  useEffect(() => {
    if (!solutionAvailable || isActivityUnavailable || isSafeExamBrowserGateOpen) setShowSolution(false);
  }, [solutionAvailable, isActivityUnavailable, isSafeExamBrowserGateOpen]);

  // Refresh content and policy in place; plugin editors preserve their active response.
  useEffect(() => {
    if (!isLearner) return;
    let cancelled = false;
    let refreshing = false;
    async function refreshPolicy() {
      if (refreshing) return;
      refreshing = true;
      try {
        const { access } = await api.groupActivitySafeExamBrowserAccess(courseId, groupId, activityId);
        if (cancelled) return;
        setSafeExamBrowserAccess(access);
        if (access.requiresSafeExamBrowser && !access.accessGranted) {
          setIsSafeExamBrowserGateOpen(true);
          return;
        }
        setIsSafeExamBrowserGateOpen(false);
        const [{ activity: latest }, solutionStatus, gradesResult] = await Promise.all([
          api.groupActivity(courseId, groupId, activityId),
          api.activitySolutionAvailability(courseId, groupId, activityId),
          api.studentGroupGrades(courseId, groupId)
        ]);
        if (cancelled) return;
        setIsActivityUnavailable(false);
        setSolutionAvailable(solutionStatus.available);
        setReleasedGrade(gradesResult.grades.rows.find((row) => row.activityId === activityId && row.gradeKind === "final") ?? null);
        setActivity((current) => JSON.stringify(current) === JSON.stringify(latest) ? current : latest);
        if (latest.activityType.key !== "test") {
          const { runtime } = await api.timedActivityRuntime(courseId, groupId, activityId);
          if (cancelled) return;
          setTimedRuntime(runtime);
          setTimingStatus("ready");
          const canStart = Boolean(runtime.attempt) || runtime.availability.canStart;
          // Exhausted plugin renderers cache their read-only status. Refresh them
          // only when another attempt is unlocked, never while an editor is active.
          const reopenedAt = runtime.attempt?.reopenedAt ?? null;
          if ((canStartNewAttemptRef.current === false && canStart) || (reopenedAt && reopenedAt !== continuationVersionRef.current)) {
            setUnlockedAttemptRevision((current) => current + 1);
            if (reopenedAt) setSelectedTab("attempt");
          }
          continuationVersionRef.current = reopenedAt;
          setCanStartNewAttempt(canStart);
          if (!runtime.timing.isExpired) autoSubmittedTimedAttemptRef.current = null;
        }
      } catch (reason) {
        if (!cancelled && reason instanceof ApiError && ["GROUP_ACTIVITY_NOT_AVAILABLE", "GROUP_ACTIVITY_HIDDEN"].includes(reason.code ?? "")) {
          setIsActivityUnavailable(true);
          setError("");
        }
      } finally {
        refreshing = false;
      }
    }
    const interval = window.setInterval(() => void refreshPolicy(), 20_000);
    window.addEventListener("focus", refreshPolicy);
    return () => { cancelled = true; window.clearInterval(interval); window.removeEventListener("focus", refreshPolicy); };
  }, [activityId, courseId, groupId, isLearner]);

  useEffect(() => {
    const attemptId = timedRuntime?.attempt?.id;
    if (!attemptId || timedRemainingSeconds !== 0 || autoSubmittedTimedAttemptRef.current === attemptId) return;
    autoSubmittedTimedAttemptRef.current = attemptId;
    // A teacher may have extended time since the last touchbase.
    void api.timedActivityRuntime(courseId, groupId, activityId).then(({ runtime }) => {
      setTimedRuntime(runtime);
      if (runtime.attempt?.id === attemptId && runtime.timing.isExpired) {
        setTimedAutoSubmitRequestId((current) => current + 1);
      } else {
        autoSubmittedTimedAttemptRef.current = null;
      }
    }).catch(() => { autoSubmittedTimedAttemptRef.current = null; });
  }, [timedRemainingSeconds, timedRuntime?.attempt?.id, activityId, courseId, groupId]);

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
          if (safeExamBrowserLaunchDismissedRef.current) {
            setIsSafeExamBrowserGateOpen(false);
            return;
          }
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
        if (!userCanManage && err instanceof ApiError && ["GROUP_ACTIVITY_NOT_AVAILABLE", "GROUP_ACTIVITY_HIDDEN"].includes(err.code ?? "")) {
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
        const [gradesResult, submissionsResult, solutionStatus] = await Promise.all([
          api.studentGroupGrades(courseId, groupId),
          api.studentActivitySubmissions(courseId, groupId, activityId),
          api.activitySolutionAvailability(courseId, groupId, activityId)
        ]);
        const gradeRow = gradesResult.grades.rows.find((row) => row.activityId === activityId && row.score !== null) ?? null;
        setReleasedGrade(gradeRow);
        setSolutionAvailable(solutionStatus.available);
        setDeletedSubmissions(submissionsResult.audit.deletedSubmissions);
        if (studentSubmissionHistoryTypes.has(activityResult.activity.activityType.key)) {
          // History must be discoverable before the start gate mounts an editor.
          setHasPreviousSubmissions(submissionsResult.audit.submittedAttemptCount > 0);
        }
      }
    }

    refresh().catch((err) => setError(err instanceof Error ? err.message : t("activityPage.loadError")));
  }, [activityId, courseId, groupId, safeExamBrowserLaunchToken, t, user]);

  useEffect(() => {
    const challengeAttemptId = releasedGrade?.challengeAttemptId ?? releasedGrade?.selectedAttemptId;
    if (!challengeAttemptId) {
      setGradeChallenges([]);
      return;
    }
    api.attemptGradeChallenges(courseId, challengeAttemptId)
      .then((result) => setGradeChallenges(result.challenges))
      .catch(() => setGradeChallenges([]));
  }, [courseId, releasedGrade?.challengeAttemptId, releasedGrade?.selectedAttemptId]);

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
    const references = getGradeChallengeReferences(
      releasedGrade?.feedback,
      releasedGrade?.gradeChallengeTarget,
      t("groupPage.finalGradeLabel")
    );
    const availableReferences = references.filter((reference) => !gradeChallenges.some(
      (challenge) => challenge.feedbackRef === reference.feedbackRef && challenge.feedbackVersion === reference.feedbackVersion
    ));
    const feedbackReference = availableReferences.find((reference) => feedbackReferenceKey(reference) === selectedChallengeReferenceKey)
      ?? availableReferences[0];
    const challengeAttemptId = releasedGrade?.challengeAttemptId ?? releasedGrade?.selectedAttemptId;
    if (!challengeAttemptId || !feedbackReference || challengeExplanation.trim().length < 20) return;
    setIsSubmittingChallenge(true);
    try {
      const result = await api.createGradeChallenge(courseId, challengeAttemptId, {
        feedbackRef: feedbackReference.feedbackRef,
        feedbackVersion: feedbackReference.feedbackVersion,
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

  function openActivityInSafeExamBrowser() {
    if (!safeExamBrowserLaunch) return;
    safeExamBrowserLaunchDismissedRef.current = true;
    flushSync(() => setIsSafeExamBrowserGateOpen(false));
    window.location.href = safeExamBrowserLaunch.launchUrl;
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

  async function startTimedAttempt() {
    setStartingTimedAttempt(true);
    setError("");
    try {
      const { runtime } = await api.startTimedActivityAttempt(courseId, groupId, activityId);
      setTimedRuntime(runtime);
    } catch (startError) {
      setError(startError instanceof Error ? startError.message : t("groupPage.timedActivityStartError"));
    } finally {
      setStartingTimedAttempt(false);
    }
  }

  async function settleTimedAutoSubmit(submitted: boolean) {
    if (submitted) {
      router.push(`/courses/${courseId}/groups/${groupId}`);
      return;
    }
    try {
      await api.finalizeTimedActivityAttempt(courseId, groupId, activityId);
      router.push(`/courses/${courseId}/groups/${groupId}`);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : t("groupPage.timedActivitySubmitError"));
    }
  }

  function localizedActivityName() {
    if (!activity) {
      return t("common.loading");
    }

    const definition = activityDefinitions.find((candidate) => candidate.key === activity.activityType.key);
    const localized = definition?.i18n?.[locale];
    return localized?.name ?? definition?.name ?? activity.activityType.name;
  }

  const gradeChallengeReferences = getGradeChallengeReferences(
    releasedGrade?.feedback,
    releasedGrade?.gradeChallengeTarget,
    t("groupPage.finalGradeLabel")
  );

  return (
    <AppShell>
      <main className="page stack assigned-activity-page">
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
              {releasedGrade.activityTypeKey === "coding-exercise" && releasedGrade.gradingReport && releasedGrade.score !== null ? (
                <CodingExerciseStudentGradeReport
                  feedback={releasedGrade.feedback}
                  locale={locale}
                  maxScore={releasedGrade.maxScore}
                  report={releasedGrade.gradingReport}
                  score={releasedGrade.score}
                />
              ) : (
                <StudentFeedback feedback={releasedGrade.feedback} maxScore={releasedGrade.maxScore} t={t} />
              )}
              {gradeChallengeReferences.length && (releasedGrade.gradeChallengesEnabled || gradeChallenges.length) ? (
                <GradeChallengePanel
                  references={gradeChallengeReferences}
                  challenges={gradeChallenges}
                  allowNewChallenge={releasedGrade.gradeChallengesEnabled}
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

        <div className="workspace-tab-toolbar activity-navigation">
          {!isActivityUnavailable && (solutionAvailable || hasPreviousSubmissions === true || deletedSubmissions.length || canStartNewAttempt === false) ? (
            <div className="tab-strip" role="tablist" aria-label={activity?.title ?? t("common.loading")}>
              {canStartNewAttempt !== false ? (
                <button
                  aria-selected={!showSolution && selectedTab === "attempt"}
                  className="tab-button"
                  role="tab"
                  type="button"
                  onClick={() => { setShowSolution(false); setSelectedTab("attempt"); }}
                >
                  {t("courseDetail.newAttemptTab")}
                </button>
              ) : null}
              {hasPreviousSubmissions === true ? (
                <button
                  aria-selected={!showSolution && selectedTab === "previous"}
                  className="tab-button"
                  role="tab"
                  type="button"
                  onClick={() => { setShowSolution(false); setSelectedTab("previous"); }}
                >
                  {t("courseDetail.previousSubmissionsTitle")}
                </button>
              ) : null}
              {solutionAvailable ? (
                <button aria-selected={showSolution} className="tab-button" role="tab" type="button" onClick={() => setShowSolution(true)}>
                  {t("activitySolution.tab")}
                </button>
              ) : null}
              {deletedSubmissions.length ? (
                <button
                  aria-selected={!showSolution && selectedTab === "deleted"}
                  className="tab-button"
                  role="tab"
                  type="button"
                  onClick={() => { setShowSolution(false); setSelectedTab("deleted"); }}
                >
                  {t("courseDetail.deletedSubmissionsTitle")}
                </button>
              ) : null}
            </div>
          ) : null}
          <div className="workspace-context">
            <h1>{activity?.title ?? safeExamBrowserAccess?.title ?? t("common.loading")}</h1>
            <p className="muted">
              {localizedActivityName()} · {group ? group.title : t("common.loading")}
              {course ? ` · ${course.title}` : ""}
            </p>
          </div>
          <div className="section-actions">
            <Link className="button secondary" href={`/courses/${courseId}/groups/${groupId}`}>
              {t("groupPage.backToCourse")}
            </Link>
          </div>
                </div>

        {!isActivityUnavailable && !isSafeExamBrowserGateOpen && solutionAvailable && showSolution ? (
          <ActivitySolutionPanel courseId={courseId} groupId={groupId} activityId={activityId} />
        ) : null}

        {!isActivityUnavailable && isLearner && activity?.activityType.key !== "test" && timingStatus !== "ready" ? (
          <section className="section stack">
            <p>{timingStatus === "error" ? t("groupPage.timedActivityLoadError") : t("common.loading")}</p>
          </section>
        ) : null}

        {!showSolution && !isActivityUnavailable && timingStatus === "ready" && timedRuntime?.timeLimitMinutes && !timedRuntime.attempt && selectedTab === "attempt" ? (
          <section className="section stack">
            <div>
              <p className="eyebrow">{t("groupPage.timedActivityEyebrow")}</p>
              <h2>{t("groupPage.timedActivityTitle")}</h2>
              <p className="muted">{t("groupPage.timedActivityStartMessage", { count: timedRuntime.timeLimitMinutes })}</p>
            </div>
            <button
              className="button"
              disabled={startingTimedAttempt || !timedRuntime.availability.canStart}
              type="button"
              onClick={() => void startTimedAttempt()}
            >
              {startingTimedAttempt ? t("groupPage.timedActivityStarting") : t("groupPage.timedActivityStart")}
            </button>
            {!timedRuntime.availability.canStart ? <p className="muted">{timedRuntime.availability.reason}</p> : null}
          </section>
        ) : null}

        {timedRuntime?.attempt && timedRemainingSeconds !== null ? (
          <ActivityLiveControlPortal>
            <div
              aria-label={t("courseDetail.testTimeRemaining", { time: formatRemainingTime(timedRemainingSeconds) })}
              aria-live="off"
              className={`test-countdown test-countdown--${getTestCountdownTone(timedRemainingSeconds, timedRuntime.timeLimitMinutes)}`}
              role="timer"
            >
              {t("courseDetail.testTimeRemaining", { time: formatRemainingTime(timedRemainingSeconds) })}
            </div>
          </ActivityLiveControlPortal>
        ) : null}

        <ActivityMessenger
          activityId={activityId}
          courseId={courseId}
          enabled={Boolean(
            isLearner && selectedTab === "attempt"
          )}
          groupId={groupId}
        />

        <div hidden={showSolution || isActivityUnavailable || Boolean(safeExamBrowserAccess?.requiresSafeExamBrowser && !safeExamBrowserAccess.accessGranted)}>
        {(!isLearner || activity?.activityType.key === "test" || timingStatus === "ready") && (!timedRuntime?.timeLimitMinutes || timedRuntime.attempt || selectedTab === "previous") && (
          (selectedTab === "attempt" && (
            canStartNewAttempt !== false || activity?.activityType.key === "test"
          )) || selectedTab === "previous"
        ) ? (
          activity && ActivityRenderer ? (
            <ActivityRenderer
              key={`${activity.id}:${unlockedAttemptRevision}`}
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
              timedAutoSubmit={timedRuntime?.attempt && timedAutoSubmitRequestId ? {
                requestId: timedAutoSubmitRequestId,
                onSettled: (submitted) => void settleTimedAutoSubmit(submitted)
              } : undefined}
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

        {!showSolution && !isActivityUnavailable && deletedSubmissions.length && selectedTab === "deleted" ? (
          <section className="section stack">
            <div>
              <p className="eyebrow">{t("courseDetail.deletedSubmissionsTitle")}</p>
              <h2>{t("courseDetail.deletedSubmissionsTitle")}</h2>
            </div>
            <DeletedSubmissionList deletedSubmissions={deletedSubmissions} t={t} />
          </section>
        ) : null}

        </div>

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
                  onClick={openActivityInSafeExamBrowser}
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
  const { timeZone } = useApplicationTime();
  return (
    <div className="stack stack-tight">
      {deletedSubmissions.map((deletion) => (
        <div className="inline-panel stack stack-tight" key={deletion.eventId}>
          <strong>
            {t("courseDetail.deletedSubmissionSummary", {
              number: deletion.attemptNumber ?? "-",
              date: formatDateTime(deletion.deletedAt, timeZone)
            })}
          </strong>
          {deletion.actor ? <p className="muted">{t("courseDetail.deletedSubmissionActor", { name: deletion.actor.name ?? deletion.actor.email })}</p> : null}
          {deletion.reason ? <p className="muted">{t("courseDetail.deletedSubmissionReason", { reason: deletion.reason })}</p> : null}
          <p className="muted">
            {t("courseDetail.deletedSubmissionWhat")}: {formatDeletedSubmissionRecord(deletion, timeZone)}
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
  const code = deletedSubmissionCode(deletion.metadata);
  const files = deletedSubmissionFiles(deletion.metadata);
  if (code === null && !files.length && !["coding-exercises", "parsons", "web-design-coding-exercises"].includes(deletion.pluginKey ?? "")) return null;

  return (
    <div className="stack stack-tight">
      <strong>{t("courseDetail.deletedSubmissionSolution")}</strong>
      {files.length ? files.map((file, index) => <div className="stack stack-tight" key={`${file.path}-${index}`}>
        <strong>{file.path}</strong>
        <CodeRenderer code={file.code} language={file.language} />
      </div>) : code === null ? <p className="muted">{t("courseDetail.deletedSubmissionSolutionUnavailable")}</p>
        : code.length === 0 ? <p className="muted">{t("courseDetail.deletedSubmissionCodeEmpty")}</p>
        : <CodeRenderer code={code} />}
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
  allowNewChallenge,
  explanation,
  isSubmitting,
  selectedReferenceKey,
  onExplanationChange,
  onSelectedReferenceKeyChange,
  onSubmit,
  t
}: {
  references: GradeChallengeReference[];
  challenges: GradeChallenge[];
  allowNewChallenge: boolean;
  explanation: string;
  isSubmitting: boolean;
  selectedReferenceKey: string;
  onExplanationChange: (value: string) => void;
  onSelectedReferenceKeyChange: (value: string) => void;
  onSubmit: () => Promise<void>;
  t: (key: string, params?: Record<string, string | number>) => string;
}) {
  const availableReferences = allowNewChallenge
    ? references.filter((reference) => !challenges.some(
        (challenge) => challenge.feedbackRef === reference.feedbackRef && challenge.feedbackVersion === reference.feedbackVersion
      ))
    : [];
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

function feedbackReferenceKey(reference: GradeChallengeReference | undefined) {
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

function formatDateTime(value: string, timeZone: string = "UTC") {
  return formatZonedDateTime(new Date(value), timeZone, undefined, { dateStyle: "medium", timeStyle: "medium" });
}

function formatDeletedSubmissionRecord(deletion: DeletedSubmissionAudit, timeZone: string = "UTC") {
  const parts = [
    deletion.submittedAt ? `submitted ${formatDateTime(deletion.submittedAt, timeZone)}` : null,
    deletion.gradedAt ? `graded ${formatDateTime(deletion.gradedAt, timeZone)}` : null,
    deletion.pluginKey,
    deletion.pluginAttemptRef ? `ref ${deletion.pluginAttemptRef}` : null
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : JSON.stringify(deletion.metadata);
}
