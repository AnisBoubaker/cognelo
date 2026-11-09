import { Prisma, prisma } from "./db-client";

export async function markCodingHomeworkSubmissionDeleted(input: {
  activityId: string;
  coreAttemptId: string;
  deletedAt: Date | string;
  deletedByUserId: string;
  groupId: string;
  pluginAttemptRef: string | null;
  reason: string;
}) {
  if (!input.pluginAttemptRef) {
    return;
  }

  const submission = await prisma.pluginCodingHomeworkSubmission.findFirst({
    where: {
      id: input.pluginAttemptRef,
      activityId: input.activityId,
      groupId: input.groupId,
      coreAttemptId: input.coreAttemptId,
      kind: "final"
    }
  });
  if (!submission) {
    return;
  }

  if (!submission.workspaceId) await prisma.$executeRaw`UPDATE "PluginCodingHomeworkDraft" d SET "preparationStartedAt"=NULL
    WHERE d."activityId"=${input.activityId} AND d."groupId"=${input.groupId} AND d."userId"=${submission.userId}
    AND NOT EXISTS(SELECT 1 FROM "PluginCodingHomeworkSubmission" newer WHERE newer."activityId"=d."activityId" AND newer."groupId"=d."groupId" AND newer."userId"=d."userId" AND newer.kind='final' AND newer."createdAt">${submission.createdAt})`;
  await prisma.pluginCodingHomeworkSubmission.update({
    where: { id: submission.id },
    data: {
      coreAttemptId: null,
      metadata: {
        ...normalizeObject(submission.metadata),
        deletion: {
          coreAttemptId: input.coreAttemptId,
          deletedAt: toIsoString(input.deletedAt),
          deletedByUserId: input.deletedByUserId,
          reason: input.reason
        }
      } as Prisma.InputJsonValue,
      processingError: null
    }
  });
}

export function isCodingHomeworkSubmissionDeleted(metadata: unknown) {
  return Boolean(normalizeObject(metadata).deletion);
}

function toIsoString(value: Date | string) {
  return value instanceof Date ? value.toISOString() : value;
}

function normalizeObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}
