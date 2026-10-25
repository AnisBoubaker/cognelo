import { mkdir, statfs, unlink } from "node:fs/promises";
import path from "node:path";
import { AppError, consumeRateLimits } from "@cognelo/core";

export type UploadTransaction = {
  $executeRaw(query: TemplateStringsArray, ...values: unknown[]): Promise<number>;
  $queryRaw<T = unknown>(query: TemplateStringsArray, ...values: unknown[]): Promise<T>;
};

export async function limitHomeworkUploads(activityId: string, userId: string) {
  await consumeRateLimits([
    { scope: "homework-upload-user", subject: userId, limit: 20, windowMs: 60_000 },
    { scope: "homework-upload-activity", subject: activityId, limit: 100, windowMs: 60_000 }
  ]);
}

export async function lockHomeworkUploadBudget(tx: UploadTransaction, activityId: string, userId: string, incomingBytes: number) {
  await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtextextended(${JSON.stringify(["homework-upload", activityId, userId])}, 0))`;
  // Serialize the final free-space check with physical writes across workers.
  await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtextextended('homework-storage-space', 0))`;
  const root = path.resolve(process.cwd(), "../../storage/coding-homework-grader");
  await mkdir(root, { recursive: true, mode: 0o750 });
  const expired = await tx.$queryRaw<Array<{ id: string }>>`SELECT id FROM "PluginCodingHomeworkSubmission"
    WHERE "activityId" = ${activityId} AND "userId" = ${userId} AND kind = 'preflight' AND "coreAttemptId" IS NULL
      AND (metadata->>'expiresAt')::timestamptz <= NOW() ORDER BY "createdAt" LIMIT 100`;
  if (expired.length) {
    const ids = expired.map((row) => row.id);
    const attachments = await tx.$queryRaw<Array<{ storedName: string }>>`SELECT "storedName" FROM "PluginCodingHomeworkAttachment" WHERE "ownerKind" = 'submission' AND "ownerId" = ANY(${ids}::text[])`;
    for (const attachment of attachments) {
      if (!/^[a-f0-9-]{36}-[A-Za-z0-9._-]+$/.test(attachment.storedName)) continue;
      await unlink(path.join(root, "preflight", attachment.storedName)).catch((error: NodeJS.ErrnoException) => { if (error.code !== "ENOENT") throw error; });
    }
    await tx.$executeRaw`DELETE FROM "PluginCodingHomeworkAttachment" WHERE "ownerKind" = 'submission' AND "ownerId" = ANY(${ids}::text[])`;
    await tx.$executeRaw`DELETE FROM "PluginCodingHomeworkSubmission" WHERE id = ANY(${ids}::text[]) AND kind = 'preflight'`;
  }
  const space = await statfs(root, { bigint: true });
  if (space.bavail * space.bsize < BigInt(incomingBytes) + 1024n * 1024n * 1024n) throw new AppError(507, "UPLOAD_STORAGE_UNAVAILABLE", "Upload storage is low. Contact your course staff.");
  const [usage] = await tx.$queryRaw<Array<{ bytes: bigint }>>`
    SELECT (
      COALESCE((SELECT SUM(a."sizeBytes") FROM "PluginCodingHomeworkAttachment" a
        JOIN "PluginCodingHomeworkSubmission" s ON a."ownerId" = s.id AND a."ownerKind" = 'submission'
        WHERE s."activityId" = ${activityId} AND s."userId" = ${userId}), 0)
      + COALESCE((SELECT SUM(f."sizeBytes") FROM "PluginCodingHomeworkSubmissionFile" f
        JOIN "PluginCodingHomeworkSubmission" s ON f."submissionId" = s.id
        WHERE s."activityId" = ${activityId} AND s."userId" = ${userId}), 0)
      + COALESCE((SELECT SUM(octet_length(s.metadata::text) + octet_length(s."structureValidationSummary"::text)) FROM "PluginCodingHomeworkSubmission" s
        WHERE s."activityId" = ${activityId} AND s."userId" = ${userId}), 0)
      + COALESCE((SELECT SUM(octet_length(f."functionCode") + octet_length(f."astText") + octet_length(f.embedding::text) + octet_length(f."nearestExamples"::text)) FROM "PluginCodingHomeworkSubmissionFunction" f
        JOIN "PluginCodingHomeworkSubmission" s ON f."submissionId" = s.id WHERE s."activityId" = ${activityId} AND s."userId" = ${userId}), 0)
      + COALESCE((SELECT SUM(octet_length(q."questionText") + COALESCE(octet_length(q."studentAnswer"), 0) + octet_length(q.metadata::text) + octet_length(q."nearestExamples"::text)) FROM "PluginCodingHomeworkChallengeQuestion" q
        JOIN "PluginCodingHomeworkSubmission" s ON q."submissionId" = s.id WHERE s."activityId" = ${activityId} AND s."userId" = ${userId}), 0)
    )::bigint AS bytes`;
  if (Number(usage.bytes) + incomingBytes > 1024 * 1024 * 1024) throw new AppError(413, "HOMEWORK_STORAGE_LIMIT", "The storage allowance for this assignment has been reached. Contact your course staff.");
}

const processState = globalThis as typeof globalThis & { cogneloHomeworkUploads?: { active: number } };
const uploads = processState.cogneloHomeworkUploads ??= { active: 0 };
export function acquireHomeworkUploadSlot() {
  if (uploads.active >= 2) throw new AppError(429, "UPLOAD_CAPACITY_REACHED", "Uploads are busy. Try again shortly.", { retryAfterSeconds: 2 });
  uploads.active++;
  return () => { uploads.active--; };
}
