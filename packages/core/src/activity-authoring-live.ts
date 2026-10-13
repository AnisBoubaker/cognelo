import { createHash } from "node:crypto";
import { LiveActivityChangeSchema, type CurrentUser } from "@cognelo/contracts";
import { prisma, type Prisma } from "@cognelo/db";
import { assertCanManageCourse } from "./authorization";
import { confirmLiveActivitySettings } from "./activity-settings-live";
import { AppError, notFound } from "./errors";

export type ActivityAuthoringTransaction = Pick<Prisma.TransactionClient, "$executeRaw" | "$queryRaw">;

export async function lockTestAuthoring(tx: ActivityAuthoringTransaction, activityId: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`test-authoring:${activityId}`}, 0))`;
}

/** Plugin private writes use the supplied SQL transaction, keeping their tables plugin-owned. */
export async function withActivityAuthoringChange<T>(
  user: CurrentUser, courseId: string, activityId: string, input: unknown,
  mutate: (tx: Prisma.TransactionClient) => Promise<T>,
  options: { eventType?: string; privateChange?: { before: unknown; after: unknown } } = {}
): Promise<T> {
  await assertCanManageCourse(user, courseId);
  const confirmation = LiveActivityChangeSchema.parse(input ?? {});
  return prisma.$transaction(async (tx) => {
    const identity = await tx.activity.findFirst({ where: { id: activityId, courseId },
      select: { id: true, testItem: { select: { test: { select: { activityId: true } } } } } });
    if (!identity) throw notFound("Activity");
    const parentId = identity.testItem?.test.activityId ?? identity.id;
    await lockTestAuthoring(tx, parentId);
    const activity = await tx.activity.findFirstOrThrow({ where: { id: activityId, courseId },
      include: { testItem: true, testDefinition: { include: { items: true } } } });
    if (await tx.testSubmissionClaim.findFirst({ where: { status: "processing", parentAttempt: { activityId: parentId } } })) {
      throw new AppError(409, "TEST_SUBMISSION_IN_PROGRESS", "A Test submission is being graded. Please try saving again shortly.");
    }
    await confirmLiveActivitySettings(tx, user, courseId, parentId, confirmation);
    const result = await mutate(tx);
    // A previously interrupted submission may have graded some children. They
    // must be graded against the correction on retry, retaining the old evidence.
    const partials = await tx.testItemAttempt.findMany({ where: {
      parentAttempt: { activityId: parentId, lifecycle: "started" }, lifecycle: { in: ["submitted", "graded"] }
    } });
    for (const item of partials) {
      const previous = item.result && typeof item.result === "object" && !Array.isArray(item.result) ? item.result as Record<string, unknown> : {};
      const { previousEvaluations = [], ...previousResult } = previous;
      await tx.testItemAttempt.update({ where: { id: item.id }, data: {
        lifecycle: "started", rawScore: null, rawMaxScore: null, normalizedScore: null, normalizedMaxScore: null,
        submittedAt: null, gradedAt: null,
        result: { ...previousResult, previousEvaluations: [...(Array.isArray(previousEvaluations) ? previousEvaluations : []),
          { rawScore: item.rawScore, rawMaxScore: item.rawMaxScore, feedback: item.feedback, submittedAt: item.submittedAt?.toISOString() ?? null, gradedAt: item.gradedAt?.toISOString() ?? null, result: previousResult }] } as Prisma.InputJsonValue
      } });
    }
    const updated = await tx.activity.findUniqueOrThrow({ where: { id: activityId },
      include: { testItem: true, testDefinition: { include: { items: true } } } });
    await tx.courseAuditEvent.create({ data: {
      courseId, actorUserId: user.id, eventType: options.eventType ?? "activity_content_updated",
      targetType: "activity", targetId: activityId,
      previousValue: (options.privateChange ? { fingerprint: hash(options.privateChange.before) } : snapshot(activity)) as Prisma.InputJsonValue,
      nextValue: (options.privateChange ? { fingerprint: hash(options.privateChange.after) } : snapshot(updated)) as Prisma.InputJsonValue,
      metadata: { parentActivityId: parentId, privateAuthoring: Boolean(options.privateChange) }
    } });
    return result;
  }, { timeout: 30_000 });
}

function snapshot(activity: { title: string; description: string; config: unknown; metadata: unknown; testItem?: unknown; testDefinition?: unknown }) {
  return JSON.parse(JSON.stringify({ title: activity.title, description: activity.description, config: activity.config,
    metadata: activity.metadata, testItem: activity.testItem, test: activity.testDefinition }));
}
function hash(value: unknown) { return createHash("sha256").update(JSON.stringify(value ?? null)).digest("hex"); }
