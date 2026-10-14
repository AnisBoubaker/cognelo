import { resolveCompositeExecutionRegradingHandler, resolveCompositeExecutionSubmissionHandler } from "@cognelo/activity-sdk/server";
import type { CurrentUser, TestRegradeItemResult, TestRegradeProgress } from "@cognelo/contracts";
import { Prisma, prisma } from "@cognelo/db";
import { lockTestAuthoring } from "./activity-authoring-live";
import { AppError, notFound } from "./errors";
import { getActivityAttemptRegradeContext } from "./gradebook";
import { assertActivityTypePluginEnabled } from "./plugins";
import { recalculateTestAttemptGrade } from "./test-execution";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

/** Teacher-triggered batch: every submitted child in this attempt's frozen manifest. */
export async function regradeTestAttempt(
  user: CurrentUser, courseId: string, parentAttemptId: string, reason?: string | null,
  onProgress?: (progress: TestRegradeProgress) => void
) {
  await getActivityAttemptRegradeContext(user, courseId, parentAttemptId);
  const claimedAt = new Date();
  const parent = await prisma.$transaction(async (tx) => {
    const identity = await tx.activityAttempt.findFirst({
      where: { id: parentAttemptId, courseId, pluginKey: "core:test", lifecycle: { in: ["submitted", "graded"] } },
      select: { activityId: true }
    });
    if (!identity) throw notFound("Submitted Test attempt");
    await lockTestAuthoring(tx, identity.activityId);
    await tx.$queryRaw`SELECT id FROM "ActivityAttempt" WHERE id = ${parentAttemptId} FOR UPDATE`;
    const attempt = await tx.activityAttempt.findFirst({
      where: { id: parentAttemptId, courseId, pluginKey: "core:test", lifecycle: { in: ["submitted", "graded"] } },
      include: { user: { select: { id: true, email: true, name: true, firstName: true, lastName: true } },
        testItemAttempts: { include: { activity: { include: { activityType: true } } } } }
    });
    if (!attempt?.user) throw notFound("Submitted Test attempt");
    const claim = await tx.testSubmissionClaim.findUnique({ where: { parentAttemptId } });
    if (claim?.status === "processing" && claim.updatedAt.getTime() > claimedAt.getTime() - 30 * 60_000) {
      throw new AppError(409, "TEST_SUBMISSION_IN_PROGRESS", "This Test attempt is already being graded.");
    }
    await tx.testSubmissionClaim.upsert({ where: { parentAttemptId },
      create: { parentAttemptId, status: "processing", updatedAt: claimedAt },
      update: { status: "processing", updatedAt: claimedAt }
    });
    return attempt;
  });
  const learner: CurrentUser = { id: parent.user!.id, email: parent.user!.email, name: parent.user!.name,
    firstName: parent.user!.firstName, lastName: parent.user!.lastName, roles: ["student"] };
  const manifest = asRecord(asRecord(parent.metadata).manifest).items;
  const items = Array.isArray(manifest) ? manifest.map(asRecord) : [];
  const outcomes: TestRegradeItemResult[] = [];
  const total = items.length + 1; // The final step persists the aggregate grade.
  const report = (activityTitle: string | null, completed = outcomes.length) => onProgress?.({ completed, total, activityTitle });
  const assertUnchanged = async (db: Pick<typeof prisma, "activityAttempt">) => {
    const current = await db.activityAttempt.findUniqueOrThrow({ where: { id: parentAttemptId } });
    if (current.lifecycle !== parent.lifecycle || current.updatedAt.getTime() !== parent.updatedAt.getTime()) {
      throw new AppError(409, "TEST_ATTEMPT_CHANGED", "The Test attempt changed while grading. Reload its results.");
    }
  };
  try {
    if (!items.length) throw new AppError(409, "TEST_ITEMS_REQUIRED", "The Test attempt has no activities to regrade.");
    for (const entry of items) {
      const testItemId = String(entry.testItemId);
      const item = parent.testItemAttempts.find((candidate) => candidate.testItemId === testItemId);
      const title = item?.activity.title ?? String(entry.title ?? "Activity");
      report(title);
      await assertUnchanged(prisma);
      try {
        if (!item || !["submitted", "graded"].includes(item.lifecycle)) {
          outcomes.push({ testItemId, title, status: "pending", message: "This activity has no submitted response to grade." });
          continue;
        }
        const key = item.activity.activityType.key;
        await assertActivityTypePluginEnabled(key);
        const handler = resolveCompositeExecutionRegradingHandler(key) ?? resolveCompositeExecutionSubmissionHandler(key);
        if (!handler) {
          outcomes.push({ testItemId, title, status: "pending", message: "This activity requires teacher grading." });
          continue;
        }
        const saved = asRecord(item.result);
        const state = asRecord(saved.state);
        const result = await handler({ user: learner, actor: user, feedback: asRecord(item.feedback),
          previousConfig: saved.configSnapshot ?? item.activity.config,
          courseId, groupId: parent.groupId, parentAttemptId, testItemId,
          activity: { ...item.activity, config: asRecord(item.activity.config), metadata: asRecord(item.activity.metadata) }, payload: state
        });
        const grade = result.gradingResult;
        if (grade && (!Number.isFinite(grade.rawScore) || !Number.isFinite(grade.rawMaxScore) || grade.rawMaxScore <= 0)) {
          throw new AppError(422, "TEST_ITEM_GRADING_RESULT_INVALID", "The activity returned an invalid score.");
        }
        const points = typeof entry.pointsPossible === "number" ? entry.pointsPossible : item.normalizedMaxScore ?? 0;
        await prisma.$transaction(async (tx) => {
          await lockTestAuthoring(tx, parent.activityId);
          await assertUnchanged(tx);
          const updated = await tx.testItemAttempt.update({ where: { id: item.id, updatedAt: item.updatedAt, lifecycle: item.lifecycle }, data: {
            ...(grade ? { lifecycle: "graded", gradedAt: new Date(), rawScore: grade.rawScore, rawMaxScore: grade.rawMaxScore,
              normalizedScore: grade.rawScore / grade.rawMaxScore * points, normalizedMaxScore: points } : {}),
            result: { ...saved, state: result.state, gradingConfigSnapshot: item.activity.config,
              ...(grade ? { analyticsPayload: grade.analyticsPayload ?? {}, metadata: grade.metadata ?? {} } : {}) } as Prisma.InputJsonValue,
            feedback: { ...asRecord(item.feedback), ...grade?.feedback } as Prisma.InputJsonValue
          } });
          await tx.courseAuditEvent.create({ data: { courseId, actorUserId: user.id,
            eventType: "test_item_regraded", targetType: "TestItemAttempt", targetId: item.id,
            previousValue: { lifecycle: item.lifecycle, result: item.result, feedback: item.feedback,
              rawScore: item.rawScore, rawMaxScore: item.rawMaxScore, normalizedScore: item.normalizedScore } as Prisma.InputJsonValue,
            nextValue: { lifecycle: updated.lifecycle, result: updated.result, feedback: updated.feedback,
              rawScore: updated.rawScore, rawMaxScore: updated.rawMaxScore, normalizedScore: updated.normalizedScore } as Prisma.InputJsonValue,
            metadata: { parentAttemptId, reason: reason ?? null, outcome: grade ? "graded" : "pending" }
          } });
        });
        outcomes.push({ testItemId, title, status: grade ? "graded" : "pending",
          ...(!grade ? { message: "Automatic grading is incomplete. Review this activity's tests or rubric." } : {}) });
      } catch (error) {
        if (error instanceof AppError && error.code === "TEST_ATTEMPT_CHANGED") throw error;
        if (!(error instanceof AppError)) console.error("Test child regrading failed", error);
        outcomes.push({ testItemId, title, status: "failed",
          message: error instanceof AppError ? error.message : "Automatic grading failed. Please retry this activity." });
      } finally { report(title); }
    }
    report(null);
    await assertUnchanged(prisma);
    const complete = outcomes.every((item) => item.status === "graded");
    const result = complete ? await recalculateTestAttemptGrade(user, courseId, parentAttemptId, reason) : null;
    report(null, total);
    return { result, items: outcomes,
      ...(!complete ? { deferred: "Some Test activities need attention. Successful results were saved; the Test total was left unchanged." } : {}) };
  } finally {
    await prisma.testSubmissionClaim.updateMany({ where: { parentAttemptId, status: "processing", updatedAt: claimedAt }, data: { status: "completed" } });
  }
}
