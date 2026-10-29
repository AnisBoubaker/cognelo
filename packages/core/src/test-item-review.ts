import { resolvePluginAiFeedbackTeacherReviewHandler, type PluginAiFeedbackTeacherReviewContext } from "@cognelo/activity-sdk/server";
import type { CurrentUser, TestItemReviewInput, TestAttemptReviewInput } from "@cognelo/contracts";
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

async function saveTestItemReview(user: CurrentUser, courseId: string, parentAttemptId: string, testItemId: string,
  input: TestItemReviewInput, transaction?: Prisma.TransactionClient) {
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
  if (input.useRubricScore && (input.score !== undefined || !revision?.gradingResult)) {
    throw new AppError(400, "TEST_RUBRIC_GRADE_UNAVAILABLE", "Change a rubric score before returning this question to its calculated grade.");
  }
  // A new rubric-score edit can explicitly replace an older item override.
  const grading = input.score !== undefined ? { rawScore: input.score, rawMaxScore: item.pointsPossible }
    : review.manuallyGraded && !input.useRubricScore ? null : revision?.gradingResult ?? null;
  if (grading && (!Number.isFinite(grading.rawScore) || !Number.isFinite(grading.rawMaxScore) || grading.rawMaxScore <= 0
    || grading.rawScore < 0 || grading.rawScore > grading.rawMaxScore)) {
    throw new AppError(400, "TEST_ITEM_GRADING_RESULT_INVALID", "The activity returned an invalid score.");
  }

  const write = async (tx: Prisma.TransactionClient) => {
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
    const previousGrade = grading && !transaction ? await tx.grade.findUnique({ where: {
      gradebookItemId_participantId: { gradebookItemId: parent.gradebookItemId, participantId: parent.participantId }
    } }) : null;
    const nextFeedback = {
      ...record(current.feedback), ...(revised ? { aiFeedback: revised.nextFeedback } : {}),
      ...(input.feedbackText !== undefined ? { feedbackText: input.feedbackText } : {})
    };
    const nextResult = { ...record(current.result),
      ...(revised ? { aiFeedbackRef: revised.nextFeedback.feedbackRef, aiFeedbackVersion: revised.nextFeedback.feedbackVersion } : {}),
      ...(input.useRubricScore ? { manualGrading: null } : {}),
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
    // The batch owns the single aggregate update after every question is saved.
    if (transaction) return null;
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
  };
  const result = await (transaction ? write(transaction) : prisma.$transaction(write, { isolationLevel: "Serializable" })).catch(error => {
    if (["P2025", "P2034"].includes(String(record(error).code))) throw reviewConflict();
    throw error;
  });
  return { grade: result?.grade ?? null, gradingChanged: Boolean(grading) };
}

export async function saveTestItemTeacherReview(user: CurrentUser, courseId: string, parentAttemptId: string, testItemId: string,
  input: TestItemReviewInput) {
  const result = await saveTestItemReview(user, courseId, parentAttemptId, testItemId, input);
  return { review: await getTestItemTeacherReview(user, courseId, parentAttemptId, testItemId), grade: result.grade };
}

/** The saved grade version accompanies the attempt, so polling cannot silently replace a draft's baseline. */
export async function getTestAttemptTeacherReview(user: CurrentUser, courseId: string, parentAttemptId: string) {
  const review = await getTestAttemptReview(user, courseId, parentAttemptId);
  const grade = await prisma.grade.findUnique({ where: { gradebookItemId_participantId: {
    gradebookItemId: review.gradebookItemId, participantId: review.participantId
  } } });
  return { ...review, readOnly: (await latestSubmittedAttempt(review))?.id !== review.id,
    feedbackText: review.feedbackText ?? String(record(record(grade?.normalizedResult).studentFeedback).feedbackText ?? ""),
    grade: grade?.isActive ? { score: grade.normalizedScore, maxScore: grade.normalizedMaxScore,
      source: grade.source, updatedAt: grade.updatedAt.toISOString() } : null,
    gradeUpdatedAt: grade?.updatedAt.toISOString() ?? null };
}

/** Save the whole review atomically, without executing answers or contacting AI. */
export async function saveTestAttemptTeacherReview(user: CurrentUser, courseId: string, parentAttemptId: string,
  input: TestAttemptReviewInput) {
  const parent = await getTestAttemptReview(user, courseId, parentAttemptId);
  if (parent.updatedAt !== input.expectedUpdatedAt) throw reviewConflict();
  if ((await latestSubmittedAttempt(parent))?.id !== parent.id) {
    throw new AppError(409, "TEST_REVIEW_READ_ONLY", "Only the latest submitted Test attempt can be edited.");
  }
  const itemIds = input.items.map(item => item.testItemId);
  if (itemIds.length > 100 || new Set(itemIds).size !== itemIds.length || (!itemIds.length && !input.total && input.feedbackText === undefined)) {
    throw new AppError(400, "TEST_REVIEW_ITEMS_INVALID", "Supply distinct questions or a Test total change.");
  }
  if (itemIds.some(id => !parent.items.some(item => item.testItemId === id))) throw notFound("Test item attempt");
  if (input.total?.mode === "override" && (!Number.isFinite(input.total.score) || input.total.score < 0)) {
    throw new AppError(400, "TEST_ITEM_SCORE_OUT_OF_RANGE", "The Test total must be a nonnegative score.");
  }

  await prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "ActivityAttempt" WHERE id = ${parent.id} FOR UPDATE`;
    const current = await tx.activityAttempt.findUnique({ where: { id: parent.id } });
    if (!current || current.updatedAt.toISOString() !== input.expectedUpdatedAt || !["submitted", "graded"].includes(current.lifecycle)) throw reviewConflict();
    if ((await latestSubmittedAttempt(parent, tx))?.id !== parent.id) throw reviewConflict();
    const claim = await tx.testSubmissionClaim.findUnique({ where: { parentAttemptId } });
    if (claim?.status === "processing" && claim.updatedAt.getTime() > Date.now() - 30 * 60_000) {
      throw new AppError(409, "TEST_SUBMISSION_IN_PROGRESS", "This Test is being graded. Wait before saving the review.");
    }
    const previousGrade = await tx.grade.findUnique({ where: { gradebookItemId_participantId: {
      gradebookItemId: parent.gradebookItemId, participantId: parent.participantId
    } } });
    if ((previousGrade?.updatedAt.toISOString() ?? null) !== input.expectedGradeUpdatedAt) throw reviewConflict();

    let gradingChanged = false;
    for (const item of input.items) {
      const saved = await saveTestItemReview(user, courseId, parentAttemptId, item.testItemId,
        { ...item, reason: input.reason ?? item.reason }, tx);
      gradingChanged ||= saved.gradingChanged;
    }
    if (gradingChanged || input.total?.mode === "calculated") {
      try {
        await recalculateTestAttemptGrade(user, courseId, parent.id, input.reason ?? "Teacher Test review", tx);
      } catch (error) {
        // Partial reviews can be saved without inventing grades for unanswered grading work.
        if (!(error instanceof AppError && error.code === "TEST_ITEMS_NOT_GRADED")) throw error;
        if (previousGrade?.isActive && previousGrade.source === "override" && input.total?.mode !== "override") {
          throw new AppError(409, "TEST_ITEMS_NOT_GRADED", "Grade every question before replacing the manual Test total with its calculated score.");
        }
      }
    } else {
      await refreshTestAttemptFeedback(user, courseId, parent.id, tx);
    }
    if (input.total?.mode === "override") {
      const previousFeedback = record(record(previousGrade?.normalizedResult).studentFeedback);
      await overrideGradebookGrade(user, courseId, {
        gradebookItemId: parent.gradebookItemId, participantId: parent.participantId,
        score: input.total.score, reason: input.reason ?? "Teacher Test total override",
        ...(typeof previousFeedback.feedbackText === "string" ? { feedbackText: previousFeedback.feedbackText } : {})
      }, tx);
    }
    const priorComment = parent.feedbackText ?? record(record(previousGrade?.normalizedResult).studentFeedback).feedbackText;
    const nextComment = input.feedbackText ?? (typeof priorComment === "string" ? priorComment : undefined);
    if (nextComment !== undefined && (input.feedbackText !== undefined || parent.feedbackText === null)) {
      await saveTestReviewComment(tx, user, courseId, parent, nextComment, typeof priorComment === "string" ? priorComment : "");
    }
  }, { isolationLevel: "Serializable", timeout: 30_000 }).catch(error => {
    if (["P2025", "P2034"].includes(String(record(error).code))) throw reviewConflict();
    throw error;
  });
  return {
    review: await getTestAttemptTeacherReview(user, courseId, parentAttemptId),
    items: await Promise.all(input.items.map(item => getTestItemTeacherReview(user, courseId, parentAttemptId, item.testItemId)))
  };
}

async function saveTestReviewComment(tx: Prisma.TransactionClient, user: CurrentUser, courseId: string,
  parent: Awaited<ReturnType<typeof getTestAttemptReview>>, feedbackText: string, previousText: string) {
  const current = await tx.activityAttempt.findUnique({ where: { id: parent.id } });
  if (!current) throw reviewConflict();
  await tx.activityAttempt.update({ where: { id: parent.id, updatedAt: current.updatedAt },
    data: { metadata: { ...record(current.metadata), testReviewFeedbackText: feedbackText } as Prisma.InputJsonValue } });
  const grade = await tx.grade.findUnique({ where: { gradebookItemId_participantId: {
    gradebookItemId: parent.gradebookItemId, participantId: parent.participantId
  } } });
  if (grade?.isActive && (grade.selectedAttemptId === parent.id || grade.source === "override")) {
    const normalized = record(grade.normalizedResult);
    await tx.grade.update({ where: { id: grade.id, updatedAt: grade.updatedAt }, data: {
      normalizedResult: { ...normalized, studentFeedback: { ...record(normalized.studentFeedback), feedbackText } } as Prisma.InputJsonValue
    } });
  }
  await tx.courseAuditEvent.create({ data: { courseId, actorUserId: user.id, eventType: "test_review_comment_updated",
    targetType: "ActivityAttempt", targetId: parent.id, previousValue: { feedbackText: previousText }, nextValue: { feedbackText } } });
}

function reviewConflict() {
  return new AppError(409, "TEST_REVIEW_CONFLICT", "This submission or rubric changed. Reload the latest review before saving again.");
}
