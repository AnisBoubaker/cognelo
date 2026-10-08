"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ProgressDialog, useDialogs, useNotifications } from "@cognelo/activity-ui";
import { createMcqClient } from "@cognelo/plugin-mcq";
import { createParsonsClient } from "@cognelo/plugin-parsons";
import { AppShell } from "@/components/app-shell";
import { TestReviewAllPanel } from "@/components/test-review-all-panel";
import { ActivityReviewAllPanel, toActivityReviewResponse, type ActivityReviewResponse } from "@/components/activity-review-all-panel";
import { codingRubricResultsFromFeedback, type CodingRubricCriterion } from "@/lib/activity-review-all";
import { ReviewAndGradeDialog } from "@/components/review-and-grade-dialog";
import { GradebookExportDialog } from "@/components/gradebook-export-dialog";
import {
  api,
  apiRequest,
  Course,
  CourseGradebook,
  CourseGradebookRow,
  GradebookMutationAttempt,
  GradebookMutationGrade,
  TeacherAiFeedbackReview
} from "@/lib/api";
import {
  getAiFeedbackReviewCalculatedGradePercent,
  getAiFeedbackReviewRenderer,
  getManualGradingRenderer,
  renderTestReviewAllItem
} from "@/lib/activity-renderers";
import { getGradebookActivityActions } from "@/lib/gradebook-actions";
import { excludeAiGradingTemplateTargets } from "@/lib/ai-grading-batch";
import { useI18n } from "@/lib/i18n";
import { latestCompletedTestAttempt, type TestReviewAllSubmission } from "@/lib/test-review-all";

export default function GradebookActivityResultsPage() {
  const params = useParams<{ courseId: string; activityId: string }>();
  const searchParams = useSearchParams();
  const { courseId, activityId } = params;
  const router = useRouter();
  const groupId = searchParams.get("groupId") || undefined;
  const { t } = useI18n();
  const dialogs = useDialogs();
  const notifications = useNotifications();
  const mcqClient = useMemo(() => createMcqClient(apiRequest), []);
  const parsonsClient = useMemo(() => createParsonsClient(apiRequest), []);
  const [course, setCourse] = useState<Course | null>(null);
  const [gradebook, setGradebook] = useState<CourseGradebook | null>(null);
  const [savingGradeKey, setSavingGradeKey] = useState<string | null>(null);
  const [progressOperation, setProgressOperation] = useState<{
    title: string;
    message?: string;
    completed?: number;
    total?: number;
  } | null>(null);
  const [aiGradingBatchDialog, setAiGradingBatchDialog] = useState<{
    loading: boolean;
    ready: boolean;
    submitting: boolean;
    instructions: string;
    updateInstructions: boolean;
    templates: Array<{ attemptId: string; participantName: string; attemptNumber: number }>;
    selectedTemplateAttemptIds: string[];
    error: string;
  } | null>(null);
  const [reviewAndGradeRow, setReviewAndGradeRow] = useState<CourseGradebookRow | null>(null);
  const [showGradeExport, setShowGradeExport] = useState(false);
  const [reviewAll, setReviewAll] = useState<{
    loading: boolean;
    error: string;
    submissions: TestReviewAllSubmission[];
    activityTypeKey?: string;
    config?: Record<string, unknown>;
    responses?: ActivityReviewResponse[];
    solution?: unknown;
    tests?: Array<{ id: string; name: string }>;
    rubricCriteria?: CodingRubricCriterion[];
    mcqContext?: Parameters<typeof renderTestReviewAllItem>[0];
  } | null>(null);
  const [feedbackReview, setFeedbackReview] = useState<{
    rows: CourseGradebookRow[];
    selectedIndex: number;
    review: TeacherAiFeedbackReview | null;
    draft: Record<string, unknown> | null;
    gradeDraft: string;
    gradeTouched: boolean;
    gradeFollowsCalculated: boolean;
    preserveTeacherGrade: boolean;
    initialGrade: number | null;
    loading: boolean;
    saving: boolean;
    error: string;
  } | null>(null);

  async function refresh() {
    const [courseResult, gradebookResult] = await Promise.all([
      api.course(courseId),
      api.courseGradebook(courseId, { activityId, groupId })
    ]);
    setCourse(courseResult.course);
    setGradebook(gradebookResult.gradebook);
  }

  useEffect(() => {
    refresh().catch((err) => notifications.error(err instanceof Error ? err.message : t("courseDetail.loadError")));
  }, [activityId, courseId, groupId, notifications, t]);

  const rows = gradebook?.rows ?? [];
  const activityTitle = rows[0]?.activityTitle ?? gradebook?.items[0]?.activityTitle ?? t("common.loading");
  const activityTypeKey = rows[0]?.activityTypeKey ?? gradebook?.items[0]?.activityTypeKey ?? "";
  const activityActions = getGradebookActivityActions(activityTypeKey);
  const isSummativeActivity = (rows[0]?.assessmentMode ?? gradebook?.items[0]?.assessmentMode) === "summative";
  const canManageCourse = Boolean(course?.permissions?.canManageCourse);
  const groupTitle = groupId ? gradebook?.items.find((item) => item.groupId === groupId)?.groupTitle : null;
  const backHref = groupId ? `/courses/${courseId}?tab=gradebook&groupId=${encodeURIComponent(groupId)}` : `/courses/${courseId}?tab=gradebook`;
  const backLabel = t("courseDetail.backToCourseGradebook");
  const hasRowsWithSubmittedAttempts = rows.some((row) => hasSubmittedAttempt(row));
  const isTest = rows[0]?.activityTypeKey === "test" || gradebook?.items[0]?.activityTypeKey === "test";

  async function openReviewAll() {
    setReviewAll({ loading: true, error: "", submissions: [] });
    try {
      const activityTypeKey = rows[0]?.activityTypeKey ?? gradebook?.items[0]?.activityTypeKey ?? "";
      if (activityTypeKey !== "test") {
        const activityResult = await api.activity(courseId, activityId);
        let solution: unknown = null;
        let tests: Array<{ id: string; name: string }> = [];
        let rubricCriteria: CodingRubricCriterion[] = [];
        let aggregateResults = new Map<string, Array<{ testId: string; name: string; passed: boolean }>>();
        let aggregateRubricResults = new Map<string, Array<{ criterionId: string; scorePercent: number }>>();
        if (activityTypeKey === "coding-exercise") {
          const [definition, review] = await Promise.all([api.codingExerciseHiddenTests(courseId, activityId), api.codingExerciseReviewAll(courseId, activityId)]);
          solution = definition.referenceSolution?.sourceCode ?? null;
          tests = definition.tests.filter((test) => test.isEnabled).map((test) => ({ id: test.id, name: test.name }));
          rubricCriteria = definition.referenceSolution?.privateConfig.aiFeedback.criteria ?? [];
          aggregateResults = new Map(review.submissions.flatMap(({ participantId, attempts }) => {
            const row = rows.find((candidate) => candidate.participantId === participantId);
            const execution = row ? matchingPluginAttempt(row, attempts) : null;
            return execution ? [[participantId, normalizeCodingTestResults(execution.resultSummary.tests)] as const] : [];
          }));
          aggregateRubricResults = new Map(review.submissions.flatMap(({ participantId, attempts, rubricEvaluations }) => {
            const row = rows.find((candidate) => candidate.participantId === participantId);
            const execution = row ? matchingPluginAttempt(row, attempts) : null;
            const evaluation = execution ? rubricEvaluations.find((candidate) => candidate.executionId === execution.id) : null;
            return evaluation ? [[participantId, evaluation.criteria] as const] : [];
          }));
        }
        if (activityTypeKey === "web-design-coding-exercise") {
          const [definition, review] = await Promise.all([api.webDesignExerciseTests(courseId, activityId), api.webDesignExerciseReviewAll(courseId, activityId)]);
          solution = definition.referenceBundle?.files ?? null;
          tests = definition.tests.filter((test) => test.isEnabled && test.kind === "hidden").map((test) => ({ id: test.id, name: test.name }));
          aggregateResults = new Map(review.submissions.flatMap(({ participantId, attempts }) => {
            const row = rows.find((candidate) => candidate.participantId === participantId);
            const submission = row ? matchingPluginAttempt(row, attempts) : null;
            return submission ? [[participantId, submission.testResults.flatMap((result) => result.testId ? [{ testId: result.testId, name: result.name, passed: result.status === "completed" && (result.score ?? 0) >= result.weight }] : [])] as const] : [];
          }));
        }
        const loaded = await Promise.all(rows.map(async (row) => {
          if (activityTypeKey === "mcq") {
            const result = await mcqClient.groupGradebookAttempts(courseId, row.groupId, row.activityId, { participantId: row.participantId });
            const attempt = matchingPluginAttempt(row, result.attempts);
            return { row, state: attempt ? { answers: attempt.answers } : null };
          }
          if (activityTypeKey === "parsons-problem") {
            const result = await parsonsClient.groupGradebookAttempts(courseId, row.groupId, row.activityId, { participantId: row.participantId });
            return { row, state: matchingPluginAttempt(row, result.attempts)?.latestState ?? null };
          }
          return { row, state: null };
        }));
        const responses = loaded.map(({ row, state }) => {
          const currentRubricResults = codingRubricResultsFromFeedback(row.feedback);
          return {
            ...toActivityReviewResponse(row, state),
            testResults: aggregateResults.get(row.participantId),
            ...(activityTypeKey === "coding-exercise" ? {
              rubricResults: currentRubricResults.length
                ? currentRubricResults
                : aggregateRubricResults.get(row.participantId) ?? []
            } : {})
          };
        });
        let mcqContext: Parameters<typeof renderTestReviewAllItem>[0] | undefined;
        if (activityTypeKey === "mcq") {
          const makeItem = (response?: ActivityReviewResponse) => ({
            testItemId: activityId,
            title: activityTitle,
            activityTypeKey,
            activity: activityResult.activity,
            itemAttempt: {
              state: response?.state ?? {},
              normalizedScore: response?.score ?? null,
              normalizedMaxScore: response?.maxScore ?? null
            }
          });
          mcqContext = {
            item: makeItem(responses[0]),
            responses: responses.map((response) => ({ participantId: response.participantId, participantName: response.participantName, groupTitle: response.groupTitle, item: makeItem(response) })),
            t
          } as Parameters<typeof renderTestReviewAllItem>[0];
        }
        setReviewAll({ loading: false, error: "", submissions: [], activityTypeKey, config: activityResult.activity.config ?? {}, responses, solution, tests, rubricCriteria, mcqContext });
        return;
      }
      const reviewTargets = rows.flatMap((row) => {
        const attempt = latestCompletedTestAttempt(row);
        return attempt ? [{ row, attempt }] : [];
      });
      const submissions = await Promise.all(reviewTargets.map(async ({ row, attempt }) => ({
        participantId: row.participantId,
        participantName: row.participantName,
        groupTitle: row.groupTitle,
        durationSeconds: attempt.durationSeconds,
        isLate: attempt.isLate,
        review: (await api.testAttemptReview(courseId, attempt.id)).review
      })));
      setReviewAll({ loading: false, error: "", submissions });
    } catch (err) {
      const message = err instanceof Error ? err.message : t("courseDetail.answerLoadError");
      notifications.error(message);
      setReviewAll({ loading: false, error: message, submissions: [] });
    }
  }

  function applyUpdatedGrade(row: CourseGradebookRow, grade: GradebookMutationGrade, attempt?: GradebookMutationAttempt) {
    setGradebook((current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,
        rows: current.rows.map((candidate) => {
          if (candidate.gradebookItemId !== row.gradebookItemId || candidate.participantId !== row.participantId) {
            return candidate;
          }

          const attempts = attempt
            ? candidate.attempts.map((candidateAttempt) =>
                candidateAttempt.id === attempt.id
                  ? {
                      ...candidateAttempt,
                      lifecycle: attempt.lifecycle,
                      submittedAt: attempt.submittedAt,
                      gradedAt: attempt.gradedAt,
                      isLate: attempt.isLate,
                      lateBySeconds: attempt.lateBySeconds,
                      durationSeconds: attempt.durationSeconds
                    }
                  : candidateAttempt
              )
            : candidate.attempts;
          const selectedAttempt = grade.selectedAttemptId
            ? attempts.find((candidateAttempt) => candidateAttempt.id === grade.selectedAttemptId)
            : null;

          return {
            ...candidate,
            score: grade.normalizedScore,
            maxScore: grade.normalizedMaxScore,
            isPass: grade.isPass,
            latePenaltyApplied: grade.latePenaltyApplied,
            latePenaltyPercent: grade.latePenaltyPercent,
            selectedAttemptNumber: selectedAttempt?.attemptNumber ?? null,
            status: grade.latePenaltyApplied || selectedAttempt?.isLate ? "late" : "graded",
            needsGradingCount: attempt?.lifecycle === "graded" ? Math.max(0, candidate.needsGradingCount - 1) : candidate.needsGradingCount,
            attempts
          };
        })
      };
    });
  }

  async function regradeRow(row: CourseGradebookRow) {
    const attempt = selectedSubmittedAttempt(row);
    if (!attempt) {
      notifications.error(t("courseDetail.regradeUnavailable"));
      return;
    }
    if (!await dialogs.confirm({ message: t("courseDetail.regradeConfirm", { name: row.participantName }) })) {
      return;
    }

    setSavingGradeKey(`${row.gradebookItemId}:${row.participantId}:regrade`);
    setProgressOperation({
      title: t("courseDetail.regradeRunning"),
      message: row.participantName
    });
    try {
      const result = await api.regradeActivityAttempt(courseId, attempt.id, { reason: t("courseDetail.regradeReason") });
      await refresh();
      if (result.result) applyUpdatedGrade(row, result.result.grade, result.result.attempt);
      else notifications.success(t("courseDetail.regradeAwaitingRubric"));
    } catch (err) {
      notifications.error(err instanceof Error ? err.message : t("courseDetail.regradeError"));
    } finally {
      setSavingGradeKey(null);
      setProgressOperation(null);
    }
  }

  async function generateAiFeedbackForRow(row: CourseGradebookRow) {
    const attempt = selectedSubmittedAttempt(row);
    if (!attempt) {
      notifications.error(t("courseDetail.aiFeedbackUnavailable"));
      return;
    }
    const confirmKey = getGradebookActivityActions(row.activityTypeKey).aiAssessmentChangesGrade
      ? "courseDetail.aiAssessmentGradingConfirm"
      : "courseDetail.aiAssessmentFeedbackConfirm";
    if (!await dialogs.confirm({ message: t(confirmKey, { name: row.participantName }) })) return;
    setSavingGradeKey(`${row.gradebookItemId}:${row.participantId}:ai-feedback`);
    setProgressOperation({
      title: t("courseDetail.aiAssessmentRunning"),
      message: row.participantName
    });
    try {
      await api.generateActivityAttemptAiFeedback(courseId, attempt.id);
      await refresh();
      notifications.success(t("courseDetail.aiFeedbackGenerated"));
    } catch (err) {
      notifications.error(err instanceof Error ? err.message : t("courseDetail.aiFeedbackError"));
    } finally {
      setSavingGradeKey(null);
      setProgressOperation(null);
    }
  }

  function aiFeedbackBatchTargets(excludedAttemptIds: readonly string[] = []) {
    const eligible = groupedRows.flatMap((row) => {
      if (!getGradebookActivityActions(row.activityTypeKey).canAssessWithAi) return [];
      const attempt = selectedSubmittedAttempt(row);
      return attempt ? [{ row, attempt }] : [];
    });
    return excludeAiGradingTemplateTargets(eligible, excludedAttemptIds);
  }

  async function openAiGradingBatchDialog() {
    const eligible = aiFeedbackBatchTargets();
    if (!eligible.length) {
      notifications.error(t("courseDetail.aiFeedbackUnavailable"));
      return;
    }
    setAiGradingBatchDialog({
      loading: true,
      ready: false,
      submitting: false,
      instructions: "",
      updateInstructions: canManageCourse,
      templates: [],
      selectedTemplateAttemptIds: [],
      error: ""
    });
    try {
      const preparationAttemptIds = [...new Set([
        ...eligible.map(({ attempt }) => attempt.id),
        ...groupedRows.flatMap((row) => row.attempts.flatMap((attempt) =>
          attempt.assessmentMode === "summative" && (attempt.lifecycle === "submitted" || attempt.lifecycle === "graded") ? [attempt.id] : []
        ))
      ])];
      const setup = await api.prepareActivityAiGradingBatch(courseId, activityId, preparationAttemptIds);
      if (!setup.available) {
        setAiGradingBatchDialog(null);
        if (activityTypeKey === "test") {
          await generateAiFeedbackForAllRows();
        } else {
          notifications.error(t("courseDetail.aiBatchUnavailable"));
        }
        return;
      }
      setAiGradingBatchDialog({
        loading: false,
        ready: true,
        submitting: false,
        instructions: setup.instructions,
        updateInstructions: canManageCourse,
        templates: setup.templates,
        selectedTemplateAttemptIds: [],
        error: ""
      });
    } catch (error) {
      setAiGradingBatchDialog((current) => current ? {
        ...current,
        loading: false,
        error: error instanceof Error ? error.message : t("courseDetail.aiFeedbackError")
      } : current);
    }
  }

  async function startGuidedAiGradingBatch() {
    if (!aiGradingBatchDialog) return;
    const instructions = aiGradingBatchDialog.instructions.trim();
    if (!instructions) {
      setAiGradingBatchDialog({ ...aiGradingBatchDialog, error: t("courseDetail.aiBatchInstructionsRequired") });
      return;
    }
    const eligible = aiFeedbackBatchTargets(aiGradingBatchDialog.selectedTemplateAttemptIds);
    if (!eligible.length) {
      setAiGradingBatchDialog({ ...aiGradingBatchDialog, error: t("courseDetail.aiBatchNoTargets") });
      return;
    }
    setAiGradingBatchDialog({ ...aiGradingBatchDialog, submitting: true, error: "" });
    try {
      if (aiGradingBatchDialog.updateInstructions) {
        await api.updateActivityAiGradingInstructions(courseId, activityId, eligible[0].attempt.id, instructions);
      }
      const templateAttemptIds = aiGradingBatchDialog.selectedTemplateAttemptIds;
      setAiGradingBatchDialog(null);
      await generateAiFeedbackForAllRows({ instructions, templateAttemptIds });
    } catch (error) {
      setAiGradingBatchDialog((current) => current ? {
        ...current,
        submitting: false,
        error: error instanceof Error ? error.message : t("courseDetail.aiFeedbackError")
      } : current);
    }
  }

  async function generateAiFeedbackForAllRows(guidance?: { instructions: string; templateAttemptIds: string[] }) {
    const eligible = aiFeedbackBatchTargets(guidance?.templateAttemptIds);
    if (!eligible.length) {
      notifications.error(t("courseDetail.aiFeedbackUnavailable"));
      return;
    }
    const confirmKey = activityActions.aiAssessmentChangesGrade
      ? "courseDetail.aiAssessmentGradingAllConfirm"
      : "courseDetail.aiAssessmentFeedbackAllConfirm";
    if (!guidance && !await dialogs.confirm({ message: t(confirmKey, { count: eligible.length }) })) return;
    setSavingGradeKey("__all:ai-feedback");
    setProgressOperation({
      title: t("courseDetail.aiAssessmentRunning"),
      completed: 0,
      total: eligible.length
    });
    try {
      let completed = 0;
      const failureReasons: string[] = [];
      for (const [index, { attempt }] of eligible.entries()) {
        try {
          await api.generateActivityAttemptAiFeedback(courseId, attempt.id, {
            triggerKind: "teacher_batch",
            ...(guidance ? {
              instructions: guidance.instructions,
              templateAttemptIds: guidance.templateAttemptIds
            } : {})
          });
          completed += 1;
        } catch (err) {
          failureReasons.push(err instanceof Error ? err.message : t("courseDetail.aiFeedbackError"));
        } finally {
          setProgressOperation((current) => current ? { ...current, completed: index + 1 } : current);
        }
      }
      await refresh();
      if (completed) notifications.success(t("courseDetail.aiFeedbackGenerated"));
      if (failureReasons.length) {
        const reasonCounts = new Map<string, number>();
        for (const reason of failureReasons) {
          reasonCounts.set(reason, (reasonCounts.get(reason) ?? 0) + 1);
        }
        const mostCommonReason = [...reasonCounts].sort((left, right) => right[1] - left[1])[0]?.[0]
          ?? t("courseDetail.aiFeedbackError");
        notifications.error(t("courseDetail.aiFeedbackBatchFailed", {
          count: failureReasons.length,
          reason: mostCommonReason
        }));
      }
    } catch (err) {
      notifications.error(err instanceof Error ? err.message : t("courseDetail.aiFeedbackError"));
    } finally {
      setSavingGradeKey(null);
      setProgressOperation(null);
    }
  }

  async function openFeedbackReview(targetRows: CourseGradebookRow[], selectedIndex = 0) {
    const eligibleRows = targetRows.filter((row) => selectedFeedbackAttempt(row) && getAiFeedbackReviewRenderer(row.activityTypeKey));
    if (!eligibleRows.length) {
      notifications.error(t("courseDetail.feedbackReviewUnavailable"));
      return;
    }
    await loadFeedbackReview(eligibleRows, Math.min(selectedIndex, eligibleRows.length - 1));
  }

  async function loadFeedbackReview(targetRows: CourseGradebookRow[], selectedIndex: number) {
    const row = targetRows[selectedIndex];
    const attempt = selectedFeedbackAttempt(row);
    const preserveTeacherGrade = row.gradeSource === "manual" || row.gradeSource === "override";
    const gradeFollowsCalculated = !preserveTeacherGrade && !row.latePenaltyApplied;
    if (!attempt) {
      notifications.error(t("courseDetail.feedbackReviewUnavailable"));
      return;
    }
    setFeedbackReview({
      rows: targetRows,
      selectedIndex,
      review: null,
      draft: null,
      gradeDraft: row.score === null ? "" : formatGradeNumber(row.score),
      gradeTouched: false,
      gradeFollowsCalculated,
      preserveTeacherGrade,
      initialGrade: row.score,
      loading: true,
      saving: false,
      error: ""
    });
    try {
      const result = await api.activityAttemptAiFeedbackReview(courseId, attempt.id);
      const calculatedGrade = gradeFollowsCalculated
        ? calculatedNormalizedGrade(row, result.review.activityTypeKey, result.review.feedback)
        : null;
      setFeedbackReview({
        rows: targetRows,
        selectedIndex,
        review: result.review,
        draft: result.review.feedback,
        gradeDraft: row.score === null
          ? calculatedGrade === null ? "" : formatGradeNumber(calculatedGrade)
          : formatGradeNumber(row.score),
        gradeTouched: false,
        gradeFollowsCalculated,
        preserveTeacherGrade,
        initialGrade: row.score,
        loading: false,
        saving: false,
        error: ""
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : t("courseDetail.feedbackReviewLoadError");
      setFeedbackReview({
        rows: targetRows,
        selectedIndex,
        review: null,
        draft: null,
        gradeDraft: row.score === null ? "" : formatGradeNumber(row.score),
        gradeTouched: false,
        gradeFollowsCalculated,
        preserveTeacherGrade,
        initialGrade: row.score,
        loading: false,
        saving: false,
        error: message
      });
      notifications.error(message);
    }
  }

  async function saveFeedbackReview() {
    if (!feedbackReview?.review || !feedbackReview.draft) return;
    const row = feedbackReview.rows[feedbackReview.selectedIndex];
    const normalizedGradeDraft = feedbackReview.gradeDraft.trim();
    const parsedGrade = normalizedGradeDraft ? Number(normalizedGradeDraft) : null;
    if (
      feedbackReview.gradeTouched &&
      (parsedGrade === null || !Number.isFinite(parsedGrade) || parsedGrade < 0 || parsedGrade > row.maxScore)
    ) {
      notifications.error(t("courseDetail.overrideGradeInvalidRange", { max: formatGradeNumber(row.maxScore) }));
      return;
    }
    const feedbackChanged = JSON.stringify(feedbackReview.review.feedback) !== JSON.stringify(feedbackReview.draft);
    const gradeChanged = feedbackReview.gradeTouched && parsedGrade !== null;
    setFeedbackReview((current) => current ? { ...current, saving: true, error: "" } : current);
    try {
      const feedbackResult = feedbackChanged
        ? await api.reviseActivityAttemptAiFeedback(
            courseId,
            feedbackReview.review.attemptId,
            feedbackReview.draft,
            typeof feedbackReview.review.feedback.feedbackHash === "string"
              ? feedbackReview.review.feedback.feedbackHash
              : null
          )
        : null;
      if (feedbackResult) {
        setFeedbackReview((current) => current ? {
          ...current,
          rows: current.rows.map((candidate, index) =>
            index === current.selectedIndex && feedbackResult.grade
              ? { ...candidate, score: feedbackResult.grade.normalizedScore }
              : candidate
          ),
          review: current.review ? { ...current.review, feedback: feedbackResult.feedback } : current.review,
          draft: feedbackResult.feedback,
          initialGrade: feedbackResult.grade?.normalizedScore ?? current.initialGrade
        } : current);
      }
      const shouldPreserveTeacherGrade = feedbackReview.preserveTeacherGrade && Boolean(feedbackResult?.grade);
      const overrideResult = (gradeChanged || shouldPreserveTeacherGrade) && parsedGrade !== null
        ? await api.overrideGradebookGrade(courseId, row.gradebookItemId, row.participantId, {
            score: parsedGrade,
            maxScore: row.maxScore,
            reason: t("courseDetail.reviewAndGradeReason"),
            expectedGradeUpdatedAt: feedbackResult?.grade?.updatedAt ?? feedbackResult?.gradeUpdatedAt ?? row.gradeUpdatedAt
          })
        : null;
      const finalGrade = overrideResult?.grade.normalizedScore ?? feedbackResult?.grade?.normalizedScore ?? feedbackReview.initialGrade;
      const savedFeedback = feedbackResult?.feedback ?? feedbackReview.draft;
      setFeedbackReview((current) => current ? {
        ...current,
        saving: false,
        rows: current.rows.map((candidate, index) => index === current.selectedIndex && finalGrade !== null ? { ...candidate, score: finalGrade } : candidate),
        review: current.review ? { ...current.review, feedback: savedFeedback } : current.review,
        draft: savedFeedback,
        gradeDraft: finalGrade === null ? "" : formatGradeNumber(finalGrade),
        gradeTouched: false,
        gradeFollowsCalculated: overrideResult ? false : feedbackResult?.grade ? true : current.gradeFollowsCalculated,
        preserveTeacherGrade: overrideResult ? true : feedbackResult?.grade ? false : current.preserveTeacherGrade,
        initialGrade: finalGrade
      } : current);
      await refresh();
      notifications.success(t("courseDetail.reviewAndGradeSaved"));
    } catch (err) {
      const message = err instanceof Error ? err.message : t("courseDetail.feedbackReviewSaveError");
      setFeedbackReview((current) => current ? { ...current, saving: false, error: message } : current);
      notifications.error(message);
    }
  }

  async function regradeAllRows() {
    const rowsWithAttempts = groupedRows.filter(
      (row) =>
        getGradebookActivityActions(row.activityTypeKey).canRerunAutomaticGrading &&
        Boolean(selectedSubmittedAttempt(row))
    );
    if (!rowsWithAttempts.length) {
      notifications.error(t("courseDetail.regradeUnavailable"));
      return;
    }
    if (!await dialogs.confirm({ message: t("courseDetail.regradeAllConfirm", { count: rowsWithAttempts.length }) })) {
      return;
    }

    setSavingGradeKey("__all:regrade");
    setProgressOperation({
      title: t("courseDetail.regradeRunning"),
      completed: 0,
      total: rowsWithAttempts.length
    });
    try {
      let graded = 0;
      let pending = 0;
      let failed = 0;
      for (const [index, row] of rowsWithAttempts.entries()) {
        const attempt = selectedSubmittedAttempt(row);
        if (attempt) {
          try {
            const response = await api.regradeActivityAttempt(courseId, attempt.id, { reason: t("courseDetail.regradeReason") });
            if (response.result) graded += 1;
            else pending += 1;
          } catch {
            failed += 1;
          }
        }
        setProgressOperation((current) => current ? { ...current, completed: index + 1 } : current);
      }
      await refresh();
      notifications.success(t("courseDetail.regradeBatchSummary", { graded, pending, failed }));
    } catch (err) {
      notifications.error(err instanceof Error ? err.message : t("courseDetail.regradeError"));
    } finally {
      setSavingGradeKey(null);
      setProgressOperation(null);
    }
  }

  const groupedRows = useMemo(() => {
    return [...rows].sort((left, right) => {
      const groupDelta = left.groupTitle.localeCompare(right.groupTitle);
      return groupDelta === 0 ? left.participantName.localeCompare(right.participantName) : groupDelta;
    });
  }, [rows]);

  async function openReviewAndGrade(row: CourseGradebookRow) {
    if (row.assessmentMode === "formative") {
      router.push(manualGradingHref(courseId, activityId, groupId, row.participantId));
      return;
    }
    if (supportsAiFeedbackReview(row.activityTypeKey) || getManualGradingRenderer(row.activityTypeKey)) {
      setReviewAndGradeRow(row);
      return;
    }
    router.push(manualGradingHref(courseId, activityId, groupId, row.participantId));
  }

  async function confirmLeaveFeedbackReview(state: AiFeedbackReviewState) {
    return !hasUnsavedFeedbackReview(state) || dialogs.confirm({
      message: t("courseDetail.feedbackReviewDiscardConfirm"),
      confirmVariant: "danger"
    });
  }

  return (
    <AppShell>
      <main className="page stack">
        <section className="hero-panel hero-panel-compact">
          <div className="hero-meta">
            <p className="eyebrow">{t("courseDetail.gradebookEyebrow")}</p>
            <h1>{activityTitle}</h1>
            <p className="muted">
              {course?.title ?? t("common.loading")}
              {groupTitle ? ` · ${groupTitle}` : ""}
            </p>
          </div>
          <div className="hero-actions">
            <button className="button secondary" disabled={!course || !gradebook} type="button" onClick={() => setShowGradeExport(true)}>
              {t("courseDetail.exportGrades")}
            </button>
            <Link className="button secondary" href={backHref}>
              {backLabel}
            </Link>
          </div>
        </section>

        <section className="section stack">
          <div className="section-heading">
            <div>
              <p className="eyebrow">{t("courseDetail.detailedResults")}</p>
              <h2>{t("courseDetail.studentResultsTitle")}</h2>
            </div>
            <div className="row wrap">
              <button className="button secondary" type="button" onClick={() => void openReviewAll()}>
                {t("courseDetail.reviewAll")}
              </button>
              {isSummativeActivity && activityActions.canRerunAutomaticGrading ? (
                <button className="button secondary" disabled={!hasRowsWithSubmittedAttempts || savingGradeKey === "__all:regrade"} type="button" onClick={() => void regradeAllRows()}>
                  {savingGradeKey === "__all:regrade" ? t("common.saving") : t("courseDetail.regradeAll")}
                </button>
              ) : null}
              {isSummativeActivity && activityActions.canAssessWithAi ? (
                <button className="button secondary" disabled={savingGradeKey === "__all:ai-feedback"} type="button" onClick={() => void (activityActions.aiAssessmentChangesGrade ? openAiGradingBatchDialog() : generateAiFeedbackForAllRows())}>
                  {savingGradeKey === "__all:ai-feedback" ? t("common.saving") : t("courseDetail.generateAiFeedbackAll")}
                </button>
              ) : null}
              {isSummativeActivity && activityActions.canReviewAndGrade && supportsAiFeedbackReview(activityTypeKey) ? (
                <button className="button secondary" disabled={!hasRowsWithSubmittedAttempts} type="button" onClick={() => void openFeedbackReview(groupedRows)}>
                  {t("courseDetail.gradeAllManually")}
                </button>
              ) : activityActions.canReviewAndGrade && hasRowsWithSubmittedAttempts ? (
                <Link
                  className="button secondary"
                  href={manualGradingHref(courseId, activityId, groupId)}
                >
                  {t("courseDetail.gradeAllManually")}
                </Link>
              ) : activityActions.canReviewAndGrade ? (
                <button className="button secondary" disabled type="button">
                  {t("courseDetail.gradeAllManually")}
                </button>
              ) : null}
            </div>
          </div>

          {groupedRows.length ? (
            <div className="table-list table-list-gradebook-detail">
              <div className="table-row table-row-gradebook-detail table-head" aria-hidden="true">
                <span>{t("courseDetail.studentHeader")}</span>
                <span>{t("courseDetail.groupHeader")}</span>
                <span>{t("courseDetail.gradeHeader")}</span>
                <span>{t("courseDetail.submissionsHeader")}</span>
                <span>{t("courseDetail.actionsHeader")}</span>
              </div>
              {groupedRows.map((row) => (
                <GradebookStudentRow
                  key={`${row.gradebookItemId}-${row.participantId}`}
                  row={row}
                  savingGradeKey={savingGradeKey}
                  onReviewAndGrade={openReviewAndGrade}
                  onRegrade={regradeRow}
                  onGenerateAiFeedback={generateAiFeedbackForRow}
                  t={t}
                />
              ))}
            </div>
          ) : (
            <p className="muted">{t("courseDetail.noGradebookRows")}</p>
          )}
        </section>

        <ProgressDialog
          open={Boolean(progressOperation)}
          eyebrow={t("courseDetail.gradebookEyebrow")}
          title={progressOperation?.title ?? t("common.loading")}
          message={progressOperation?.message}
          progress={progressOperation?.total
            ? ((progressOperation.completed ?? 0) / progressOperation.total) * 100
            : null}
          progressLabel={t("common.operationProgress")}
          progressSummary={progressOperation?.total
            ? t("courseDetail.batchActionProgress", {
                completed: progressOperation.completed ?? 0,
                total: progressOperation.total
              })
            : undefined}
        />

        {showGradeExport && course && gradebook ? (
          <GradebookExportDialog
            target={{
              courseId,
              courseTitle: course.title,
              activityId,
              activityTitle,
              groupId,
              groupName: groupTitle ?? t("courseDetail.allGroups")
            }}
            onClose={() => setShowGradeExport(false)}
          />
        ) : null}

        {aiGradingBatchDialog ? (
          <div className="dialog-backdrop" role="presentation">
            <section aria-labelledby="ai-grading-batch-title" aria-modal="true" className="dialog-panel stack" role="dialog">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">{t("courseDetail.gradebookEyebrow")}</p>
                  <h2 id="ai-grading-batch-title">{t("courseDetail.aiBatchTitle")}</h2>
                  <p className="muted">{t("courseDetail.aiBatchImpact")}</p>
                </div>
                <button className="button secondary" disabled={aiGradingBatchDialog.submitting} type="button" onClick={() => setAiGradingBatchDialog(null)}>
                  {t("common.close")}
                </button>
              </div>
              {aiGradingBatchDialog.loading ? <p className="muted">{t("common.loading")}</p> : !aiGradingBatchDialog.ready ? (
                <p className="error-text" role="alert">{aiGradingBatchDialog.error}</p>
              ) : (
                <form className="form" onSubmit={(event) => {
                  event.preventDefault();
                  void startGuidedAiGradingBatch();
                }}>
                  {aiGradingBatchDialog.templates.length ? (
                    <fieldset className="field">
                      <legend>{t("courseDetail.aiBatchTemplatesLabel")}</legend>
                      <p className="muted">{t("courseDetail.aiBatchTemplatesHelp")}</p>
                      {aiGradingBatchDialog.templates.map((template) => {
                        const selected = aiGradingBatchDialog.selectedTemplateAttemptIds.includes(template.attemptId);
                        const selectionFull = aiGradingBatchDialog.selectedTemplateAttemptIds.length >= 3;
                        return (
                          <label className="checkbox-row" key={template.attemptId}>
                            <input
                              checked={selected}
                              disabled={aiGradingBatchDialog.submitting || (!selected && selectionFull)}
                              type="checkbox"
                              onChange={(event) => setAiGradingBatchDialog((current) => current ? {
                                ...current,
                                selectedTemplateAttemptIds: event.target.checked
                                  ? [...current.selectedTemplateAttemptIds, template.attemptId]
                                  : current.selectedTemplateAttemptIds.filter((id) => id !== template.attemptId)
                              } : current)}
                            />
                            <span>{t("courseDetail.aiBatchTemplateAttempt", { name: template.participantName, number: template.attemptNumber })}</span>
                          </label>
                        );
                      })}
                      <span className="muted">{t("courseDetail.aiBatchTemplatesSelected", { count: aiGradingBatchDialog.selectedTemplateAttemptIds.length })}</span>
                    </fieldset>
                  ) : null}
                  <div className="field">
                    <label htmlFor="ai-grading-batch-instructions">{t("courseDetail.aiBatchInstructionsLabel")}</label>
                    <textarea
                      id="ai-grading-batch-instructions"
                      maxLength={8000}
                      required
                      rows={7}
                      value={aiGradingBatchDialog.instructions}
                      disabled={aiGradingBatchDialog.submitting}
                      onChange={(event) => setAiGradingBatchDialog((current) => current ? { ...current, instructions: event.target.value, error: "" } : current)}
                    />
                  </div>
                  {canManageCourse ? <label className="checkbox-row">
                    <input
                      checked={aiGradingBatchDialog.updateInstructions}
                      disabled={aiGradingBatchDialog.submitting}
                      type="checkbox"
                      onChange={(event) => setAiGradingBatchDialog((current) => current ? { ...current, updateInstructions: event.target.checked } : current)}
                    />
                    <span>{t("courseDetail.aiBatchUpdateInstructions")}</span>
                  </label> : null}
                  {aiGradingBatchDialog.error ? <p className="error-text" role="alert">{aiGradingBatchDialog.error}</p> : null}
                  <div className="dialog-actions">
                    <button className="button secondary" disabled={aiGradingBatchDialog.submitting} type="button" onClick={() => setAiGradingBatchDialog(null)}>
                      {t("common.cancel")}
                    </button>
                    <button className="button primary" disabled={aiGradingBatchDialog.submitting} type="submit">
                      {aiGradingBatchDialog.submitting ? t("common.saving") : t("courseDetail.aiBatchStart")}
                    </button>
                  </div>
                </form>
              )}
            </section>
          </div>
        ) : null}

        {reviewAndGradeRow ? (
          <ReviewAndGradeDialog
            courseId={courseId}
            row={reviewAndGradeRow}
            onClose={() => setReviewAndGradeRow(null)}
            onSaved={refresh}
          />
        ) : null}
        {reviewAll ? (
          <div
            className="dialog-backdrop"
            role="presentation"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) setReviewAll(null);
            }}
          >
            {isTest ? <TestReviewAllPanel
              activityTitle={activityTitle}
              participantCount={rows.length}
              submissions={reviewAll.submissions}
              loading={reviewAll.loading}
              error={reviewAll.error}
              onClose={() => setReviewAll(null)}
              renderItem={renderTestReviewAllItem}
              t={t}
            /> : <ActivityReviewAllPanel
              activityTypeKey={reviewAll.activityTypeKey ?? rows[0]?.activityTypeKey ?? ""}
              activityTitle={activityTitle}
              config={reviewAll.config ?? {}}
              responses={reviewAll.responses ?? []}
              solution={reviewAll.solution}
              tests={reviewAll.tests}
              rubricCriteria={reviewAll.rubricCriteria}
              mcqReport={reviewAll.mcqContext ? renderTestReviewAllItem(reviewAll.mcqContext) : null}
              loading={reviewAll.loading}
              error={reviewAll.error}
              onClose={() => setReviewAll(null)}
              t={t}
            />}
          </div>
        ) : null}
        {feedbackReview ? (
          <div
            className="dialog-backdrop"
            role="presentation"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) void confirmLeaveFeedbackReview(feedbackReview).then((confirmed) => {
                if (confirmed) setFeedbackReview(null);
              });
            }}
          >
            <AiFeedbackReviewPanel
              state={feedbackReview}
              onClose={() => {
                void confirmLeaveFeedbackReview(feedbackReview).then((confirmed) => {
                  if (confirmed) setFeedbackReview(null);
                });
              }}
              onFeedbackChange={(draft) => setFeedbackReview((current) => {
                if (!current) return current;
                const row = current.rows[current.selectedIndex];
                const calculatedGrade = current.review && current.gradeFollowsCalculated && !current.gradeTouched
                  ? calculatedNormalizedGrade(row, current.review.activityTypeKey, draft)
                  : null;
                return {
                  ...current,
                  draft,
                  ...(calculatedGrade === null ? {} : { gradeDraft: formatGradeNumber(calculatedGrade) })
                };
              })}
              onGradeChange={(gradeDraft) => setFeedbackReview((current) => current ? {
                ...current,
                gradeDraft,
                gradeTouched: true,
                gradeFollowsCalculated: false,
                preserveTeacherGrade: true
              } : current)}
              onSelectIndex={(selectedIndex) => {
                void confirmLeaveFeedbackReview(feedbackReview).then((confirmed) => {
                  if (confirmed) void loadFeedbackReview(feedbackReview.rows, selectedIndex);
                });
              }}
              onSave={saveFeedbackReview}
              t={t}
            />
          </div>
        ) : null}
      </main>
    </AppShell>
  );
}

type AiFeedbackReviewState = {
  rows: CourseGradebookRow[];
  selectedIndex: number;
  review: TeacherAiFeedbackReview | null;
  draft: Record<string, unknown> | null;
  gradeDraft: string;
  gradeTouched: boolean;
  gradeFollowsCalculated: boolean;
  preserveTeacherGrade: boolean;
  initialGrade: number | null;
  loading: boolean;
  saving: boolean;
  error: string;
};

function AiFeedbackReviewPanel({ state, onClose, onFeedbackChange, onGradeChange, onSelectIndex, onSave, t }: {
  state: AiFeedbackReviewState;
  onClose: () => void;
  onFeedbackChange: (feedback: Record<string, unknown>) => void;
  onGradeChange: (grade: string) => void;
  onSelectIndex: (index: number) => void;
  onSave: () => Promise<void>;
  t: (key: string, params?: Record<string, string | number>) => string;
}) {
  const row = state.rows[state.selectedIndex];
  const renderer = state.review ? getAiFeedbackReviewRenderer(state.review.activityTypeKey) : null;
  const teacherRevision = state.review && typeof state.review.feedback.teacherRevision === "number" ? state.review.feedback.teacherRevision : 0;
  return (
    <section className="dialog-panel answer-overlay test-review-overlay stack" role="dialog" aria-modal="true">
      <div className="section-heading">
        <div>
          <p className="eyebrow">{row?.groupTitle}</p>
          <h2>{t("courseDetail.reviewAndGrade")}</h2>
          <p className="muted">
            {row?.participantName} · {state.selectedIndex + 1} / {state.rows.length}
          </p>
        </div>
        <button className="button secondary" type="button" onClick={onClose}>{t("common.close")}</button>
      </div>
      {state.rows.length > 1 ? (
        <div className="row wrap">
          <button className="button secondary" disabled={state.loading || state.selectedIndex === 0} type="button" onClick={() => onSelectIndex(state.selectedIndex - 1)}>
            {t("courseDetail.feedbackReviewPrevious")}
          </button>
          <button className="button secondary" disabled={state.loading || state.selectedIndex >= state.rows.length - 1} type="button" onClick={() => onSelectIndex(state.selectedIndex + 1)}>
            {t("courseDetail.feedbackReviewNext")}
          </button>
        </div>
      ) : null}
      {state.loading ? <p className="muted">{t("courseDetail.loadingStudentAnswers")}</p> : null}
      {state.error ? <p className="error-text">{state.error}</p> : null}
      {state.review?.gradesReleased ? <p className="inline-panel muted">{t("courseDetail.feedbackReviewReleasedNote")}</p> : null}
      {teacherRevision > 0 ? <p className="muted">{t("courseDetail.feedbackReviewRevision", { number: teacherRevision })}</p> : null}
      {!state.loading && state.review && state.draft && renderer
        ? renderer({ feedback: state.draft, submission: state.review.submission, onFeedbackChange, t })
        : null}
      {!state.loading && state.review && !renderer ? <p className="error-text">{t("courseDetail.feedbackReviewUnavailable")}</p> : null}
      {!state.loading && state.review && state.draft && renderer ? (
        <div className="stack">
          <div className="inline-panel form">
            <div className="field" style={{ maxWidth: 260 }}>
              <label htmlFor={`review-grade-${row.gradebookItemId}-${row.participantId}`}>
                {t("courseDetail.finalGrade", { max: formatGradeNumber(row.maxScore) })}
              </label>
              <input
                id={`review-grade-${row.gradebookItemId}-${row.participantId}`}
                inputMode="decimal"
                max={row.maxScore}
                min={0}
                step="any"
                type="number"
                value={state.gradeDraft}
                onChange={(event) => onGradeChange(event.target.value)}
              />
              <span className="muted">{t("courseDetail.finalGradeHelp")}</span>
            </div>
          </div>
          <div className="row wrap dialog-actions">
            <button className="button primary" disabled={state.saving} type="button" onClick={() => void onSave()}>
              {state.saving ? t("common.saving") : t("courseDetail.saveReview")}
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function hasUnsavedFeedbackReview(state: AiFeedbackReviewState) {
  return Boolean(
    state.review &&
    state.draft &&
    (JSON.stringify(state.review.feedback) !== JSON.stringify(state.draft) || state.gradeTouched)
  );
}

function GradebookStudentRow({
  row,
  savingGradeKey,
  onReviewAndGrade,
  onRegrade,
  onGenerateAiFeedback,
  t
}: {
  row: CourseGradebookRow;
  savingGradeKey: string | null;
  onReviewAndGrade: (row: CourseGradebookRow) => Promise<void>;
  onRegrade: (row: CourseGradebookRow) => Promise<void>;
  onGenerateAiFeedback: (row: CourseGradebookRow) => Promise<void>;
  t: (key: string, params?: Record<string, string | number>) => string;
}) {
  const rowHasSubmittedAttempt = hasSubmittedAttempt(row);

  return (
    <div className="table-row table-row-gradebook-detail">
      <div className="table-main table-main-stack">
        <strong>{row.participantName}</strong>
        <span className="table-meta-note muted">{row.participantEmail}</span>
      </div>
      <span className="table-meta muted">{row.groupTitle}</span>
      <div className="gradebook-grade-cell">
        <strong>{rowHasSubmittedAttempt || row.score !== null ? formatGradebookScore(row.score, row.maxScore) : t("courseDetail.didNotSubmit")}</strong>
        {row.gradeCompletion?.status === "partial" ? (
          <span
            className="grade-completion-badge grade-completion-badge-partial"
            title={t("courseDetail.partialGradeDescription", {
              completed: row.gradeCompletion.completedComponentCount,
              required: row.gradeCompletion.requiredComponentCount
            })}
          >
            <span aria-hidden="true">◐</span>
            {t("courseDetail.partialGrade")}
          </span>
        ) : null}
      </div>
      <span className="table-meta muted">{row.submittedAttemptCount}</span>
      <div className="table-actions">
        {row.assessmentMode === "summative" && getGradebookActivityActions(row.activityTypeKey).canAssessWithAi ? (
          <button
            className="button secondary"
            disabled={!rowHasSubmittedAttempt || savingGradeKey === `${row.gradebookItemId}:${row.participantId}:ai-feedback`}
            type="button"
            onClick={() => onGenerateAiFeedback(row)}
          >
            {t("courseDetail.generateAiFeedback")}
          </button>
        ) : null}
        {row.assessmentMode === "summative" && getGradebookActivityActions(row.activityTypeKey).canRerunAutomaticGrading ? (
          <button
            className="button secondary"
            disabled={!rowHasSubmittedAttempt || savingGradeKey === `${row.gradebookItemId}:${row.participantId}:regrade`}
            type="button"
            onClick={() => onRegrade(row)}
          >
            {t("courseDetail.regrade")}
          </button>
        ) : null}
        {getGradebookActivityActions(row.activityTypeKey).canReviewAndGrade ? (
          <button
            className="button secondary"
            disabled={(row.assessmentMode === "summative" && !rowHasSubmittedAttempt) || savingGradeKey === `${row.gradebookItemId}:${row.participantId}:override`}
            type="button"
            onClick={() => onReviewAndGrade(row)}
          >
            {t(row.assessmentMode === "formative" ? "courseDetail.inspectAttempts" : "courseDetail.reviewAndGrade")}
          </button>
        ) : null}
      </div>
    </div>
  );
}

function normalizeCodingTestResults(value: unknown): Array<{ testId: string; name: string; passed: boolean }> {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return [];
    const result = entry as Record<string, unknown>;
    return typeof result.id === "string" && typeof result.name === "string" && typeof result.passed === "boolean"
      ? [{ testId: result.id, name: result.name, passed: result.passed }]
      : [];
  });
}

function hasSubmittedAttempt(row: CourseGradebookRow) {
  return Boolean(selectedSubmittedAttempt(row));
}

function matchingPluginAttempt<T extends { id: string }>(row: CourseGradebookRow, attempts: T[]): T | null {
  const currentModeRefs = new Set(
    row.attempts
      .filter((attempt) => attempt.assessmentMode === row.assessmentMode && attempt.pluginAttemptRef)
      .map((attempt) => attempt.pluginAttemptRef as string)
  );
  const matched = attempts.find((attempt) => currentModeRefs.has(attempt.id));
  if (matched) return matched;
  if (row.assessmentMode === "summative") return null;

  const allCoreRefs = new Set(row.attempts.flatMap((attempt) => attempt.pluginAttemptRef ? [attempt.pluginAttemptRef] : []));
  return attempts.find((attempt) => !allCoreRefs.has(attempt.id)) ?? attempts[0] ?? null;
}

function supportsAiFeedbackReview(activityTypeKey: string) {
  return Boolean(getAiFeedbackReviewRenderer(activityTypeKey));
}

function manualGradingHref(courseId: string, activityId: string, groupId?: string, participantId?: string) {
  const search = new URLSearchParams();
  if (groupId) search.set("groupId", groupId);
  if (participantId) search.set("participantId", participantId);
  const query = search.toString();
  return `/courses/${courseId}/gradebook/activities/${activityId}/manual${query ? `?${query}` : ""}`;
}

function selectedFeedbackAttempt(row: CourseGradebookRow) {
  return selectedSubmittedAttempt(row);
}

function selectedSubmittedAttempt(row: CourseGradebookRow) {
  const currentModeAttempts = row.attempts.filter((candidate) => candidate.assessmentMode === row.assessmentMode);
  return currentModeAttempts.find((candidate) => candidate.attemptNumber === row.selectedAttemptNumber)
    ?? [...currentModeAttempts].reverse().find((candidate) => candidate.lifecycle === "graded" || candidate.lifecycle === "submitted")
    ?? null;
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

function calculatedNormalizedGrade(
  row: CourseGradebookRow,
  activityTypeKey: string,
  feedback: Record<string, unknown>
) {
  const percent = getAiFeedbackReviewCalculatedGradePercent(activityTypeKey, feedback);
  return percent === null ? null : percent * row.maxScore / 100;
}
