import type { CurrentUser } from "@cognelo/contracts";
import type { PluginGradingDeferredResult, PluginGradingResult, ServerActivityRecord } from "@cognelo/activity-sdk/server";
import { AppError, getTeacherAttemptAiFeedbackReview, hashAiFeedbackValue, recordAiFeedbackResearchEvent } from "@cognelo/core";
import { regradeCodingExerciseTests } from "./executions";
import { prisma } from "./db-client";

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function percent(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 100 ? value : null;
}

export async function regradeCodingExerciseAttempt(input: {
  user: CurrentUser;
  courseId: string;
  groupId: string;
  activityId: string;
  coreAttemptId: string;
  executionId: string;
  activity: ServerActivityRecord;
}): Promise<PluginGradingResult | PluginGradingDeferredResult> {
  const testRun = await regradeCodingExerciseTests({
    activityId: input.activityId,
    executionId: input.executionId,
    actorUserId: input.user.id,
    activityConfig: input.activity.config
  });
  const resultSummary = asRecord(testRun.resultSummary);
  const earnedWeight = percentWeight(resultSummary.earnedWeight);
  const totalWeight = percentWeight(resultSummary.totalWeight);
  if (earnedWeight === null || totalWeight === null || totalWeight <= 0) {
    throw new AppError(409, "CODING_EXERCISE_RESULT_INVALID", "The regraded test result does not contain a valid weighted score.");
  }
  const deterministicScore = Math.max(0, Math.min(100, earnedWeight / totalWeight * 100));
  const [review, latestEvaluation] = await Promise.all([
    getTeacherAttemptAiFeedbackReview(input.user, input.courseId, input.coreAttemptId),
    prisma.pluginCodingExerciseAiEvaluation.findFirst({
      where: { activityId: input.activityId, executionId: input.executionId, status: "completed" },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }]
    })
  ]);
  const policy = testRun.feedbackConfig;
  const feedback = review.feedback ?? asRecord(latestEvaluation?.sanitizedFeedback);
  const rubricScore = percent(feedback.aiScore) ?? percent(latestEvaluation?.aiScore);
  const hasRubric = policy.gradingEnabled;

  await recordAiFeedbackResearchEvent({
    eventType: "coding_tests_regraded",
    courseId: input.courseId,
    groupId: input.groupId,
    activityId: input.activityId,
    groupActivityId: input.activity.assignment?.id ?? null,
    attemptId: input.coreAttemptId,
    actorUserId: input.user.id,
    pluginKey: "coding-exercises",
    assessmentMode: "summative",
    triggerKind: "teacher_regrade",
    outcome: hasRubric && rubricScore === null ? "awaiting_rubric" : "completed",
    metadata: {
      testEvaluationId: testRun.testEvaluationId,
      deterministicScore,
      rubricScore,
      testWeightPercent: hasRubric ? policy.testWeightPercent : 100,
      rubricWeightPercent: hasRubric ? policy.aiWeightPercent : 0
    }
  });

  if (hasRubric && rubricScore === null) {
    return {
      deferred: true,
      reason: "Tests were regraded, but a rubric score is required before the final grade can be recalculated.",
      metadata: { testEvaluationId: testRun.testEvaluationId, deterministicScore }
    };
  }

  const combinedScore = hasRubric
    ? deterministicScore * policy.testWeightPercent / 100 + (rubricScore ?? 0) * policy.aiWeightPercent / 100
    : deterministicScore;
  const priorFeedbackRef = typeof feedback.feedbackRef === "string" ? feedback.feedbackRef : latestEvaluation?.id ?? null;
  const { feedbackHash: _previousFeedbackHash, ...feedbackWithoutHash } = feedback;
  const updatedFeedback = Object.keys(feedback).length
    ? {
        ...feedbackWithoutHash,
        sourceFeedbackRef: priorFeedbackRef,
        sourceFeedbackVersion: typeof feedback.feedbackVersion === "number" ? feedback.feedbackVersion : latestEvaluation?.version ?? null,
        feedbackRef: `test-regrade:${testRun.testEvaluationId}`,
        feedbackVersion: 1,
        deterministicScore,
        ...(rubricScore !== null ? { aiScore: rubricScore } : {}),
        combinedScore,
        gradingEnabled: hasRubric,
        testWeightPercent: hasRubric ? policy.testWeightPercent : 100,
        aiWeightPercent: hasRubric ? policy.aiWeightPercent : 0,
        challengeAllowed: hasRubric && feedback.challengeAllowed === true,
        testEvaluationId: testRun.testEvaluationId
      }
    : null;
  const studentFeedback = updatedFeedback
    ? { ...updatedFeedback, feedbackHash: hashAiFeedbackValue(updatedFeedback) }
    : null;

  return {
    rawScore: combinedScore,
    rawMaxScore: 100,
    feedback: studentFeedback ?? {},
    analyticsPayload: {
      deterministicScore,
      ...(rubricScore !== null ? { aiScore: rubricScore } : {}),
      combinedScore,
      testEvaluationId: testRun.testEvaluationId,
      resultSummary
    },
    metadata: {
      kind: "coding-exercise",
      executionId: input.executionId,
      testEvaluationId: testRun.testEvaluationId,
      deterministicScore,
      ...(rubricScore !== null ? { aiScore: rubricScore } : {}),
      combinedScore,
      ...(studentFeedback ? { studentFeedback } : {})
    }
  };
}

function percentWeight(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}
