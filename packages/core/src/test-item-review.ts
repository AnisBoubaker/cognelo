import { resolvePluginAiFeedbackTeacherReviewHandler, type PluginAiFeedbackTeacherReviewContext } from "@cognelo/activity-sdk/server";
import type { CurrentUser } from "@cognelo/contracts";
import { prisma, type Prisma } from "@cognelo/db";
import { buildTeacherFeedbackRevision, hashAiFeedbackValue } from "./ai-feedback";
import { AppError, notFound } from "./errors";
import { getTestAttemptReview, recalculateTestAttemptGrade, refreshTestAttemptFeedback } from "./test-execution";
import { overrideGradebookGrade } from "./gradebook";

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function latestSubmittedAttempt(parent: { gradebookItemId: string; participantId: string }, database: Pick<typeof prisma, "activityAttempt"> = prisma) {
  return database.activityAttempt.findFirst({
    where: { gradebookItemId: parent.gradebookItemId, participantId: parent.participantId,
      assessmentMode: "summative", lifecycle: { in: ["submitted", "graded"] } },
    orderBy: { attemptNumber: "desc" }, select: { id: true }
  });
}

async function loadReview(user: CurrentUser, courseId: string, parentAttemptId: string, testItemId: string) {
  const parent = await getTestAttemptReview(user, courseId, parentAttemptId, testItemId);
  const item = parent.items.find(candidate => candidate.testItemId === testItemId);
  if (!item) throw notFound("Test item attempt");
  const latest = await latestSubmittedAttempt(parent);
  const handler = resolvePluginAiFeedbackTeacherReviewHandler(item.activityTypeKey);
  const context: PluginAiFeedbackTeacherReviewContext = {
    user, courseId, groupId: parent.groupId, activityId: item.activityId, coreAttemptId: parent.id,
    pluginAttemptRef: item.itemAttempt.pluginAttemptRef, activity: item.activity,
    testItemAttempt: { id: item.itemAttempt.id, parentAttemptId: parent.id,
      pluginAttemptRef: item.itemAttempt.pluginAttemptRef, state: item.itemAttempt.state }
  };
  const stored = record(item.itemAttempt.feedback.aiFeedback);
  const hasFeedback = typeof stored.feedbackRef === "string" && typeof stored.feedbackVersion === "number";
  const [submission, feedback] = handler ? await Promise.all([
    handler.getSubmission(context), hasFeedback ? stored : handler.createFeedbackDraft(context)
  ]) : [null, null];
  return { parent, item, handler, context, hasFeedback, review: {
    testItemId, activityTypeKey: item.activityTypeKey, submission, feedback,
    feedbackHash: feedback ? hashAiFeedbackValue(feedback) : null,
    feedbackText: typeof item.itemAttempt.feedback.feedbackText === "string" ? item.itemAttempt.feedback.feedbackText : "",
    score: item.itemAttempt.normalizedScore, maxScore: item.pointsPossible,
    manuallyGraded: item.itemAttempt.manuallyGraded, updatedAt: item.itemAttempt.updatedAt,
    gradesReleased: parent.gradesReleased, readOnly: latest?.id !== parent.id
  } };
}

export async function getTestItemTeacherReview(user: CurrentUser, courseId: string, parentAttemptId: string, testItemId: string) {
  return (await loadReview(user, courseId, parentAttemptId, testItemId)).review;
}

export async function saveTestItemTeacherReview(user: CurrentUser, courseId: string, parentAttemptId: string, testItemId: string, input: {
  expectedUpdatedAt: string;
  expectedFeedbackHash: string | null;
  feedback?: unknown;
  feedbackText?: string;
  score?: number;
  reason?: string | null;
}) {
  const { parent, item, handler, context, hasFeedback, review } = await loadReview(user, courseId, parentAttemptId, testItemId);
  if (review.readOnly) throw new AppError(409, "TEST_REVIEW_READ_ONLY", "Only the latest submitted Test attempt can be edited.");
  if (review.updatedAt !== input.expectedUpdatedAt || review.feedbackHash !== input.expectedFeedbackHash) throw reviewConflict();
  if (input.score !== undefined && (!Number.isFinite(input.score) || input.score < 0 || input.score > item.pointsPossible)) {
    throw new AppError(400, "TEST_ITEM_SCORE_OUT_OF_RANGE", `Score must be between zero and ${item.pointsPossible}.`);
  }
  if (input.feedback !== undefined && !handler) throw new AppError(400, "PLUGIN_AI_FEEDBACK_REVIEW_UNAVAILABLE", "This activity does not support structured feedback.");
  const revision = handler && input.feedback !== undefined && review.feedback
    ? await handler.reviseFeedback({ ...context, currentFeedback: review.feedback, feedback: input.feedback }) : null;
  const now = new Date();
  const currentFeedback = review.feedback ?? {};
  const revised = revision ? buildTeacherFeedbackRevision({
    currentFeedback, revisedFeedback: revision.feedback, hasCurrentFeedback: hasFeedback, now,
    feedbackRef: hasFeedback ? String(currentFeedback.feedbackRef) : `teacher-feedback:${item.itemAttempt.id}`,
    feedbackVersion: hasFeedback ? Number(currentFeedback.feedbackVersion) : 1
  }) : null;
  // A teacher's explicit item override survives later rubric/narrative edits.
  const grading = input.score !== undefined ? { rawScore: input.score, rawMaxScore: item.pointsPossible }
    : review.manuallyGraded ? null : revision?.gradingResult ?? null;
  if (grading && (!Number.isFinite(grading.rawScore) || !Number.isFinite(grading.rawMaxScore) || grading.rawMaxScore <= 0
    || grading.rawScore < 0 || grading.rawScore > grading.rawMaxScore)) {
    throw new AppError(400, "TEST_ITEM_GRADING_RESULT_INVALID", "The activity returned an invalid score.");
  }

  const result = await prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "ActivityAttempt" WHERE id = ${parent.id} FOR UPDATE`;
    const claim = await tx.testSubmissionClaim.findUnique({ where: { parentAttemptId } });
    if (claim?.status === "processing" && claim.updatedAt.getTime() > now.getTime() - 30 * 60_000) {
      throw new AppError(409, "TEST_SUBMISSION_IN_PROGRESS", "This Test is being graded. Wait for it to finish before saving the review.");
    }
    const currentParent = await tx.activityAttempt.findUnique({ where: { id: parent.id } });
    if (!currentParent || currentParent.updatedAt.toISOString() !== parent.updatedAt
      || !["submitted", "graded"].includes(currentParent.lifecycle)) throw reviewConflict();
    if ((await latestSubmittedAttempt(parent, tx))?.id !== parent.id) throw reviewConflict();
    const current = await tx.testItemAttempt.findUnique({ where: { id: item.itemAttempt.id } });
    if (!current || current.updatedAt.toISOString() !== input.expectedUpdatedAt) throw reviewConflict();
    const previousGrade = grading ? await tx.grade.findUnique({ where: {
      gradebookItemId_participantId: { gradebookItemId: parent.gradebookItemId, participantId: parent.participantId }
    } }) : null;
    const nextFeedback = {
      ...record(current.feedback), ...(revised ? { aiFeedback: revised.nextFeedback } : {}),
      ...(input.feedbackText !== undefined ? { feedbackText: input.feedbackText } : {})
    };
    const nextResult = { ...record(current.result),
      ...(revised ? { aiFeedbackRef: revised.nextFeedback.feedbackRef, aiFeedbackVersion: revised.nextFeedback.feedbackVersion } : {}),
      ...(input.score !== undefined ? { manualGrading: { score: input.score, pointsPossible: item.pointsPossible,
        graderUserId: user.id, reason: input.reason ?? null, gradedAt: now.toISOString() } } : {})
    };
    const updated = await tx.testItemAttempt.update({
      where: { id: current.id, updatedAt: current.updatedAt },
      data: { feedback: nextFeedback as Prisma.InputJsonValue, result: nextResult as Prisma.InputJsonValue,
        ...(grading ? { lifecycle: "graded", gradedAt: now, rawScore: grading.rawScore, rawMaxScore: grading.rawMaxScore,
          normalizedScore: grading.rawScore / grading.rawMaxScore * item.pointsPossible, normalizedMaxScore: item.pointsPossible } : {}) }
    });
    const snapshot = (value: typeof current) => ({ feedback: value.feedback, rawScore: value.rawScore,
      rawMaxScore: value.rawMaxScore, normalizedScore: value.normalizedScore, normalizedMaxScore: value.normalizedMaxScore,
      manualGrading: record(value.result).manualGrading ?? null });
    await tx.courseAuditEvent.create({ data: { courseId, actorUserId: user.id, eventType: "test_item_reviewed",
      targetType: "TestItemAttempt", targetId: current.id, previousValue: snapshot(current) as Prisma.InputJsonValue,
      nextValue: snapshot(updated) as Prisma.InputJsonValue, metadata: { parentAttemptId, testItemId, reason: input.reason ?? null } } });
    if (revised) {
      const challenge = await tx.gradeChallenge.findFirst({ where: { attemptId: parent.id,
        OR: [{ feedbackRef: revised.nextFeedback.feedbackRef }, { feedbackRef: { startsWith: "grade:" } }] }, select: { id: true }, orderBy: { createdAt: "desc" } });
      await tx.aiFeedbackResearchEvent.create({ data: {
        courseId, groupId: parent.groupId, activityId: item.activityId, gradebookItemId: parent.gradebookItemId,
        participantId: parent.participantId, userId: parent.userId, attemptId: parent.id, actorUserId: user.id,
        pluginKey: item.activityTypeKey, eventType: hasFeedback ? "feedback_teacher_revised" : "feedback_teacher_authored",
        feedbackRef: revised.nextFeedback.feedbackRef, feedbackVersion: revised.nextFeedback.feedbackVersion,
        feedbackHash: revised.feedbackHash, assessmentMode: "summative", triggerKind: "teacher_feedback_review", outcome: "saved",
        metadata: { testItemId, testItemAttemptId: current.id, previousFeedbackHash: revised.previousFeedbackHash,
          teacherRevision: revised.teacherRevision, gradesReleased: parent.gradesReleased,
          ...(challenge ? { gradeChallengeId: challenge.id } : {}) }
      } });
    }
    if (!grading) return { grade: await refreshTestAttemptFeedback(user, courseId, parent.id, tx) };
    try {
      const result = await recalculateTestAttemptGrade(user, courseId, parent.id, input.reason ?? "Teacher Test review", tx);
      if (previousGrade?.isActive && previousGrade.source === "override") {
        const previousFeedback = record(record(previousGrade.normalizedResult).studentFeedback);
        const grade = await overrideGradebookGrade(user, courseId, {
          gradebookItemId: parent.gradebookItemId, participantId: parent.participantId,
          score: previousGrade.normalizedScore, maxScore: previousGrade.normalizedMaxScore,
          reason: "Preserve the teacher's Test total while reviewing an activity",
          ...(typeof previousFeedback.feedbackText === "string" ? { feedbackText: previousFeedback.feedbackText } : {})
        }, tx);
        return { ...result, grade };
      }
      return result;
    } catch (error) {
      // Preserve a reviewed child while other children still await grading.
      if (error instanceof AppError && error.code === "TEST_ITEMS_NOT_GRADED") return null;
      throw error;
    }
  }, { isolationLevel: "Serializable" }).catch(error => {
    if (["P2025", "P2034"].includes(String(record(error).code))) throw reviewConflict();
    throw error;
  });
  return { review: await getTestItemTeacherReview(user, courseId, parentAttemptId, testItemId), grade: result?.grade ?? null };
}

function reviewConflict() {
  return new AppError(409, "TEST_REVIEW_CONFLICT", "This submission or rubric changed. Reload the latest review before saving again.");
}
