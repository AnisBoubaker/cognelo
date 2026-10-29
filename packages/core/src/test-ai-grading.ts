import type { CurrentUser } from "@cognelo/contracts";
import { resolvePluginAiFeedbackTeacherReviewHandler, resolvePluginAiGradingBatchHandler,
  type PluginAiFeedbackTeacherReviewContext, type PluginAiGradingBatchGuidance } from "@cognelo/activity-sdk/server";
import { AppError } from "./errors";
import { getActivityAttemptRegradeContext, getActivityAttemptRegradeContexts } from "./gradebook";
import { getTeacherAttemptAiFeedbackReview, hashAiFeedbackValue } from "./ai-feedback";
import { getTestAttemptReview } from "./test-execution";

type TestReview = Awaited<ReturnType<typeof getTestAttemptReview>>;
type Item = TestReview["items"][number];
const record = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value)
  ? value as Record<string, unknown> : {};

function childContext(user: CurrentUser, courseId: string, review: TestReview, item: Item): PluginAiFeedbackTeacherReviewContext {
  return { user, courseId, groupId: review.groupId, activityId: item.activityId, coreAttemptId: review.id,
    pluginAttemptRef: item.itemAttempt.pluginAttemptRef, activity: item.activity,
    testItemAttempt: { id: item.itemAttempt.id, parentAttemptId: review.id,
      pluginAttemptRef: item.itemAttempt.pluginAttemptRef, state: item.itemAttempt.state } };
}

async function completeTemplateQuestion(user: CurrentUser, courseId: string, review: TestReview, item: Item) {
  const batch = resolvePluginAiGradingBatchHandler(item.activityTypeKey);
  const teacher = resolvePluginAiFeedbackTeacherReviewHandler(item.activityTypeKey);
  if (!batch || !teacher || item.itemAttempt.lifecycle !== "graded") return null;
  const feedback = record(item.itemAttempt.feedback.aiFeedback);
  const context = childContext(user, courseId, review, item);
  return await batch.isTemplateComplete({ ...context, feedback }) ? { context, feedback, teacher } : null;
}

export async function prepareTestAiGradingTemplates(user: CurrentUser, courseId: string, activityId: string, attemptIds: readonly string[]) {
  const contexts = await getActivityAttemptRegradeContexts(user, courseId, [...new Set(attemptIds)]);
  const templates: Array<{ attemptId: string; participantName: string; attemptNumber: number; questionCount: number }> = [];
  for (const context of contexts) {
    if (context.activityId !== activityId || context.activityTypeKey !== "test") {
      throw new AppError(400, "AI_BATCH_ATTEMPT_ACTIVITY_MISMATCH", "Every template must belong to this Test.");
    }
    if (context.lifecycle !== "graded") continue;
    const review = await getTestAttemptReview(user, courseId, context.attemptId);
    let questionCount = 0;
    for (const item of review.items) if (await completeTemplateQuestion(user, courseId, review, item)) questionCount++;
    if (!questionCount) continue;
    const owner = await getTeacherAttemptAiFeedbackReview(user, courseId, context.attemptId);
    templates.push({ attemptId: context.attemptId, participantName: owner.participant.name,
      attemptNumber: context.attemptNumber, questionCount });
  }
  return { available: true, instructions: null, templates };
}

/** Revalidate selected examples before evaluating any target question; question identity, never display order, controls matching. */
export async function resolveTestAiGradingGuidance(user: CurrentUser, courseId: string, targetAttemptId: string, templateAttemptIds: readonly string[]) {
  if (templateAttemptIds.length > 3 || new Set(templateAttemptIds).size !== templateAttemptIds.length) {
    throw new AppError(400, "AI_BATCH_TEMPLATE_INVALID", "Select at most three distinct grading templates.");
  }
  if (templateAttemptIds.includes(targetAttemptId)) {
    throw new AppError(400, "AI_BATCH_TEMPLATE_TARGET_MATCH", "A selected template cannot be reassessed in the same batch.");
  }
  const target = await getActivityAttemptRegradeContext(user, courseId, targetAttemptId);
  if (target.activityTypeKey !== "test" || !["submitted", "graded"].includes(target.lifecycle)) {
    throw new AppError(409, "TEST_ATTEMPT_REQUIRED", "A submitted Test attempt is required.");
  }
  const review = await getTestAttemptReview(user, courseId, targetAttemptId);
  const guidance = new Map<string, PluginAiGradingBatchGuidance>();
  for (const templateId of templateAttemptIds) {
    const context = await getActivityAttemptRegradeContext(user, courseId, templateId);
    if (context.activityId !== target.activityId || context.activityTypeKey !== "test" || context.lifecycle !== "graded") {
      throw new AppError(400, "AI_BATCH_TEMPLATE_INVALID", "Every template must be a graded submission of this Test.");
    }
    const template = await getTestAttemptReview(user, courseId, templateId);
    let matches = 0;
    for (const item of review.items) {
      const candidate = template.items.find(entry => entry.testItemId === item.testItemId
        && entry.activityId === item.activityId && entry.activityTypeKey === item.activityTypeKey);
      if (!candidate) continue;
      if (hashAiFeedbackValue({ description: candidate.activity.description, config: candidate.activity.config })
        !== hashAiFeedbackValue({ description: item.activity.description, config: item.activity.config })) continue;
      const complete = await completeTemplateQuestion(user, courseId, template, candidate);
      if (!complete) continue;
      const example = { coreAttemptId: templateId, feedback: complete.feedback,
        submission: await complete.teacher.getSubmission(complete.context) };
      const previous = guidance.get(item.testItemId)?.templates ?? [];
      guidance.set(item.testItemId, { templates: [...previous, example] });
      matches++;
    }
    if (!matches) throw new AppError(400, "AI_BATCH_TEMPLATE_INCOMPLETE", "A selected Test has no matching question with complete grading feedback.");
  }
  return { review, guidance };
}
