import { NextRequest } from "next/server";
import {
  resolvePluginAiFeedbackHandler,
  resolvePluginAiFeedbackTeacherReviewHandler,
  resolvePluginAiGradingBatchHandler,
  type PluginAiFeedbackTeacherReviewContext,
  type PluginAiGradingBatchGuidance
} from "@cognelo/activity-sdk/server";
import { AppError, getActivityAttemptRegradeContext, getTeacherAttemptAiFeedbackReview, getTestAttemptReview, recordActivityAttemptAiFeedback, recordActivityAttemptGradingResult, recordAiFeedbackResearchEvent, recordTestItemAiFeedback, regradeTestAttempt, reviseTeacherAttemptAiFeedback } from "@cognelo/core";
import type { Prisma } from "@cognelo/db";
import { z } from "zod";
import { handleRoute, json, options, readJson, requireUser } from "@/lib/http";
import { validateAiGradingTemplateAttemptIds } from "@/lib/ai-grading-batch";

type Params = { params: Promise<{ courseId: string; attemptId: string }> };

const generateSchema = z.object({
  triggerKind: z.enum(["teacher_single", "teacher_selection", "teacher_batch"]).optional(),
  instructions: z.string().trim().min(1).max(8000).optional(),
  templateAttemptIds: z.array(z.string().min(1)).max(3).optional()
}).strict();

export function OPTIONS() {
  return options();
}

export async function GET(_request: NextRequest, { params }: Params) {
  return handleRoute(async () => {
    const user = await requireUser();
    const { courseId, attemptId } = await params;
    const context = await getActivityAttemptRegradeContext(user, courseId, attemptId);
    const teacherReview = resolvePluginAiFeedbackTeacherReviewHandler(context.activityTypeKey);
    if (!teacherReview) {
      throw new AppError(409, "PLUGIN_AI_FEEDBACK_REVIEW_UNAVAILABLE", "This activity type does not provide a feedback review interface.");
    }
    const teacherReviewContext = {
      user,
      courseId: context.courseId,
      groupId: context.groupId,
      activityId: context.activityId,
      coreAttemptId: context.attemptId,
      pluginAttemptRef: context.pluginAttemptRef,
      activity: context.activity
    };
    const [review, submission] = await Promise.all([
      getTeacherAttemptAiFeedbackReview(user, courseId, attemptId),
      teacherReview.getSubmission(teacherReviewContext)
    ]);
    const feedback = review.feedback ?? await teacherReview.createFeedbackDraft(teacherReviewContext);
    return json({ review: { ...review, activityTypeKey: context.activityTypeKey, submission, feedback } });
  });
}

export async function PATCH(request: NextRequest, { params }: Params) {
  return handleRoute(async () => {
    const user = await requireUser();
    const { courseId, attemptId } = await params;
    const body = await readJson(request) as { feedback?: unknown };
    const context = await getActivityAttemptRegradeContext(user, courseId, attemptId);
    const teacherReview = resolvePluginAiFeedbackTeacherReviewHandler(context.activityTypeKey);
    if (!teacherReview) {
      throw new AppError(409, "PLUGIN_AI_FEEDBACK_REVIEW_UNAVAILABLE", "This activity type does not provide a feedback review interface.");
    }
    const teacherReviewContext = {
      user,
      courseId: context.courseId,
      groupId: context.groupId,
      activityId: context.activityId,
      coreAttemptId: context.attemptId,
      pluginAttemptRef: context.pluginAttemptRef,
      activity: context.activity
    };
    const current = await getTeacherAttemptAiFeedbackReview(user, courseId, attemptId);
    const currentFeedback = current.feedback ?? await teacherReview.createFeedbackDraft(teacherReviewContext);
    const revision = await teacherReview.reviseFeedback({
      ...teacherReviewContext,
      currentFeedback,
      feedback: body.feedback
    });
    const revised = await reviseTeacherAttemptAiFeedback(user, courseId, attemptId, revision.feedback);
    const revisedAiWeightPercent = (revised.feedback as Record<string, unknown>).aiWeightPercent;
    const grading = revision.gradingResult
      ? await recordActivityAttemptGradingResult(user, {
          attemptId: context.attemptId,
          rawScore: revision.gradingResult.rawScore,
          rawMaxScore: revision.gradingResult.rawMaxScore,
          source: "regrade",
          isPass: revision.gradingResult.isPass,
          rawResult: {
            feedback: revised.feedback,
            analyticsPayload: revision.gradingResult.analyticsPayload ?? {}
          } as Prisma.InputJsonValue,
          normalizedResult: (revision.gradingResult.metadata ?? {}) as Prisma.InputJsonValue,
          metadata: {
            aiFeedbackRef: revised.feedback.feedbackRef,
            aiFeedbackVersion: revised.feedback.feedbackVersion,
            feedbackHash: revised.feedbackHash,
            teacherFeedbackRevision: revised.teacherRevision,
            teacherRubricAdjusted: true
          } as Prisma.InputJsonValue,
          reason: "Teacher rubric review"
        })
      : null;
    if (revision.gradingResult) {
      await recordAiFeedbackResearchEvent({
        eventType: "feedback_teacher_grade_adjusted",
        courseId,
        groupId: context.groupId,
        activityId: context.activityId,
        groupActivityId: context.activity.assignment?.id ?? null,
        gradebookItemId: grading?.grade.gradebookItemId ?? null,
        attemptId: context.attemptId,
        actorUserId: user.id,
        pluginKey: context.activityTypeKey,
        feedbackRef: typeof revised.feedback.feedbackRef === "string" ? revised.feedback.feedbackRef : null,
        feedbackVersion: typeof revised.feedback.feedbackVersion === "number" ? revised.feedback.feedbackVersion : null,
        feedbackHash: revised.feedbackHash,
        aiContribution: typeof revisedAiWeightPercent === "number" ? revisedAiWeightPercent / 100 : null,
        assessmentMode: "summative",
        triggerKind: "teacher_feedback_review",
        outcome: "graded",
        metadata: {
          rawScore: revision.gradingResult.rawScore,
          rawMaxScore: revision.gradingResult.rawMaxScore,
          normalizedScore: grading?.grade.normalizedScore ?? null,
          normalizedMaxScore: grading?.grade.normalizedMaxScore ?? null
        }
      });
    }
    return json({ ...revised, grade: grading?.grade ?? null });
  });
}

export async function POST(request: NextRequest, { params }: Params) {
  return handleRoute(async () => {
    const user = await requireUser();
    const { courseId, attemptId } = await params;
    const body = generateSchema.parse(await readJson(request).catch(() => ({})));
    const triggerKind = body.triggerKind ?? "teacher_single";
    const context = await getActivityAttemptRegradeContext(user, courseId, attemptId);
    await recordAiFeedbackResearchEvent({
      eventType: "teacher_evaluation_started",
      courseId,
      groupId: context.groupId,
      activityId: context.activityId,
      groupActivityId: context.activity.assignment?.id ?? null,
      attemptId: context.attemptId,
      actorUserId: user.id,
      pluginKey: context.activityTypeKey,
      assessmentMode: "summative",
      triggerKind,
      outcome: "started"
    });
    if (context.activityTypeKey === "test") {
      const review = await getTestAttemptReview(user, courseId, attemptId);
      const evaluations = [];
      for (const item of review.items) {
        const evaluateChild = resolvePluginAiFeedbackHandler(item.activityTypeKey);
        if (!evaluateChild) continue;
        try {
          const evaluation = await evaluateChild({
            user,
            courseId: context.courseId,
            groupId: context.groupId,
            activityId: item.activityId,
            coreAttemptId: context.attemptId,
            pluginAttemptRef: item.itemAttempt.pluginAttemptRef,
            activity: item.activity,
            triggerKind: "test_child",
            testItemAttempt: {
              id: item.itemAttempt.id,
              parentAttemptId: context.attemptId,
              pluginAttemptRef: item.itemAttempt.pluginAttemptRef,
              state: item.itemAttempt.state
            }
          });
          await recordTestItemAiFeedback(user, courseId, attemptId, item.testItemId, {
            feedback: evaluation.feedback,
            feedbackRef: evaluation.feedbackRef,
            feedbackVersion: evaluation.feedbackVersion,
            feedbackHash: evaluation.feedbackHash,
            gradingResult: evaluation.gradingResult
          });
          evaluations.push({ testItemId: item.testItemId, evaluation });
        } catch (error) {
          if (error instanceof AppError && ["ACTIVITY_AI_FEEDBACK_DISABLED", "AI_FEEDBACK_DISABLED", "AI_FEEDBACK_MODEL_NOT_CONFIGURED"].includes(error.code)) {
            continue;
          }
          throw error;
        }
      }
      if (!evaluations.length) {
        throw new AppError(409, "TEST_AI_FEEDBACK_UNAVAILABLE", "No Test activity has effective AI feedback configuration.");
      }
      const result = await regradeTestAttempt(user, courseId, attemptId, "AI feedback evaluation");
      await recordAiFeedbackResearchEvent({
        eventType: "parent_grade_recomputed",
        courseId,
        groupId: context.groupId,
        activityId: context.activityId,
        groupActivityId: context.activity.assignment?.id ?? null,
        attemptId,
        actorUserId: user.id,
        pluginKey: "core-test-runtime",
        assessmentMode: "summative",
        triggerKind,
        outcome: "graded",
        metadata: { evaluatedChildCount: evaluations.length }
      });
      return json({ evaluations, result });
    }
    const evaluateAttempt = resolvePluginAiFeedbackHandler(context.activityTypeKey);
    if (!evaluateAttempt) {
      throw new AppError(409, "PLUGIN_AI_FEEDBACK_UNAVAILABLE", "This activity type does not support AI assessment feedback.");
    }
    const batchGuidance = triggerKind === "teacher_batch" && body.instructions !== undefined
      ? await resolveBatchGuidance({
          user,
          courseId,
          targetAttemptId: attemptId,
          targetActivityId: context.activityId,
          activityTypeKey: context.activityTypeKey,
          instructions: body.instructions,
          templateAttemptIds: body.templateAttemptIds ?? []
        })
      : undefined;
    const evaluation = await evaluateAttempt({
      user,
      courseId: context.courseId,
      groupId: context.groupId,
      activityId: context.activityId,
      coreAttemptId: context.attemptId,
      pluginAttemptRef: context.pluginAttemptRef,
      activity: context.activity,
      triggerKind,
      batchGuidance
    });
    const result = evaluation.gradingResult
      ? await recordActivityAttemptGradingResult(user, {
          attemptId: context.attemptId,
          rawScore: evaluation.gradingResult.rawScore,
          rawMaxScore: evaluation.gradingResult.rawMaxScore,
          source: context.lifecycle === "graded" ? "regrade" : "auto",
          isPass: evaluation.gradingResult.isPass,
          rawResult: {
            feedback: evaluation.feedback,
            analyticsPayload: evaluation.gradingResult.analyticsPayload ?? {}
          } as Prisma.InputJsonValue,
          normalizedResult: {
            ...(evaluation.gradingResult.metadata ?? {}),
            studentFeedback: {
              ...evaluation.feedback,
              feedbackRef: evaluation.feedbackRef,
              feedbackVersion: evaluation.feedbackVersion,
              feedbackHash: evaluation.feedbackHash,
              challengeAllowed: true
            }
          } as Prisma.InputJsonValue,
          metadata: {
            aiFeedbackRef: evaluation.feedbackRef,
            aiFeedbackVersion: evaluation.feedbackVersion
          }
        })
      : await recordActivityAttemptAiFeedback(user, courseId, {
          attemptId: context.attemptId,
          feedback: evaluation.feedback,
          feedbackRef: evaluation.feedbackRef,
          feedbackVersion: evaluation.feedbackVersion,
          feedbackHash: evaluation.feedbackHash
        });
    await recordAiFeedbackResearchEvent({
      eventType: "grade_feedback_recorded",
      courseId,
      groupId: context.groupId,
      activityId: context.activityId,
      groupActivityId: context.activity.assignment?.id ?? null,
      attemptId: context.attemptId,
      actorUserId: user.id,
      pluginKey: context.activityTypeKey,
      feedbackRef: evaluation.feedbackRef,
      feedbackVersion: evaluation.feedbackVersion,
      feedbackHash: evaluation.feedbackHash,
      assessmentMode: "summative",
      triggerKind,
      outcome: evaluation.gradingResult ? "graded" : "feedback_recorded"
    });
    return json({ evaluation, result });
  });
}

async function resolveBatchGuidance(input: {
  user: Awaited<ReturnType<typeof requireUser>>;
  courseId: string;
  targetAttemptId: string;
  targetActivityId: string;
  activityTypeKey: string;
  instructions: string;
  templateAttemptIds: string[];
}): Promise<PluginAiGradingBatchGuidance> {
  const batchGrading = resolvePluginAiGradingBatchHandler(input.activityTypeKey);
  const teacherReview = resolvePluginAiFeedbackTeacherReviewHandler(input.activityTypeKey);
  if (!batchGrading || !teacherReview) {
    throw new AppError(409, "PLUGIN_AI_BATCH_GRADING_UNAVAILABLE", "This activity type does not support guided batch AI grading.");
  }
  const uniqueTemplateIds = validateAiGradingTemplateAttemptIds(input.targetAttemptId, input.templateAttemptIds);
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
