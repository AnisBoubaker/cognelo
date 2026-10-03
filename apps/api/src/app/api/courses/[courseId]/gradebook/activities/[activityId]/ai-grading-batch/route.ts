import { NextRequest } from "next/server";
import {
  resolvePluginAiFeedbackTeacherReviewHandler,
  resolvePluginAiGradingBatchHandler,
  type PluginAiFeedbackTeacherReviewContext
} from "@cognelo/activity-sdk/server";
import { AppError, getActivityAttemptRegradeContext, getActivityAttemptRegradeContexts, getTeacherAttemptAiFeedbackReview } from "@cognelo/core";
import { z } from "zod";
import { handleRoute, json, options, readJson, requireUser } from "@/lib/http";

type Params = { params: Promise<{ courseId: string; activityId: string }> };

const prepareSchema = z.object({
  attemptIds: z.array(z.string().min(1)).min(1).max(1000)
}).strict();

const updateSchema = z.object({
  attemptId: z.string().min(1),
  instructions: z.string().trim().min(1).max(8000)
}).strict();

export function OPTIONS() {
  return options();
}

export async function POST(request: NextRequest, { params }: Params) {
  return handleRoute(async () => {
    const user = await requireUser();
    const { courseId, activityId } = await params;
    const body = prepareSchema.parse(await readJson(request));
    const attemptIds = [...new Set(body.attemptIds)];
    const contexts = await getActivityAttemptRegradeContexts(user, courseId, attemptIds);
    contexts.forEach((context) => assertActivityMatches(context.activityId, activityId));
    const first = contexts[0];
    const batchGrading = resolvePluginAiGradingBatchHandler(first.activityTypeKey);
    const teacherReview = resolvePluginAiFeedbackTeacherReviewHandler(first.activityTypeKey);
    if (!batchGrading || !teacherReview) {
      return json({ available: false, instructions: "", templates: [] });
    }

    const instructions = await batchGrading.getInstructions(toReviewContext(user, first));
    const templates = (await Promise.all(contexts.map(async (context) => {
      if (context.activityTypeKey !== first.activityTypeKey || !isSubmittedAttempt(context.lifecycle)) return null;
      const review = await getTeacherAttemptAiFeedbackReview(user, courseId, context.attemptId);
      if (!review.feedback) return null;
      const complete = await batchGrading.isTemplateComplete({
        ...toReviewContext(user, context),
        feedback: review.feedback
      });
      return complete ? {
        attemptId: context.attemptId,
        participantName: review.participant.name,
        attemptNumber: context.attemptNumber
      } : null;
    }))).filter((candidate): candidate is { attemptId: string; participantName: string; attemptNumber: number } => candidate !== null);

    return json({ available: true, instructions, templates });
  });
}

export async function PATCH(request: NextRequest, { params }: Params) {
  return handleRoute(async () => {
    const user = await requireUser();
    const { courseId, activityId } = await params;
    const body = updateSchema.parse(await readJson(request));
    const context = await getActivityAttemptRegradeContext(user, courseId, body.attemptId);
    assertActivityMatches(context.activityId, activityId);
    const batchGrading = resolvePluginAiGradingBatchHandler(context.activityTypeKey);
    if (!batchGrading) {
      throw new AppError(409, "PLUGIN_AI_BATCH_GRADING_UNAVAILABLE", "This activity type does not provide batch AI grading settings.");
    }
    await batchGrading.updateInstructions({
      ...toReviewContext(user, context),
      instructions: body.instructions
    });
    return json({ updated: true });
  });
}

function assertActivityMatches(actualActivityId: string, expectedActivityId: string) {
  if (actualActivityId !== expectedActivityId) {
    throw new AppError(400, "AI_BATCH_ATTEMPT_ACTIVITY_MISMATCH", "Every batch attempt must belong to the selected activity.");
  }
}

function isSubmittedAttempt(lifecycle: string) {
  return lifecycle === "submitted" || lifecycle === "graded";
}

function toReviewContext(
  user: Awaited<ReturnType<typeof requireUser>>,
  context: Awaited<ReturnType<typeof getActivityAttemptRegradeContext>>
): PluginAiFeedbackTeacherReviewContext {
  return {
    user,
    courseId: context.courseId,
    groupId: context.groupId,
    activityId: context.activityId,
    coreAttemptId: context.attemptId,
    pluginAttemptRef: context.pluginAttemptRef,
    activity: context.activity
  };
}
