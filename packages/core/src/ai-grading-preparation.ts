import type { CurrentUser } from "@cognelo/contracts";
import { Prisma, prisma } from "@cognelo/db";
import { resolvePluginAiFeedbackHandler, resolvePluginAiFeedbackPublisher, resolvePluginAiFeedbackTeacherReviewHandler,
  resolvePluginAiGradingBatchHandler, type PluginAiFeedbackResult, type PluginAiFeedbackTeacherReviewContext,
  type PluginAiGradingBatchGuidance } from "@cognelo/activity-sdk/server";
import { AppError } from "./errors";
import { getActivityAttemptRegradeContext, recordActivityAttemptGradingResult, recordActivityAttemptAiFeedback } from "./gradebook";
import { getTeacherAttemptAiFeedbackReview, recordAiFeedbackResearchEvent } from "./ai-feedback";
import { resolveTestAiGradingGuidance } from "./test-ai-grading";
import { recordTestItemAiFeedback, recalculateTestAttemptGrade } from "./test-execution";

export type AiGradingGuidance = { instructions?: string; templateAttemptIds?: string[] };
type Evaluation = { activityId: string; activityTypeKey: string; testItemId?: string; expectedUpdatedAt?: string; evaluation: PluginAiFeedbackResult };
export type PreparedAiGrading = {
  attemptId: string;
  activityTypeKey: string;
  expected: { attempt: string; grade: string | null; children: Record<string, string> };
  evaluations: Evaluation[];
};

export async function prepareAiGradingAttempt(user: CurrentUser, courseId: string, attemptId: string,
  options: AiGradingGuidance = {}, checkRunning: () => Promise<void> = async () => {}) : Promise<PreparedAiGrading> {
  const context = await getActivityAttemptRegradeContext(user, courseId, attemptId);
  if (!["submitted", "graded"].includes(context.lifecycle)) throw new AppError(409, "SUBMISSION_NOT_COMPLETED", "A submitted attempt is required.");
  const before = await prisma.activityAttempt.findUniqueOrThrow({ where: { id: attemptId }, include: { testItemAttempts: true } });
  const grade = await prisma.grade.findUnique({ where: { gradebookItemId_participantId: {
    gradebookItemId: before.gradebookItemId, participantId: before.participantId
  } } });
  const prepared: PreparedAiGrading = { attemptId, activityTypeKey: context.activityTypeKey,
    expected: { attempt: before.updatedAt.toISOString(), grade: grade?.updatedAt.toISOString() ?? null,
      children: Object.fromEntries(before.testItemAttempts.map(child => [child.testItemId, child.updatedAt.toISOString()])) }, evaluations: [] };
  if (context.activityTypeKey === "test") {
    if (options.instructions !== undefined) throw new AppError(400, "TEST_AI_INSTRUCTIONS_QUESTION_SPECIFIC", "A Test uses each question's saved instructions.");
    const { review, guidance } = await resolveTestAiGradingGuidance(user, courseId, attemptId, options.templateAttemptIds ?? []);
    for (const item of review.items) {
      await checkRunning();
      const evaluate = resolvePluginAiFeedbackHandler(item.activityTypeKey);
      if (!evaluate) continue;
      assertStagingSupported(item.activityTypeKey);
      try {
        const evaluation = await evaluate({ user, courseId, groupId: context.groupId, activityId: item.activityId,
          coreAttemptId: attemptId, pluginAttemptRef: item.itemAttempt.pluginAttemptRef, activity: item.activity,
          triggerKind: "test_child", deferPublication: true, batchGuidance: guidance.get(item.testItemId),
          testItemAttempt: { id: item.itemAttempt.id, parentAttemptId: attemptId,
            pluginAttemptRef: item.itemAttempt.pluginAttemptRef, state: item.itemAttempt.state } });
        prepared.evaluations.push({ activityId: item.activityId, activityTypeKey: item.activityTypeKey,
          testItemId: item.testItemId, expectedUpdatedAt: item.itemAttempt.updatedAt, evaluation });
      } catch (error) {
        // A question without AI enabled can retain its complete deterministic grade.
        if (error instanceof AppError && ["ACTIVITY_AI_FEEDBACK_DISABLED", "AI_FEEDBACK_DISABLED"].includes(error.code)
          && item.itemAttempt.lifecycle === "graded") continue;
        throw error;
      }
    }
    if (review.items.some(item => item.itemAttempt.lifecycle !== "graded"
      && !prepared.evaluations.some(entry => entry.testItemId === item.testItemId && entry.evaluation.gradingResult))) {
      throw new AppError(409, "TEST_ITEMS_NOT_GRADED", "Every exercise must be graded before keeping this Test.");
    }
  } else {
    const evaluate = resolvePluginAiFeedbackHandler(context.activityTypeKey);
    if (!evaluate) throw new AppError(409, "PLUGIN_AI_FEEDBACK_UNAVAILABLE", "This activity does not support AI grading.");
    assertStagingSupported(context.activityTypeKey);
    const guidance = options.instructions !== undefined || options.templateAttemptIds?.length
      ? await resolveBatchGuidance({ user, courseId, targetAttemptId: attemptId, targetActivityId: context.activityId,
          activityTypeKey: context.activityTypeKey, instructions: options.instructions, templateAttemptIds: options.templateAttemptIds ?? [] }) : undefined;
    await checkRunning();
    const evaluation = await evaluate({ user, courseId, groupId: context.groupId, activityId: context.activityId,
      coreAttemptId: attemptId, pluginAttemptRef: context.pluginAttemptRef, activity: context.activity,
      triggerKind: "teacher_batch", deferPublication: true, batchGuidance: guidance });
    prepared.evaluations.push({ activityId: context.activityId, activityTypeKey: context.activityTypeKey, evaluation });
  }
  if (!prepared.evaluations.length) throw new AppError(409, "TEST_AI_FEEDBACK_UNAVAILABLE", "No exercise has effective AI grading configuration.");
  await checkRunning();
  return prepared;
}

export async function commitPreparedAiGrading(user: CurrentUser, courseId: string, prepared: PreparedAiGrading, tx: Prisma.TransactionClient) {
  const context = await getActivityAttemptRegradeContext(user, courseId, prepared.attemptId);
  await tx.$queryRaw`SELECT id FROM "ActivityAttempt" WHERE id = ${prepared.attemptId} FOR UPDATE`;
  const attempt = await tx.activityAttempt.findUniqueOrThrow({ where: { id: prepared.attemptId }, include: { testItemAttempts: true } });
  await tx.$queryRaw`SELECT id FROM "Grade" WHERE "gradebookItemId" = ${attempt.gradebookItemId} AND "participantId" = ${attempt.participantId} FOR UPDATE`;
  const grade = await tx.grade.findUnique({ where: { gradebookItemId_participantId: {
    gradebookItemId: attempt.gradebookItemId, participantId: attempt.participantId
  } } });
  if (attempt.updatedAt.toISOString() !== prepared.expected.attempt || !["submitted", "graded"].includes(attempt.lifecycle)
    || (grade?.updatedAt.toISOString() ?? null) !== prepared.expected.grade
    || attempt.testItemAttempts.length !== Object.keys(prepared.expected.children).length
    || attempt.testItemAttempts.some(child => prepared.expected.children[child.testItemId] !== child.updatedAt.toISOString())) {
    throw new AppError(409, "AI_GRADING_CONFLICT", "A submission or grade changed during AI grading. Discard this run and grade the latest copies again.");
  }
  if (prepared.activityTypeKey === "test") {
    const claim = await tx.testSubmissionClaim.findUnique({ where: { parentAttemptId: attempt.id } });
    if (claim?.status === "processing" && claim.updatedAt.getTime() > Date.now() - 30 * 60_000) throw new AppError(409, "AI_GRADING_CONFLICT", "This Test is being regraded. Discard this run and try again.");
  }
  let result: unknown;
  for (const entry of prepared.evaluations) {
    const evaluation = entry.evaluation;
    const publish = resolvePluginAiFeedbackPublisher(entry.activityTypeKey);
    if (!publish) assertStagingSupported(entry.activityTypeKey);
    await publish!({ activityId: entry.activityId, coreAttemptId: attempt.id, feedbackRef: evaluation.feedbackRef,
      transaction: { execute: (query, ...values) => tx.$executeRaw(query, ...values) } });
    if (entry.testItemId) {
      await recordTestItemAiFeedback(user, courseId, attempt.id, entry.testItemId, {
        ...evaluation, expectedUpdatedAt: entry.expectedUpdatedAt
      }, tx);
    } else if (evaluation.gradingResult) {
      const grading = evaluation.gradingResult;
      result = await recordActivityAttemptGradingResult(user, {
        attemptId: attempt.id, rawScore: grading.rawScore, rawMaxScore: grading.rawMaxScore,
        source: context.lifecycle === "graded" ? "regrade" : "auto", isPass: grading.isPass,
        rawResult: { feedback: evaluation.feedback, analyticsPayload: grading.analyticsPayload ?? {} } as Prisma.InputJsonValue,
        normalizedResult: { ...(grading.metadata ?? {}), studentFeedback: { ...evaluation.feedback,
          feedbackRef: evaluation.feedbackRef, feedbackVersion: evaluation.feedbackVersion, feedbackHash: evaluation.feedbackHash, challengeAllowed: true } } as Prisma.InputJsonValue,
        metadata: { aiFeedbackRef: evaluation.feedbackRef, aiFeedbackVersion: evaluation.feedbackVersion }
      }, tx);
    } else result = await recordActivityAttemptAiFeedback(user, courseId, { attemptId: attempt.id, ...evaluation }, tx);
    await recordAiFeedbackResearchEvent({ eventType: "grade_feedback_recorded", courseId, groupId: context.groupId,
      activityId: entry.activityId, attemptId: attempt.id, actorUserId: user.id, pluginKey: entry.activityTypeKey,
      feedbackRef: evaluation.feedbackRef, feedbackVersion: evaluation.feedbackVersion, feedbackHash: evaluation.feedbackHash,
      assessmentMode: "summative", triggerKind: entry.testItemId ? "test_child" : "teacher_batch",
      outcome: evaluation.gradingResult ? "graded" : "feedback_recorded" }, tx);
  }
  if (prepared.activityTypeKey === "test") result = await recalculateTestAttemptGrade(user, courseId, attempt.id, "AI grading", tx);
  await tx.courseAuditEvent.create({ data: { courseId, actorUserId: user.id, eventType: "ai_grading_committed",
    targetType: "ActivityAttempt", targetId: attempt.id,
    nextValue: { feedbackRefs: prepared.evaluations.map(entry => entry.evaluation.feedbackRef) } } });
  return result;
}

function assertStagingSupported(key: string) {
  if (!resolvePluginAiFeedbackPublisher(key)) throw new AppError(409, "AI_GRADING_STAGING_UNSUPPORTED", "This activity does not support cancellable grading.");
}
function validateTemplates(target: string, ids: string[]) {
  if (ids.length > 3 || new Set(ids).size !== ids.length || ids.includes(target)) {
    throw new AppError(400, "AI_BATCH_TEMPLATE_INVALID", "Select up to three distinct templates outside the grading targets.");
  }
  return ids;
}

async function resolveBatchGuidance(input: {
  user: CurrentUser;
  courseId: string;
  targetAttemptId: string;
  targetActivityId: string;
  activityTypeKey: string;
  instructions?: string;
  templateAttemptIds: string[];
}): Promise<PluginAiGradingBatchGuidance> {
  const batchGrading = resolvePluginAiGradingBatchHandler(input.activityTypeKey);
  const teacherReview = resolvePluginAiFeedbackTeacherReviewHandler(input.activityTypeKey);
  if (!batchGrading || !teacherReview) {
    throw new AppError(409, "PLUGIN_AI_BATCH_GRADING_UNAVAILABLE", "This activity type does not support guided batch AI grading.");
  }
  const uniqueTemplateIds = validateTemplates(input.targetAttemptId, input.templateAttemptIds);
  const templates = await Promise.all(uniqueTemplateIds.map(async (templateAttemptId) => {
    const context = await getActivityAttemptRegradeContext(input.user, input.courseId, templateAttemptId);
    if (context.activityId !== input.targetActivityId || context.activityTypeKey !== input.activityTypeKey || !["submitted", "graded"].includes(context.lifecycle)) {
      throw new AppError(400, "AI_BATCH_TEMPLATE_INVALID", "Every grading template must be a submitted attempt for the same activity.");
    }
    const reviewContext: PluginAiFeedbackTeacherReviewContext = {
      user: input.user,
      courseId: context.courseId,
      groupId: context.groupId,
      activityId: context.activityId,
      coreAttemptId: context.attemptId,
      pluginAttemptRef: context.pluginAttemptRef,
      activity: context.activity
    };
    const review = await getTeacherAttemptAiFeedbackReview(input.user, input.courseId, templateAttemptId);
    if (!review.feedback || !await batchGrading.isTemplateComplete({ ...reviewContext, feedback: review.feedback })) {
      throw new AppError(400, "AI_BATCH_TEMPLATE_INCOMPLETE", "Every grading template must contain a completed rubric and teacher comments.");
    }
    return {
      coreAttemptId: templateAttemptId,
      submission: await teacherReview.getSubmission(reviewContext),
      feedback: review.feedback
    };
  }));
  return { instructions: input.instructions, templates };
}
