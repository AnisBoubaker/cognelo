import { applyAssignmentExceptions, exceptionsForParticipant, loadAssignmentExceptions } from "./activity-assignment-exceptions";
import { lockTestAuthoring } from "./activity-authoring-live";
import { createHash } from "node:crypto";
import { getActivityDefinition, type ActivityGradingResult } from "@cognelo/activity-sdk";
import { resolveCompositeExecutionSubmissionHandler } from "@cognelo/activity-sdk/server";
import type { CurrentUser } from "@cognelo/contracts";
import { Prisma, prisma } from "@cognelo/db";
import { AppError, forbidden, notFound } from "./errors";
import {
  getActivityAttemptAvailability,
  getActivityAttemptRegradeContext,
  recordActivityAttemptGradingResult,
  startActivityAttempt,
  submitActivityAttempt
} from "./gradebook";
import { assignmentAttemptExpiresAt, assignmentTimeLimitMinutes } from "./activity-assignment-policy";
import { getGroupAssignedActivity } from "./groups";
import { extractMediaAssetIds, reconcileMediaAssetReferences } from "./media-assets";
import { assertActivityTypePluginEnabled } from "./plugins";

const CORE_TEST_RUNTIME_KEY = "core:test";
const CORE_TEST_RUNTIME_VERSION = "0.1.0";

const runtimeTestInclude = {
  activity: { include: { activityType: true } },
  items: {
    include: { activity: { include: { activityType: true } } },
    orderBy: [{ position: "asc" as const }, { createdAt: "asc" as const }]
  }
};

type RuntimeView = "attempt" | "previous";

export async function getTestRuntime(
  user: CurrentUser,
  courseId: string,
  groupId: string,
  testActivityId: string,
  view: RuntimeView = "attempt",
  sessionId?: string | null
) {
  const context = await resolveTestRuntimeContext(user, courseId, groupId, testActivityId);
  const attempts = await prisma.activityAttempt.findMany({
    where: {
      courseId,
      groupId,
      activityId: testActivityId,
      participantId: context.participant.id,
      pluginKey: CORE_TEST_RUNTIME_KEY,
      lifecycle: { not: "deleted" }
    },
    include: { testItemAttempts: true, testRevision: { include: { items: true } } },
    orderBy: [{ attemptNumber: "desc" }]
  });
  const attempt = view === "previous"
    ? attempts.find((candidate) => candidate.lifecycle === "submitted" || candidate.lifecycle === "graded") ?? null
    : attempts.find((candidate) => candidate.lifecycle === "started") ?? null;
  const availability = await getActivityAttemptAvailability(user, { courseId, groupId, activityId: testActivityId });

  return buildTestRuntime(context, attempt, availability, attempts.some((candidate) =>
    candidate.lifecycle === "submitted" || candidate.lifecycle === "graded"
  ), sessionId);
}

export async function startOrResumeTestAttempt(
  user: CurrentUser,
  courseId: string,
  groupId: string,
  testActivityId: string,
  sessionId?: string | null
) {
  const context = await resolveTestRuntimeContext(user, courseId, groupId, testActivityId);
  assertCompositeItemsSupported(activeRuntimeItems(context.test.items));
  const existing = await prisma.activityAttempt.findFirst({
    where: {
      courseId,
      groupId,
      activityId: testActivityId,
      participantId: context.participant.id,
      pluginKey: CORE_TEST_RUNTIME_KEY,
      lifecycle: "started"
    },
    orderBy: [{ attemptNumber: "desc" }]
  });
  if (!existing) {
    const revision = await ensureCurrentTestRevision(context);
    const attemptSettings = withAssignmentTimeLimit(revision.settings, context.assignedActivity.assignment.metadata);
    const revisionItems = orderManifestItems(revision.items, asRecord(attemptSettings).randomizeItems === true);
    const manifest = {
      testId: context.test.id,
      sessionId: sessionId ?? null,
      testRevisionId: revision.id,
      revisionNumber: revision.revisionNumber,
      settings: attemptSettings,
      items: revisionItems.map((item) => ({
        testItemId: item.sourceTestItemId,
        activityId: item.sourceActivityId,
        activityTypeKey: item.activityTypeKey,
        title: item.title,
        position: item.position,
        pointsPossible: item.pointsPossible,
        isRequired: item.isRequired,
        activityConfigFingerprint: item.activityFingerprint
      }))
    };
    await startActivityAttempt(user, {
      courseId,
      groupId,
      activityId: testActivityId,
      pluginKey: CORE_TEST_RUNTIME_KEY,
      pluginVersion: CORE_TEST_RUNTIME_VERSION,
      testRevisionId: revision.id,
      activityConfigFingerprint: fingerprint(manifest),
      metadata: { runtimeHandlerKey: CORE_TEST_RUNTIME_KEY, manifest } as Prisma.InputJsonValue
    });
  }
  return getTestRuntime(user, courseId, groupId, testActivityId, "attempt", sessionId);
}

export async function getTestItemExecutionContext(
  user: CurrentUser,
  courseId: string,
  groupId: string,
  testActivityId: string,
  parentAttemptId: string,
  testItemId: string,
  options: {
    allowCompletedParent?: boolean;
    allowExpiredParent?: boolean;
    allowResumePolicyBypass?: boolean;
    sessionId?: string | null;
  } = {}
) {
  const context = await resolveTestRuntimeContext(user, courseId, groupId, testActivityId);
  const parentAttempt = await findParentAttempt(
    context.participant.id,
    testActivityId,
    parentAttemptId,
    options.allowCompletedParent === true
  );
  if (!options.allowExpiredParent) assertTestAttemptWithinTime(parentAttempt, context.assignedActivity.assignment);
  if (!options.allowResumePolicyBypass) assertTestAttemptResumePolicy(parentAttempt, options.sessionId, context.test.settings);
  const item = context.test.items.find((candidate) => candidate.id === testItemId);
  if (!item || (parentAttempt.lifecycle === "started" ? item.removedAt !== null && item.removedAt !== undefined : !manifestItemIds(parentAttempt.metadata).has(item.id))) {
    throw notFound("Test item");
  }
  const definition = getActivityDefinition(item.activity.activityType.key);
  if (!definition?.grading?.supportsCompositeExecution) {
    throw new AppError(409, "TEST_ITEM_COMPOSITE_UNSUPPORTED", `${item.activity.title} does not support Test execution yet.`);
  }
  const itemAttempt = await prisma.testItemAttempt.findUnique({
    where: { parentAttemptId_testItemId: { parentAttemptId, testItemId } }
  });
  if (itemAttempt && parentAttempt.lifecycle === "started") {
    itemAttempt.result = { ...asRecord(itemAttempt.result), state: reconcileItemState(item.activity, itemAttempt.result) } as Prisma.JsonObject;
  }
  return { ...context, parentAttempt, item, itemAttempt };
}

export async function saveTestItemAttemptState(
  user: CurrentUser,
  courseId: string,
  groupId: string,
  testActivityId: string,
  parentAttemptId: string,
  testItemId: string,
  state: Record<string, unknown>,
  options: { sessionId?: string | null; configSnapshot?: Record<string, unknown> } = {}
) {
  const context = await getTestItemExecutionContext(
    user,
    courseId,
    groupId,
    testActivityId,
    parentAttemptId,
    testItemId,
    {
      allowCompletedParent: true,
      allowExpiredParent: true,
      allowResumePolicyBypass: true,
      sessionId: options.sessionId
    }
  );
  if (context.parentAttempt.lifecycle !== "started" || (context.itemAttempt && context.itemAttempt.lifecycle !== "started")) {
    if (context.itemAttempt) {
      return context.itemAttempt;
    }
    throw notFound("Test item attempt");
  }
  assertTestAttemptWithinTime(context.parentAttempt, context.assignedActivity.assignment);
  assertTestAttemptResumePolicy(context.parentAttempt, options.sessionId, context.test.settings);
  return prisma.$transaction(async (tx) => {
    // Serialize with expiry recovery so a queued autosave cannot alter submitted work.
    await tx.$queryRaw`SELECT id FROM "ActivityAttempt" WHERE id = ${parentAttemptId} FOR UPDATE`;
    const parent = await tx.activityAttempt.findUniqueOrThrow({ where: { id: parentAttemptId } });
    const saved = await tx.testItemAttempt.findUnique({ where: { parentAttemptId_testItemId: { parentAttemptId, testItemId } } });
    const claim = await tx.testSubmissionClaim.findUnique({ where: { parentAttemptId } });
    if (parent.lifecycle !== "started" || (saved && saved.lifecycle !== "started") || claim?.status === "processing") {
      if (saved) return saved;
      throw notFound("Test item attempt");
    }
    return tx.testItemAttempt.upsert({
      where: { parentAttemptId_testItemId: { parentAttemptId, testItemId } },
      update: { result: { ...asRecord(context.itemAttempt?.result), state, configSnapshot: options.configSnapshot ?? context.item.activity.config } as Prisma.InputJsonValue },
      create: {
        parentAttemptId,
        testItemId,
        activityId: context.item.activityId,
        lifecycle: "started",
        result: { state, configSnapshot: options.configSnapshot ?? context.item.activity.config } as Prisma.InputJsonValue,
        activityConfigFingerprint: fingerprint(context.item.activity.config)
      }
    });
  });
}

export async function submitTestItemAttemptResult(
  user: CurrentUser,
  courseId: string,
  groupId: string,
  testActivityId: string,
  parentAttemptId: string,
  testItemId: string,
  input: {
    state: Record<string, unknown>;
    gradingResult: ActivityGradingResult | null;
    pluginAttemptRef?: string | null;
    now?: Date;
  }
) {
  const context = await getTestItemExecutionContext(
    user,
    courseId,
    groupId,
    testActivityId,
    parentAttemptId,
    testItemId,
    { allowExpiredParent: true, allowResumePolicyBypass: true }
  );
  if (context.itemAttempt && context.itemAttempt.lifecycle !== "started") {
    throw new AppError(409, "TEST_ITEM_ALREADY_SUBMITTED", "This Test item has already been submitted.");
  }
  if (input.gradingResult && (!Number.isFinite(input.gradingResult.rawMaxScore) || input.gradingResult.rawMaxScore <= 0)) {
    throw new AppError(422, "TEST_ITEM_GRADING_RESULT_INVALID", "The activity returned an invalid maximum score.");
  }
  const now = input.now ?? new Date();
  const normalizedScore = input.gradingResult ? (input.gradingResult.rawScore / input.gradingResult.rawMaxScore) * context.item.pointsPossible : null;
  return prisma.testItemAttempt.upsert({
    where: { parentAttemptId_testItemId: { parentAttemptId, testItemId } },
    update: {
      lifecycle: input.gradingResult ? "graded" : "submitted",
      rawScore: input.gradingResult?.rawScore ?? null,
      rawMaxScore: input.gradingResult?.rawMaxScore ?? null,
      normalizedScore,
      normalizedMaxScore: context.item.pointsPossible,
      pluginAttemptRef: input.pluginAttemptRef,
      result: {
        ...asRecord(context.itemAttempt?.result),
        state: input.state,
        configSnapshot: context.item.activity.config,
        analyticsPayload: input.gradingResult?.analyticsPayload ?? {},
        metadata: input.gradingResult?.metadata ?? {}
      } as Prisma.InputJsonValue,
      feedback: (input.gradingResult?.feedback ?? {}) as Prisma.InputJsonValue,
      activityConfigFingerprint: fingerprint(context.item.activity.config),
      submittedAt: now,
      gradedAt: input.gradingResult ? now : null
    },
    create: {
      parentAttemptId,
      testItemId,
      activityId: context.item.activityId,
      lifecycle: input.gradingResult ? "graded" : "submitted",
      rawScore: input.gradingResult?.rawScore ?? null,
      rawMaxScore: input.gradingResult?.rawMaxScore ?? null,
      normalizedScore,
      normalizedMaxScore: context.item.pointsPossible,
      pluginAttemptRef: input.pluginAttemptRef,
      result: {
        state: input.state,
        configSnapshot: context.item.activity.config,
        analyticsPayload: input.gradingResult?.analyticsPayload ?? {},
        metadata: input.gradingResult?.metadata ?? {}
      } as Prisma.InputJsonValue,
      feedback: (input.gradingResult?.feedback ?? {}) as Prisma.InputJsonValue,
      activityConfigFingerprint: fingerprint(context.item.activity.config),
      submittedAt: now,
      gradedAt: input.gradingResult ? now : null
    }
  });
}

export async function submitTestAttempt(
  user: CurrentUser,
  courseId: string,
  groupId: string,
  testActivityId: string,
  parentAttemptId: string
) {
  const context = await resolveTestRuntimeContext(user, courseId, groupId, testActivityId);
  const parentAttempt = await prisma.activityAttempt.findFirst({
    where: {
      id: parentAttemptId,
      activityId: testActivityId,
      participantId: context.participant.id,
      pluginKey: CORE_TEST_RUNTIME_KEY,
      lifecycle: "started"
    },
    include: { testItemAttempts: true }
  });
  if (!parentAttempt) {
    throw notFound("Active Test attempt");
  }
  const completedIds = new Set(
    parentAttempt.testItemAttempts
      .filter((attempt) => attempt.lifecycle === "submitted" || attempt.lifecycle === "graded")
      .map((attempt) => attempt.testItemId)
  );
  const revision = await ensureCurrentTestRevision(context);
  const currentItems = activeRuntimeItems(context.test.items);
  const submissionManifest = {
    ...asRecord(asRecord(parentAttempt.metadata).manifest),
    testRevisionId: revision.id, revisionNumber: revision.revisionNumber,
    settings: context.test.settings,
    items: orderedLiveItems(currentItems, parentAttempt.metadata, context.test.settings).map((item) => ({
      testItemId: item.id, activityId: item.activityId, activityTypeKey: item.activity.activityType.key,
      title: item.activity.title, position: item.position, pointsPossible: item.pointsPossible, isRequired: item.isRequired
    }))
  };
  const requiredManifestItems = submissionManifest.items.filter((item) => item.isRequired !== false);
  const missingRequiredItemIds = requiredManifestItems.map((item) => item.testItemId).filter((id) => !completedIds.has(id));
  if (missingRequiredItemIds.length) {
    throw new AppError(409, "TEST_REQUIRED_ITEMS_INCOMPLETE", "Complete all required Test activities before submitting.", {
      missingRequiredItemIds
    });
  }
  await prisma.activityAttempt.update({ where: { id: parentAttempt.id }, data: { testRevisionId: revision.id } });
  await submitActivityAttempt(user, {
    attemptId: parentAttempt.id,
    pluginAttemptRef: parentAttempt.id,
    metadata: {
      ...asRecord(parentAttempt.metadata),
      submittedItemIds: [...completedIds], submissionManifest
    } as Prisma.InputJsonValue
  });
  // Submission is final even when one child needs manual/rubric grading.
  if (currentItems.every((item) => parentAttempt.testItemAttempts.some((attempt) => attempt.testItemId === item.id && attempt.lifecycle === "graded"))) {
    await recordTestAttemptGrade(user, courseId, parentAttempt.id, "auto");
  }
  return getTestRuntime(user, courseId, groupId, testActivityId, "previous");
}

export async function claimTestAttemptSubmission(parentAttemptId: string) {
  try {
    await prisma.$transaction(async (tx) => {
      const attempt = await tx.activityAttempt.findUniqueOrThrow({ where: { id: parentAttemptId }, select: { activityId: true } });
      await lockTestAuthoring(tx, attempt.activityId);
      await tx.$queryRaw`SELECT id FROM "ActivityAttempt" WHERE id = ${parentAttemptId} FOR UPDATE`;
      await tx.testSubmissionClaim.create({ data: { parentAttemptId, status: "processing" } });
    });
    return true;
  } catch (error) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") throw error;
    const stale = await prisma.testSubmissionClaim.deleteMany({
      where: {
        parentAttemptId,
        status: "processing",
        updatedAt: { lt: new Date(Date.now() - 30 * 60_000) }
      }
    });
    if (!stale.count) return false;
    return claimTestAttemptSubmission(parentAttemptId);
  }
}

/** Internal recovery, independent of a learner session. Never runs a grader. */
export async function recoverExpiredTestAttempt(
  parentAttemptId: string,
  options: { now?: Date; graceMilliseconds?: number; actorUserId?: string } = {}
) {
  const now = options.now ?? new Date();
  return prisma.$transaction(async (tx) => {
    const identity = await tx.activityAttempt.findUnique({ where: { id: parentAttemptId }, select: { activityId: true } });
    if (!identity) return false;
    await lockTestAuthoring(tx, identity.activityId);
    await tx.$queryRaw`SELECT id FROM "ActivityAttempt" WHERE id = ${parentAttemptId} FOR UPDATE`;
    const attempt = await tx.activityAttempt.findUnique({ where: { id: parentAttemptId }, include: {
      groupActivity: true, testSubmissionClaim: true, testItemAttempts: true
    } });
    if (!attempt || attempt.pluginKey !== CORE_TEST_RUNTIME_KEY || attempt.lifecycle !== "started") return false;
    const claim = attempt.testSubmissionClaim;
    if (claim?.status === "processing" && claim.updatedAt.getTime() > now.getTime() - 30 * 60_000) return false;
    const exceptions = await loadAssignmentExceptions([attempt.groupActivityId], tx);
    const assignment = applyAssignmentExceptions(attempt.groupActivity, exceptionsForParticipant(exceptions, attempt.groupActivityId, attempt.participantId));
    const minutes = assignmentTimeLimitMinutes(assignment.metadata);
    const deadline = assignmentAttemptExpiresAt(attempt.startedAt, minutes, assignment.availableUntil);
    if (!deadline || deadline.getTime() + (options.graceMilliseconds ?? 30_000) > now.getTime()) return false;
    const test = await tx.test.findFirst({ where: { activityId: attempt.activityId }, include: runtimeTestInclude });
    if (!test) return false;
    const revision = await ensureCurrentTestRevision({ test }, tx);
    const items = orderedLiveItems(activeRuntimeItems(test.items), attempt.metadata, test.settings);
    for (const item of items) {
      const saved = attempt.testItemAttempts.find((entry) => entry.testItemId === item.id);
      if (saved && saved.lifecycle !== "started") continue;
      await tx.testItemAttempt.upsert({
        where: { parentAttemptId_testItemId: { parentAttemptId, testItemId: item.id } },
        update: { lifecycle: "submitted", submittedAt: deadline, normalizedMaxScore: item.pointsPossible },
        create: {
          parentAttemptId, testItemId: item.id, activityId: item.activityId,
          lifecycle: "submitted", submittedAt: deadline, normalizedMaxScore: item.pointsPossible,
          result: { state: {}, configSnapshot: item.activity.config } as Prisma.InputJsonValue
        }
      });
    }
    const recovery = { reason: "expired_test_recovery", recoveredAt: now.toISOString(), deadline: deadline.toISOString(), gradingPending: true };
    const metadata = {
      ...asRecord(attempt.metadata), timedOut: true, timeoutRecovery: recovery,
      submittedTimeLimitMinutes: minutes, submittedAvailableUntil: assignment.availableUntil?.toISOString() ?? null,
      submittedItemIds: items.map((item) => item.id),
      submissionManifest: {
        ...asRecord(asRecord(attempt.metadata).manifest), testRevisionId: revision.id, revisionNumber: revision.revisionNumber,
        settings: withAssignmentTimeLimit(test.settings, assignment.metadata),
        items: items.map((item) => ({ testItemId: item.id, activityId: item.activityId, activityTypeKey: item.activity.activityType.key,
          title: item.activity.title, position: item.position, pointsPossible: item.pointsPossible, isRequired: item.isRequired }))
      }
    } as Prisma.InputJsonValue;
    await tx.activityAttempt.update({ where: { id: parentAttemptId }, data: {
      lifecycle: "submitted", submittedAt: deadline, durationSeconds: Math.max(0, Math.round((deadline.getTime() - attempt.startedAt.getTime()) / 1000)),
      isLate: false, lateBySeconds: 0, pluginAttemptRef: parentAttemptId, testRevisionId: revision.id, metadata
    } });
    await tx.testSubmissionClaim.upsert({ where: { parentAttemptId }, create: { parentAttemptId, status: "completed" }, update: { status: "completed" } });
    await tx.courseAuditEvent.create({ data: {
      courseId: attempt.courseId, actorUserId: options.actorUserId ?? null, eventType: "test_timeout_recovered",
      targetType: "ActivityAttempt", targetId: parentAttemptId,
      previousValue: { lifecycle: attempt.lifecycle, submittedAt: null },
      nextValue: { lifecycle: "submitted", submittedAt: deadline.toISOString() }, metadata: recovery
    } });
    return true;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 30_000 });
}

export async function completeTestAttemptSubmission(parentAttemptId: string) {
  await prisma.testSubmissionClaim.update({ where: { parentAttemptId }, data: { status: "completed" } });
}

export async function releaseTestAttemptSubmission(parentAttemptId: string) {
  await prisma.testSubmissionClaim.deleteMany({ where: { parentAttemptId, status: "processing" } });
}

export async function regradeTestAttempt(
  user: CurrentUser,
  courseId: string,
  parentAttemptId: string,
  reason?: string | null
) {
  await gradeRecoveredTestResponses(user, courseId, parentAttemptId);
  return recordTestAttemptGrade(user, courseId, parentAttemptId, "regrade", reason);
}

/** Recovery preserves responses without a runner dependency. A teacher can grade them later. */
async function gradeRecoveredTestResponses(user: CurrentUser, courseId: string, parentAttemptId: string) {
  await getActivityAttemptRegradeContext(user, courseId, parentAttemptId);
  const parent = await prisma.activityAttempt.findFirst({
    where: { id: parentAttemptId, courseId, pluginKey: CORE_TEST_RUNTIME_KEY, lifecycle: "submitted" },
    include: { user: true, testItemAttempts: { include: { activity: { include: { activityType: true } } } } }
  });
  if (!parent?.user || !asRecord(parent.metadata).timeoutRecovery) return;
  const pending = parent.testItemAttempts.filter((item) => item.lifecycle === "submitted" && manifestItemIds(parent.metadata).has(item.testItemId));
  if (!pending.length) return;
  const claimed = await prisma.testSubmissionClaim.updateMany({
    where: { parentAttemptId, OR: [{ status: "completed" }, { status: "processing", updatedAt: { lt: new Date(Date.now() - 30 * 60_000) } }] },
    data: { status: "processing" }
  });
  if (!claimed.count) throw new AppError(409, "TEST_SUBMISSION_IN_PROGRESS", "This Test submission is already being processed.");
  const learner: CurrentUser = { id: parent.user.id, email: parent.user.email, name: parent.user.name,
    firstName: parent.user.firstName, lastName: parent.user.lastName, roles: ["student"] };
  try {
    for (const item of pending) {
      const activityTypeKey = item.activity.activityType.key;
      await assertActivityTypePluginEnabled(activityTypeKey);
      const submit = resolveCompositeExecutionSubmissionHandler(activityTypeKey);
      if (!submit) continue;
      const result = await submit({ user: learner, courseId, groupId: parent.groupId, parentAttemptId,
        testItemId: item.testItemId,
        activity: { ...item.activity, config: asRecord(item.activity.config), metadata: asRecord(item.activity.metadata) },
        payload: reconcileItemState(item.activity, item.result)
      });
      const grade = result.gradingResult;
      if (grade && (!Number.isFinite(grade.rawScore) || !Number.isFinite(grade.rawMaxScore) || grade.rawMaxScore <= 0)) {
        throw new AppError(422, "TEST_ITEM_GRADING_RESULT_INVALID", "The activity returned an invalid score.");
      }
      const points = manifestItems(parent.metadata).find((entry) => entry.testItemId === item.testItemId)?.pointsPossible ?? item.normalizedMaxScore ?? 0;
      await prisma.$transaction(async (tx) => {
        await lockTestAuthoring(tx, parent.activityId);
        const current = await tx.activityAttempt.findUniqueOrThrow({ where: { id: parentAttemptId } });
        if (current.lifecycle !== "submitted" || current.updatedAt.getTime() !== parent.updatedAt.getTime()) {
          throw new AppError(409, "TEST_ATTEMPT_CHANGED", "The Test attempt changed while grading. Reload its results.");
        }
        const updated = await tx.testItemAttempt.update({ where: { id: item.id, updatedAt: item.updatedAt, lifecycle: "submitted" }, data: {
          lifecycle: grade ? "graded" : "submitted", gradedAt: grade ? new Date() : null,
          rawScore: grade?.rawScore ?? null, rawMaxScore: grade?.rawMaxScore ?? null,
          normalizedScore: grade ? grade.rawScore / grade.rawMaxScore * points : null,
          normalizedMaxScore: points,
          result: { ...asRecord(item.result), state: result.state, configSnapshot: item.activity.config, analyticsPayload: grade?.analyticsPayload ?? {}, metadata: grade?.metadata ?? {} } as Prisma.InputJsonValue,
          feedback: (grade?.feedback ?? {}) as Prisma.InputJsonValue
        } });
        await tx.courseAuditEvent.create({ data: {
          courseId, actorUserId: user.id, eventType: "test_recovered_response_graded", targetType: "TestItemAttempt", targetId: item.id,
          previousValue: { lifecycle: item.lifecycle, result: item.result, rawScore: item.rawScore, rawMaxScore: item.rawMaxScore } as Prisma.InputJsonValue,
          nextValue: { lifecycle: updated.lifecycle, result: updated.result, rawScore: updated.rawScore, rawMaxScore: updated.rawMaxScore } as Prisma.InputJsonValue,
          metadata: { parentAttemptId }
        } });
      });
    }
  } finally { await completeTestAttemptSubmission(parentAttemptId); }
}

export async function getTestAttemptReview(user: CurrentUser, courseId: string, parentAttemptId: string) {
  const context = await getActivityAttemptRegradeContext(user, courseId, parentAttemptId);
  if (context.activityTypeKey !== "test") {
    throw new AppError(400, "TEST_ATTEMPT_REQUIRED", "This attempt does not belong to a Test.");
  }
  const parentAttempt = await prisma.activityAttempt.findFirst({
    where: { id: parentAttemptId, courseId, pluginKey: CORE_TEST_RUNTIME_KEY, lifecycle: { in: ["submitted", "graded"] } },
    include: {
      testRevision: { include: { items: true } },
      testItemAttempts: {
        include: {
          activity: { include: { activityType: true } }
        }
      }
    }
  });
  if (!parentAttempt) throw notFound("Submitted Test attempt");
  const attemptByItemId = new Map(parentAttempt.testItemAttempts.map((attempt) => [attempt.testItemId, attempt]));
  const revisionItemBySourceId = new Map((parentAttempt.testRevision?.items ?? []).map((item) => [item.sourceTestItemId, item]));
  return {
    id: parentAttempt.id,
    attemptNumber: parentAttempt.attemptNumber,
    lifecycle: parentAttempt.lifecycle,
    submittedAt: parentAttempt.submittedAt?.toISOString() ?? null,
    gradedAt: parentAttempt.gradedAt?.toISOString() ?? null,
    items: manifestItems(parentAttempt.metadata).flatMap((manifestItem) => {
      const itemAttempt = attemptByItemId.get(manifestItem.testItemId);
      if (!itemAttempt) return [];
      const revisionItem = revisionItemBySourceId.get(manifestItem.testItemId);
      return [{
        testItemId: manifestItem.testItemId,
        activityId: manifestItem.activityId ?? itemAttempt.activityId,
        activityTypeKey: manifestItem.activityTypeKey ?? itemAttempt.activity.activityType.key,
        title: manifestItem.title ?? itemAttempt.activity.title,
        pointsPossible: manifestItem.pointsPossible ?? itemAttempt.normalizedMaxScore ?? 0,
        activity: {
          id: itemAttempt.activity.id,
          title: revisionItem?.title ?? itemAttempt.activity.title,
          description: revisionItem?.description ?? itemAttempt.activity.description,
          lifecycle: itemAttempt.activity.lifecycle,
          config: asRecord(revisionItem?.config ?? itemAttempt.activity.config),
          metadata: asRecord(revisionItem?.metadata ?? itemAttempt.activity.metadata),
          activityType: {
            id: itemAttempt.activity.activityType.id,
            key: revisionItem?.activityTypeKey ?? itemAttempt.activity.activityType.key,
            name: itemAttempt.activity.activityType.name,
            description: itemAttempt.activity.activityType.description
          }
        },
        itemAttempt: {
          id: itemAttempt.id,
          pluginAttemptRef: itemAttempt.pluginAttemptRef,
          lifecycle: itemAttempt.lifecycle,
          rawScore: itemAttempt.rawScore,
          rawMaxScore: itemAttempt.rawMaxScore,
          normalizedScore: itemAttempt.normalizedScore,
          normalizedMaxScore: itemAttempt.normalizedMaxScore,
          state: asRecord(asRecord(itemAttempt.result).state),
          feedback: asRecord(itemAttempt.feedback)
        }
      }];
    })
  };
}

export async function recordTestItemAiFeedback(
  user: CurrentUser,
  courseId: string,
  parentAttemptId: string,
  testItemId: string,
  input: {
    feedback: Record<string, unknown>;
    feedbackRef: string;
    feedbackVersion: number;
    feedbackHash: string;
    gradingResult?: { rawScore: number; rawMaxScore: number; isPass?: boolean | null };
  }
) {
  const context = await getActivityAttemptRegradeContext(user, courseId, parentAttemptId);
  if (context.activityTypeKey !== "test") throw new AppError(400, "TEST_ATTEMPT_REQUIRED", "This attempt does not belong to a Test.");
  const parent = await prisma.activityAttempt.findFirst({
    where: { id: parentAttemptId, courseId, pluginKey: CORE_TEST_RUNTIME_KEY },
    include: { testItemAttempts: true }
  });
  if (!parent) throw notFound("Test attempt");
  const manifestItem = manifestItems(parent.metadata).find((item) => item.testItemId === testItemId);
  const itemAttempt = parent.testItemAttempts.find((attempt) => attempt.testItemId === testItemId);
  if (!manifestItem || !itemAttempt) throw notFound("Test item attempt");
  const pointsPossible = manifestItem.pointsPossible ?? itemAttempt.normalizedMaxScore ?? 0;
  const grading = input.gradingResult && input.gradingResult.rawMaxScore > 0
    ? {
        rawScore: input.gradingResult.rawScore,
        rawMaxScore: input.gradingResult.rawMaxScore,
        normalizedScore: input.gradingResult.rawScore / input.gradingResult.rawMaxScore * pointsPossible,
        normalizedMaxScore: pointsPossible
      }
    : null;
  return prisma.testItemAttempt.update({
    where: { id: itemAttempt.id },
    data: {
      ...(grading ? { ...grading, lifecycle: "graded" as const, gradedAt: new Date() } : {}),
      feedback: {
        ...asRecord(itemAttempt.feedback),
        aiFeedback: {
          ...input.feedback,
          feedbackRef: input.feedbackRef,
          feedbackVersion: input.feedbackVersion,
          feedbackHash: input.feedbackHash,
          challengeAllowed: Boolean(input.gradingResult)
        }
      } as Prisma.InputJsonValue,
      result: {
        ...asRecord(itemAttempt.result),
        aiFeedbackRef: input.feedbackRef,
        aiFeedbackVersion: input.feedbackVersion
      } as Prisma.InputJsonValue
    }
  });
}

export async function gradeTestItemManually(
  user: CurrentUser,
  courseId: string,
  parentAttemptId: string,
  testItemId: string,
  input: { score: number; reason?: string | null; feedbackText?: string | null }
) {
  const context = await getActivityAttemptRegradeContext(user, courseId, parentAttemptId);
  if (context.activityTypeKey !== "test") {
    throw new AppError(400, "TEST_ATTEMPT_REQUIRED", "This attempt does not belong to a Test.");
  }
  const parentAttempt = await prisma.activityAttempt.findFirst({
    where: { id: parentAttemptId, courseId, pluginKey: CORE_TEST_RUNTIME_KEY, lifecycle: { in: ["submitted", "graded"] } },
    include: { testItemAttempts: true }
  });
  if (!parentAttempt) throw notFound("Submitted Test attempt");
  const manifestItem = manifestItems(parentAttempt.metadata).find((item) => item.testItemId === testItemId);
  const itemAttempt = parentAttempt.testItemAttempts.find((attempt) => attempt.testItemId === testItemId);
  const pointsPossible = manifestItem?.pointsPossible ?? itemAttempt?.normalizedMaxScore ?? null;
  if (!manifestItem || !itemAttempt || pointsPossible === null) throw notFound("Test item attempt");
  if (!Number.isFinite(input.score) || input.score < 0 || input.score > pointsPossible) {
    throw new AppError(400, "TEST_ITEM_SCORE_OUT_OF_RANGE", `Score must be between zero and ${pointsPossible}.`);
  }

  const gradedAt = new Date();
  await prisma.testItemAttempt.update({
    where: { id: itemAttempt.id },
    data: {
      lifecycle: "graded",
      rawScore: input.score,
      rawMaxScore: pointsPossible,
      normalizedScore: input.score,
      normalizedMaxScore: pointsPossible,
      feedback: {
        ...asRecord(itemAttempt.feedback),
        ...(input.feedbackText === undefined ? {} : { feedbackText: input.feedbackText })
      } as Prisma.InputJsonValue,
      result: {
        ...asRecord(itemAttempt.result),
        manualGrading: {
          score: input.score,
          pointsPossible,
          graderUserId: user.id,
          reason: input.reason ?? null,
          gradedAt: gradedAt.toISOString()
        }
      } as Prisma.InputJsonValue,
      gradedAt
    }
  });
  return recordTestAttemptGrade(user, courseId, parentAttemptId, "manual", input.reason);
}

async function recordTestAttemptGrade(
  user: CurrentUser,
  courseId: string,
  parentAttemptId: string,
  source: "auto" | "manual" | "regrade",
  reason?: string | null
) {
  const parentAttempt = await prisma.activityAttempt.findFirst({
    where: {
      id: parentAttemptId,
      courseId,
      pluginKey: CORE_TEST_RUNTIME_KEY,
      lifecycle: { in: ["submitted", "graded"] }
    },
    include: { testItemAttempts: true }
  });
  if (!parentAttempt) {
    throw notFound("Submitted Test attempt");
  }

  const manifest = manifestItems(parentAttempt.metadata);
  const attemptByItemId = new Map(parentAttempt.testItemAttempts.map((attempt) => [attempt.testItemId, attempt]));
  const incompleteItemIds: string[] = [];
  const items = manifest.flatMap((item) => {
    const attempt = attemptByItemId.get(item.testItemId);
    if (
      !attempt ||
      attempt.lifecycle !== "graded" ||
      attempt.rawScore === null ||
      attempt.rawMaxScore === null ||
      attempt.normalizedScore === null ||
      attempt.normalizedMaxScore === null
    ) {
      incompleteItemIds.push(item.testItemId);
      return [];
    }
    return [{
      testItemId: item.testItemId,
      activityId: item.activityId ?? attempt.activityId,
      activityTypeKey: item.activityTypeKey ?? "unknown",
      title: item.title ?? "Activity",
      position: item.position,
      rawScore: attempt.rawScore,
      rawMaxScore: attempt.rawMaxScore,
      pointsEarned: attempt.normalizedScore,
      pointsPossible: attempt.normalizedMaxScore,
      feedback: asRecord(attempt.feedback)
    }];
  });
  if (incompleteItemIds.length) {
    throw new AppError(409, "TEST_ITEMS_NOT_GRADED", "All Test activities must be graded before the Test grade can be calculated.", {
      incompleteItemIds
    });
  }

  const rawScore = items.reduce((sum, item) => sum + item.pointsEarned, 0);
  const rawMaxScore = items.reduce((sum, item) => sum + item.pointsPossible, 0);
  if (rawMaxScore <= 0) {
    throw new AppError(409, "TEST_POINTS_REQUIRED", "The Test must have a positive total point value before it can be graded.");
  }

  return recordActivityAttemptGradingResult(user, {
    attemptId: parentAttempt.id,
    rawScore,
    rawMaxScore,
    source,
    rawResult: {
      kind: "test",
      testId: asRecord(asRecord(parentAttempt.metadata).manifest).testId ?? null,
      items
    } as Prisma.InputJsonValue,
    normalizedResult: {
      studentFeedback: {
        kind: "test",
        details: { items }
      }
    } as Prisma.InputJsonValue,
    metadata: {
      runtimeHandlerKey: CORE_TEST_RUNTIME_KEY,
      itemCount: items.length,
      gradedItemCount: items.length
    } as Prisma.InputJsonValue,
    reason: reason ?? null
  });
}

async function resolveTestRuntimeContext(user: CurrentUser, courseId: string, groupId: string, testActivityId: string) {
  const assignedActivity = await getGroupAssignedActivity(user, courseId, groupId, testActivityId);
  if (assignedActivity.activityType.key !== "test") {
    throw new AppError(400, "TEST_ACTIVITY_REQUIRED", "This assigned activity is not a Test.");
  }
  const participant = await prisma.courseGroupParticipant.findFirst({
    where: { groupId, userId: user.id, role: "student" }
  });
  if (!participant) {
    throw forbidden();
  }
  const test = await prisma.test.findFirst({
    where: { courseId, activityId: testActivityId },
    include: runtimeTestInclude
  });
  if (!test) {
    throw notFound("Test");
  }
  return { assignedActivity, participant, test };
}

async function findParentAttempt(
  participantId: string,
  testActivityId: string,
  parentAttemptId: string,
  allowCompletedParent: boolean
) {
  const attempt = await prisma.activityAttempt.findFirst({
    where: {
      id: parentAttemptId,
      activityId: testActivityId,
      participantId,
      pluginKey: CORE_TEST_RUNTIME_KEY,
      lifecycle: allowCompletedParent ? { in: ["started", "submitted", "graded"] } : "started"
    }
  });
  if (!attempt) {
    throw notFound(allowCompletedParent ? "Test attempt" : "Active Test attempt");
  }
  return attempt;
}

function buildTestRuntime(
  context: Awaited<ReturnType<typeof resolveTestRuntimeContext>>,
  attempt: Awaited<ReturnType<typeof prisma.activityAttempt.findFirst>> & { testItemAttempts?: Array<Record<string, unknown>> } | null,
  availability: Awaited<ReturnType<typeof getActivityAttemptAvailability>>,
  hasPreviousSubmissions: boolean,
  sessionId?: string | null
) {
  const itemAttempts = new Map((attempt?.testItemAttempts ?? []).map((itemAttempt) => [String(itemAttempt.testItemId), itemAttempt]));
  const itemOrder = attempt && attempt.lifecycle !== "started"
    ? manifestItems(attempt.metadata).map((item) => item.testItemId)
    : orderedLiveItems(activeRuntimeItems(context.test.items), attempt?.metadata, context.test.settings).map((item) => item.id);
  const revision = (attempt as typeof attempt & { testRevision?: { title: string; description: string; items: Array<{ sourceTestItemId: string; title: string; description: string; config: unknown; metadata: unknown; pointsPossible: number }> } })?.testRevision;
  const itemById = new Map(context.test.items.map((item) => [item.id, item]));
  const items = itemOrder.flatMap((itemId) => {
    const item = itemById.get(itemId);
    if (!item) return [];
    const itemAttempt = itemAttempts.get(itemId);
    const saved = attempt?.lifecycle !== "started" ? revision?.items.find((entry) => entry.sourceTestItemId === item.id) : null;
    return [{
      ...item,
      ...(saved ? { pointsPossible: saved.pointsPossible, activity: { ...item.activity, title: saved.title, description: saved.description, config: saved.config, metadata: saved.metadata } } : {}),
      itemAttempt: itemAttempt ? {
        id: String(itemAttempt.id),
        lifecycle: String(itemAttempt.lifecycle),
        rawScore: availability.gradesReleased ? numberOrNull(itemAttempt.rawScore) : null,
        rawMaxScore: availability.gradesReleased ? numberOrNull(itemAttempt.rawMaxScore) : null,
        normalizedScore: availability.gradesReleased ? numberOrNull(itemAttempt.normalizedScore) : null,
        normalizedMaxScore: availability.gradesReleased ? numberOrNull(itemAttempt.normalizedMaxScore) : null,
        state: projectStudentTestItemState(item.activity.activityType.key, attempt?.lifecycle === "started" ? reconcileItemState(item.activity, itemAttempt.result) : asRecord(asRecord(itemAttempt.result).state)),
        submittedAt: itemAttempt.submittedAt ?? null,
        gradedAt: itemAttempt.gradedAt ?? null
      } : null
    }];
  });
  const savedSettings = attempt && attempt.lifecycle !== "started" ? currentManifest(attempt.metadata).settings ?? context.test.settings : context.test.settings;
  const submittedMetadata = asRecord(attempt?.metadata);
  // Submitted history must not acquire a deadline from later assignment edits.
  // Older submissions have no Until snapshot and retain their original timing.
  const availableUntil = !attempt || attempt.lifecycle === "started"
    ? context.assignedActivity.assignment.availableUntil
    : typeof submittedMetadata.submittedAvailableUntil === "string"
      ? new Date(submittedMetadata.submittedAvailableUntil)
      : null;
  const runtimeSettings = !attempt || attempt.lifecycle === "started"
    ? withAssignmentTimeLimit(savedSettings, context.assignedActivity.assignment.metadata)
    : Object.prototype.hasOwnProperty.call(submittedMetadata, "submittedTimeLimitMinutes")
      ? { ...asRecord(savedSettings), timeLimitMinutes: submittedMetadata.submittedTimeLimitMinutes }
      : savedSettings;
  const manifest = attempt ? asRecord(asRecord(attempt.metadata).manifest) : {};
  const resumeAllowed = asRecord(runtimeSettings).allowResume !== false;
  const attemptSessionId = typeof manifest.sessionId === "string" ? manifest.sessionId : null;
  const resumeBlocked = Boolean(
    attempt?.lifecycle === "started" &&
    !asRecord(attempt?.metadata).continuation &&
    !resumeAllowed &&
    attemptSessionId &&
    attemptSessionId !== sessionId
  );
  return {
    test: {
      id: context.test.id,
      activity: revision && attempt?.lifecycle !== "started" ? { ...context.test.activity, title: revision.title, description: revision.description } : context.test.activity,
      settings: runtimeSettings,
      items
    },
    attempt: attempt ? {
      id: attempt.id,
      attemptNumber: attempt.attemptNumber,
      lifecycle: attempt.lifecycle,
      startedAt: attempt.startedAt,
      submittedAt: attempt.submittedAt,
      gradedAt: attempt.gradedAt
    } : null,
    timing: buildTestTiming(runtimeSettings, attempt, availableUntil),
    resume: { allowed: resumeAllowed, blocked: resumeBlocked },
    availability,
    hasPreviousSubmissions
  };
}

function assertTestAttemptResumePolicy(attempt: { metadata: unknown }, sessionId?: string | null, settings?: unknown) {
  if (asRecord(attempt.metadata).continuation) return;
  const manifest = asRecord(asRecord(attempt.metadata).manifest);
  if (asRecord(settings ?? manifest.settings).allowResume !== false) return;
  const attemptSessionId = typeof manifest.sessionId === "string" ? manifest.sessionId : null;
  if (attemptSessionId && attemptSessionId !== sessionId) {
    throw new AppError(409, "TEST_RESUME_DISABLED", "This Test does not allow an unfinished attempt to be resumed.");
  }
}

async function ensureCurrentTestRevision(context: Pick<Awaited<ReturnType<typeof resolveTestRuntimeContext>>, "test">, db: Prisma.TransactionClient | typeof prisma = prisma) {
  const snapshot = {
    title: context.test.activity.title,
    description: context.test.activity.description,
    settings: context.test.settings,
    items: activeRuntimeItems(context.test.items).map((item) => ({
      sourceTestItemId: item.id,
      sourceActivityId: item.activityId,
      activityTypeKey: item.activity.activityType.key,
      title: item.activity.title,
      description: item.activity.description,
      config: item.activity.config,
      metadata: item.activity.metadata,
      position: item.position,
      pointsPossible: item.pointsPossible,
      isRequired: item.isRequired,
      activityFingerprint: fingerprint({ config: item.activity.config, metadata: item.activity.metadata })
    }))
  };
  const revisionFingerprint = fingerprint(snapshot);
  const existing = await db.testRevision.findUnique({
    where: { testId_fingerprint: { testId: context.test.id, fingerprint: revisionFingerprint } },
    include: { items: { orderBy: [{ position: "asc" }, { createdAt: "asc" }] } }
  });
  if (existing) {
    await ensureTestRevisionMediaReferences(existing, snapshot, db);
    return existing;
  }
  const latest = await db.testRevision.findFirst({
    where: { testId: context.test.id },
    orderBy: { revisionNumber: "desc" },
    select: { revisionNumber: true }
  });
  try {
    const revision = await db.testRevision.create({
      data: {
        testId: context.test.id,
        revisionNumber: (latest?.revisionNumber ?? 0) + 1,
        title: snapshot.title,
        description: snapshot.description,
        settings: snapshot.settings as Prisma.InputJsonValue,
        fingerprint: revisionFingerprint,
        items: {
          create: snapshot.items.map((item) => ({
            ...item,
            config: (item.config ?? {}) as Prisma.InputJsonValue,
            metadata: (item.metadata ?? {}) as Prisma.InputJsonValue
          }))
        }
      },
      include: { items: { orderBy: [{ position: "asc" }, { createdAt: "asc" }] } }
    });
    await ensureTestRevisionMediaReferences(revision, snapshot, db);
    return revision;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const raced = await db.testRevision.findUnique({
        where: { testId_fingerprint: { testId: context.test.id, fingerprint: revisionFingerprint } },
        include: { items: { orderBy: [{ position: "asc" }, { createdAt: "asc" }] } }
      });
      if (raced) {
        await ensureTestRevisionMediaReferences(raced, snapshot, db);
        return raced;
      }
    }
    throw error;
  }
}

async function ensureTestRevisionMediaReferences(
  revision: { id: string; items: Array<{ id: string }> },
  snapshot: {
    description: string;
    settings: unknown;
    items: Array<{ description: string; config: unknown }>;
  },
  db: Prisma.TransactionClient | typeof prisma
) {
  if (!extractMediaAssetIds(snapshot).size) return;
  const reconcile = async (tx: Prisma.TransactionClient) => {
    await reconcileMediaAssetReferences(tx, { testRevisionId: revision.id }, {
      description: snapshot.description,
      settings: snapshot.settings
    }, { trustedCopy: true });
    for (const [index, revisionItem] of revision.items.entries()) {
      const item = snapshot.items[index];
      if (!item) continue;
      await reconcileMediaAssetReferences(tx, { testRevisionItemId: revisionItem.id }, {
        description: item.description,
        config: item.config
      }, { trustedCopy: true });
    }
  };
  if ("$transaction" in db) await db.$transaction(reconcile);
  else await reconcile(db);
}

function buildTestTiming(settingsValue: unknown, attempt: { lifecycle?: unknown; startedAt?: unknown } | null, availableUntil?: Date | null) {
  const settings = asRecord(settingsValue);
  const timeLimitMinutes = typeof settings.timeLimitMinutes === "number" && settings.timeLimitMinutes > 0 ? settings.timeLimitMinutes : null;
  const startedAt = attempt?.startedAt instanceof Date ? attempt.startedAt : attempt?.startedAt ? new Date(String(attempt.startedAt)) : null;
  const expiresAt = assignmentAttemptExpiresAt(startedAt, timeLimitMinutes, availableUntil);
  const remainingSeconds = expiresAt ? Math.max(0, Math.ceil((expiresAt.getTime() - Date.now()) / 1000)) : null;
  return {
    timeLimitMinutes,
    expiresAt: expiresAt?.toISOString() ?? null,
    remainingSeconds,
    isExpired: attempt?.lifecycle === "started" && remainingSeconds === 0
  };
}

function withAssignmentTimeLimit(settingsValue: unknown, assignmentMetadata: unknown) {
  return {
    ...asRecord(settingsValue),
    timeLimitMinutes: assignmentTimeLimitMinutes(assignmentMetadata)
  };
}

function assertTestAttemptWithinTime(attempt: { metadata: unknown; startedAt: Date; lifecycle?: string }, assignment: { metadata: unknown; availableUntil?: Date | null }) {
  if (attempt.lifecycle && attempt.lifecycle !== "started") return;
  const expiresAt = assignmentAttemptExpiresAt(attempt.startedAt, assignmentTimeLimitMinutes(assignment.metadata), assignment.availableUntil);
  if (expiresAt && Date.now() >= expiresAt.getTime()) {
    throw new AppError(409, "TEST_TIME_LIMIT_EXPIRED", "The Test time limit has expired. Submit the Test to finish the attempt.", {
      expiresAt: expiresAt.toISOString()
    });
  }
}

function assertCompositeItemsSupported(items: Array<{ activity: { title: string; activityType: { key: string } } }>) {
  if (!items.length) {
    throw new AppError(409, "TEST_ITEMS_REQUIRED", "Add at least one activity before starting this Test.");
  }
  const unsupported = items.filter((item) => !getActivityDefinition(item.activity.activityType.key)?.grading?.supportsCompositeExecution);
  if (unsupported.length) {
    throw new AppError(409, "TEST_ITEM_COMPOSITE_UNSUPPORTED", "Some Test activities do not support student execution yet.", {
      activityTitles: unsupported.map((item) => item.activity.title)
    });
  }
}

function orderManifestItems<T>(items: T[], randomize: boolean) {
  if (!randomize) return [...items];
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}

function fingerprint(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value ?? null)).digest("hex");
}

function manifestItems(metadata: unknown) {
  const manifest = currentManifest(metadata);
  const items = Array.isArray(manifest.items) ? manifest.items : [];
  return items.flatMap((value) => {
    const item = asRecord(value);
    return typeof item.testItemId === "string" ? [{
      testItemId: item.testItemId,
      activityId: typeof item.activityId === "string" ? item.activityId : null,
      activityTypeKey: typeof item.activityTypeKey === "string" ? item.activityTypeKey : null,
      title: typeof item.title === "string" ? item.title : null,
      position: typeof item.position === "number" && Number.isFinite(item.position) ? item.position : null,
      pointsPossible: typeof item.pointsPossible === "number" && Number.isFinite(item.pointsPossible) ? item.pointsPossible : null,
      isRequired: item.isRequired !== false
    }] : [];
  });
}

function manifestItemIds(metadata: unknown) {
  return new Set(manifestItems(metadata).map((item) => item.testItemId));
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function numberOrNull(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function currentManifest(metadata: unknown) {
  const record = asRecord(metadata);
  return asRecord(record.submissionManifest ?? record.manifest);
}
function activeRuntimeItems<T extends { removedAt?: Date | null }>(items: T[]) {
  return items.filter((item) => !item.removedAt);
}
function orderedLiveItems<T extends { id: string }>(items: T[], metadata: unknown, settings: unknown) {
  if (asRecord(settings).randomizeItems !== true || !metadata) return items;
  const oldOrder = manifestItems(metadata).map((item) => item.testItemId);
  return [...items].sort((a, b) => {
    const aIndex = oldOrder.indexOf(a.id), bIndex = oldOrder.indexOf(b.id);
    return (aIndex < 0 ? oldOrder.length : aIndex) - (bIndex < 0 ? oldOrder.length : bIndex);
  });
}

function reconcileItemState(activity: { config: unknown; activityType: { key: string } }, result: unknown) {
  const saved = asRecord(result), state = asRecord(saved.state);
  if (!saved.configSnapshot) return state;
  return getActivityDefinition(activity.activityType.key)?.reconcileResponseState?.(saved.configSnapshot, activity.config, state) ?? state;
}

export function projectStudentTestItemState(activityTypeKey: string, state: Record<string, unknown>) {
  return getActivityDefinition(activityTypeKey)?.studentResponseState?.(state) ?? state;
}
