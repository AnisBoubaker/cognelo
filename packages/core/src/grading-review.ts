import { createHash } from "node:crypto";
import { prisma, Prisma } from "@cognelo/db";
import { getActivityPluginForActivityType } from "@cognelo/activity-sdk";
import { GradingReviewRequestSchema, type CurrentUser, type GradingReview, type GradingReviewRequest } from "@cognelo/contracts";
import { assertCanGradeGroup } from "./authorization";
import { AppError, notFound } from "./errors";

type ReadDatabase = Pick<Prisma.TransactionClient, "$queryRaw">;
type ReviewRow = Omit<GradingReview, "requestedAt" | "resolvedAt"> & { requestedAt: Date; resolvedAt: Date | null };
function dto(row: ReviewRow): GradingReview {
  return { id: row.id, attemptId: row.attemptId, testItemAttemptId: row.testItemAttemptId,
    status: row.status, reasonCode: row.reasonCode, message: row.message, version: row.version,
    requestedAt: row.requestedAt.toISOString(), resolvedAt: row.resolvedAt?.toISOString() ?? null };
}

/** Batch, sparse review lookup. No plugin evidence or private configuration is read by core. */
export async function getActivityGradingReviews(attemptIds: readonly string[], database: ReadDatabase = prisma, requiredOnly = true): Promise<GradingReview[]> {
  if (!attemptIds.length) return [];
  const rows = await database.$queryRaw<ReviewRow[]>`SELECT r.id,r."attemptId",r."testItemAttemptId",r.status,r."reasonCode",r.message,r.version,r."requestedAt",r."resolvedAt"
    FROM "ActivityGradingReview" r WHERE r."attemptId" IN (SELECT jsonb_array_elements_text(${JSON.stringify(attemptIds)}::jsonb))
      AND (${requiredOnly}=false OR r.status='required') ORDER BY r."requestedAt",r.id`;
  return (rows ?? []).map(dto);
}

export function gradingReviewRevision(reviews: readonly GradingReview[]) {
  const required = reviews.filter(review => review.status === "required");
  return required.length ? createHash("sha256").update(JSON.stringify(required.map(review => [review.id, review.version]).sort((a, b) => String(a[0]).localeCompare(String(b[0]))))).digest("hex") : null;
}

export async function getGradebookGradingReviews(gradebookItemId: string, participantId: string, database: ReadDatabase = prisma) {
  const attempts = await database.$queryRaw<Array<{ id: string }>>`SELECT id FROM "ActivityAttempt" WHERE "gradebookItemId"=${gradebookItemId}
    AND "participantId"=${participantId} AND "assessmentMode"='summative' AND lifecycle IN ('submitted','graded') ORDER BY id`;
  return getActivityGradingReviews((attempts ?? []).map(attempt => attempt.id), database);
}

export async function assertNoRequiredGradingReview(attemptId: string, database: ReadDatabase = prisma, testItemAttemptId?: string) {
  const reviews = await getActivityGradingReviews([attemptId], database);
  if (reviews.some(review => !testItemAttemptId || review.testItemAttemptId === null || review.testItemAttemptId === testItemAttemptId)) {
    throw new AppError(409, "GRADING_REVIEW_REQUIRED", "This submission requires teacher review before automatic grading can be completed.");
  }
}

export async function requestActivityGradingReview(user: CurrentUser, input: {
  attemptId: string; testItemAttemptId?: string; review: GradingReviewRequest;
}, transaction?: Prisma.TransactionClient): Promise<GradingReview> {
  const request = GradingReviewRequestSchema.parse(input.review);
  const database = transaction ?? prisma;
  const attempt = await database.activityAttempt.findUnique({ where: { id: input.attemptId },
    include: { activity: { select: { activityType: { select: { key: true } } } } } });
  if (!attempt || attempt.lifecycle === "deleted") throw notFound("Activity attempt");
  if (attempt.userId !== user.id) await assertCanGradeGroup(user, attempt.courseId, attempt.groupId);
  const child = input.testItemAttemptId ? await database.testItemAttempt.findFirst({ where: { id: input.testItemAttemptId, parentAttemptId: attempt.id },
    include: { activity: { select: { activityType: { select: { key: true } } } } } }) : null;
  if (input.testItemAttemptId && (!child || child.lifecycle === "started" || child.lifecycle === "deleted")) throw notFound("Submitted Test response");
  if (!["submitted", "graded"].includes(attempt.lifecycle)) throw new AppError(409, "SUBMISSION_NOT_COMPLETED", "Submit the attempt before requesting grading review.");
  const activityTypeKey = child?.activity.activityType.key ?? attempt.activity.activityType.key;
  const pluginKey = getActivityPluginForActivityType(activityTypeKey)?.key ?? `core:${activityTypeKey}`;
  const targetKey = child ? `test-item:${child.id}` : `attempt:${attempt.id}`;
  const write = async (tx: Prisma.TransactionClient) => {
    await tx.$queryRaw`SELECT id FROM "ActivityAttempt" WHERE id=${attempt.id} FOR UPDATE`;
    const previous = await tx.activityGradingReview.findUnique({ where: { targetKey } });
    if (previous && previous.reasonCode === request.reasonCode && previous.evidenceRef && previous.evidenceRef === request.evidenceRef) return dto(previous as ReviewRow);
    const review = await tx.activityGradingReview.upsert({ where: { targetKey },
      create: { targetKey, attemptId: attempt.id, testItemAttemptId: child?.id, pluginKey, ...request },
      update: { ...request, status: "required", version: { increment: 1 }, requestedAt: new Date(), resolvedAt: null, resolvedByUserId: null } });
    // Review drafts use these timestamps for optimistic concurrency.
    if (!child) await tx.activityAttempt.update({ where: { id: attempt.id, updatedAt: attempt.updatedAt, lifecycle: { in: ["submitted", "graded"] } }, data: { updatedAt: new Date() } });
    if (child) await tx.testItemAttempt.update({ where: { id: child.id, updatedAt: child.updatedAt, lifecycle: { in: ["submitted", "graded"] } }, data: { updatedAt: new Date() } });
    await tx.courseAuditEvent.create({ data: { courseId: attempt.courseId, actorUserId: user.id,
      eventType: "grading_review_requested", targetType: child ? "TestItemAttempt" : "ActivityAttempt", targetId: child?.id ?? attempt.id,
      previousValue: previous ? dto(previous as ReviewRow) as unknown as Prisma.InputJsonValue : Prisma.JsonNull,
      nextValue: dto(review as ReviewRow) as unknown as Prisma.InputJsonValue } });
    return dto(review as ReviewRow);
  };
  return transaction ? write(transaction) : prisma.$transaction(write);
}

/** Called inside an authorized teacher final-grade transaction; a whole-activity override resolves all its reviews. */
export async function resolveGradebookGradingReviews(tx: Prisma.TransactionClient, input: {
  gradebookItemId: string; participantId: string; courseId: string; userId: string; expectedRevision?: string | null;
}) {
  await tx.$queryRaw`SELECT id FROM "ActivityAttempt" WHERE "gradebookItemId"=${input.gradebookItemId} AND "participantId"=${input.participantId} ORDER BY id FOR UPDATE`;
  const reviews = await getGradebookGradingReviews(input.gradebookItemId, input.participantId, tx);
  const revision = gradingReviewRevision(reviews);
  if ((revision !== null || input.expectedRevision !== undefined) && input.expectedRevision !== revision) {
    throw new AppError(409, "GRADING_REVIEW_CHANGED", "The required grading reviews changed. Reload the submission before setting its final grade.");
  }
  for (const review of reviews) await resolveReview(tx, review, input.courseId, input.userId);
}

export async function resolveTestItemGradingReview(tx: Prisma.TransactionClient, input: { parentAttemptId: string; testItemAttemptId: string; courseId: string; userId: string }) {
  const reviews = await getActivityGradingReviews([input.parentAttemptId], tx);
  for (const review of reviews.filter(review => review.testItemAttemptId === input.testItemAttemptId)) await resolveReview(tx, review, input.courseId, input.userId);
}

/** A teacher reopening a submission withdraws its old review along with the old grade. */
export async function withdrawActivityGradingReviews(tx: Prisma.TransactionClient, input: { attemptId: string; courseId: string; userId: string }) {
  const reviews = await getActivityGradingReviews([input.attemptId], tx);
  for (const review of reviews) await resolveReview(tx, review, input.courseId, input.userId, "grading_review_withdrawn");
}

async function resolveReview(tx: Prisma.TransactionClient, review: GradingReview, courseId: string, userId: string, eventType = "grading_review_resolved") {
  const next = await tx.activityGradingReview.update({ where: { id: review.id, version: review.version, status: "required" },
    data: { status: "resolved", version: { increment: 1 }, resolvedAt: new Date(), resolvedByUserId: userId } });
  await tx.courseAuditEvent.create({ data: { courseId, actorUserId: userId, eventType,
    targetType: review.testItemAttemptId ? "TestItemAttempt" : "ActivityAttempt", targetId: review.testItemAttemptId ?? review.attemptId,
    previousValue: review as unknown as Prisma.InputJsonValue, nextValue: dto(next as ReviewRow) as unknown as Prisma.InputJsonValue } });
}
