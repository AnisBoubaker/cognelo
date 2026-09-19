import { NextRequest } from "next/server";
import { resolvePluginAiFeedbackHandler, resolvePluginAiFeedbackTeacherReviewHandler } from "@cognelo/activity-sdk/server";
import { AppError, getActivityAttemptRegradeContext, getTeacherAttemptAiFeedbackReview, getTestAttemptReview, recordActivityAttemptAiFeedback, recordActivityAttemptGradingResult, recordAiFeedbackResearchEvent, recordTestItemAiFeedback, regradeTestAttempt, reviseTeacherAttemptAiFeedback } from "@cognelo/core";
import type { Prisma } from "@cognelo/db";
import { handleRoute, json, options, readJson, requireUser } from "@/lib/http";

type Params = { params: Promise<{ courseId: string; attemptId: string }> };

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
    const [review, submission] = await Promise.all([
      getTeacherAttemptAiFeedbackReview(user, courseId, attemptId),
      teacherReview.getSubmission({
        user,
        courseId: context.courseId,
        groupId: context.groupId,
        activityId: context.activityId,
        coreAttemptId: context.attemptId,
        pluginAttemptRef: context.pluginAttemptRef,
        activity: context.activity
      })
    ]);
    return json({ review: { ...review, activityTypeKey: context.activityTypeKey, submission } });
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
    const current = await getTeacherAttemptAiFeedbackReview(user, courseId, attemptId);
    const feedback = await teacherReview.reviseFeedback({
      user,
      courseId: context.courseId,
      groupId: context.groupId,
      activityId: context.activityId,
      coreAttemptId: context.attemptId,
      pluginAttemptRef: context.pluginAttemptRef,
      activity: context.activity,
      currentFeedback: current.feedback,
      feedback: body.feedback
    });
    return json(await reviseTeacherAttemptAiFeedback(user, courseId, attemptId, feedback));
  });
}

export async function POST(request: NextRequest, { params }: Params) {
  return handleRoute(async () => {
    const user = await requireUser();
    const { courseId, attemptId } = await params;
    const body = await readJson(request).catch(() => ({})) as { triggerKind?: unknown };
    const triggerKind = body.triggerKind === "teacher_batch" || body.triggerKind === "teacher_selection" ? body.triggerKind : "teacher_single";
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
    const evaluation = await evaluateAttempt({
      user,
      courseId: context.courseId,
      groupId: context.groupId,
      activityId: context.activityId,
      coreAttemptId: context.attemptId,
      pluginAttemptRef: context.pluginAttemptRef,
      activity: context.activity,
      triggerKind
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
