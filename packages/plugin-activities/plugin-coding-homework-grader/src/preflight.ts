import { createHash, randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { AppError } from "@cognelo/core";
import type { CurrentUser } from "@cognelo/contracts";
import { Prisma, prisma } from "./db-client";
import { normalizeCodingHomeworkSubmissionRequirements, validateCodingHomeworkArchive } from "./validation";
import { readCodingHomeworkZip } from "./zip";

const PREVIEW_GROUP_ID = "__course__";
const SAFE_NAME_PATTERN = /[^a-zA-Z0-9._-]/g;

const preflightInputSchema = z.object({
  base64: z.string().min(1),
  fileName: z.string().trim().min(1).max(240),
  mimeType: z.string().trim().max(120).optional()
});

type PreflightScope = {
  activityId: string;
  courseId: string;
  groupId?: string | null;
  user: CurrentUser;
};

export async function runCodingHomeworkPreflight(scope: PreflightScope, input: unknown) {
  const parsed = preflightInputSchema.parse(input);
  if (parsed.mimeType && parsed.mimeType !== "application/zip" && parsed.mimeType !== "application/x-zip-compressed") {
    throw new AppError(400, "CODING_HOMEWORK_ZIP_REQUIRED", "Preflight uploads must be ZIP archives.");
  }
  if (!parsed.fileName.toLowerCase().endsWith(".zip")) {
    throw new AppError(400, "CODING_HOMEWORK_ZIP_REQUIRED", "Preflight uploads must be ZIP archives.");
  }

  const requirements = await getCourseActivityRequirements(scope.activityId);
  const bytes = decodeUploadBytes(parsed.base64, requirements.maxArchiveBytes);
  const zip = readCodingHomeworkZip(bytes);
  const summary = await validateCodingHomeworkArchive({
    archiveSizeBytes: bytes.length,
    entries: zip.entries,
    requirements,
    zipDiagnostics: zip.diagnostics
  });

  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const submission = await prisma.pluginCodingHomeworkSubmission.create({
    data: {
      activityId: scope.activityId,
      groupId: scope.groupId ?? PREVIEW_GROUP_ID,
      userId: scope.user.id,
      kind: "preflight",
      status: summary.isValid ? "structure_valid" : "invalid_structure",
      structureValidationSummary: summary as Prisma.InputJsonValue,
      metadata: {
        expiresAt,
        originalName: parsed.fileName,
        temporary: true
      } as Prisma.InputJsonValue
    }
  });
  const attachment = await createPreflightAttachment(submission.id, {
    bytes,
    mimeType: parsed.mimeType || "application/zip",
    originalName: parsed.fileName
  });
  await prisma.pluginCodingHomeworkSubmission.update({
    where: { id: submission.id },
    data: {
      zipAttachmentId: attachment.id,
      metadata: {
        expiresAt,
        originalName: parsed.fileName,
        temporary: true,
        zipAttachmentId: attachment.id
      } as Prisma.InputJsonValue
    }
  });

  return {
    preflight: {
      id: submission.id,
      activityId: submission.activityId,
      groupId: submission.groupId,
      userId: submission.userId,
      kind: submission.kind,
      status: summary.isValid ? "structure_valid" : "invalid_structure",
      expiresAt,
      zipAttachmentId: attachment.id,
      createdAt: submission.createdAt.toISOString(),
      updatedAt: submission.updatedAt.toISOString()
    },
    summary
  };
}

async function getCourseActivityRequirements(activityId: string) {
  const row = await prisma.pluginCodingHomeworkSubmissionRequirementSet.findUnique({ where: { activityId } });
  return normalizeCodingHomeworkSubmissionRequirements(row?.requirements);
}

function decodeUploadBytes(base64: string, maxBytes: number) {
  const bytes = Buffer.from(base64, "base64");
  if (!bytes.length) {
    throw new AppError(400, "UPLOAD_EMPTY", "Uploaded file is empty.");
  }
  if (bytes.length > maxBytes) {
    throw new AppError(413, "UPLOAD_TOO_LARGE", "Uploaded file is too large.");
  }
  return bytes;
}

async function createPreflightAttachment(
  submissionId: string,
  input: {
    bytes: Buffer;
    mimeType: string;
    originalName: string;
  }
) {
  const originalName = input.originalName || "preflight.zip";
  const storedName = `${randomUUID()}-${originalName.replace(SAFE_NAME_PATTERN, "_")}`;
  await mkdir(fileStorageDir(), { recursive: true });
  await writeFile(path.join(fileStorageDir(), storedName), input.bytes);
  const sha256 = createHash("sha256").update(input.bytes).digest("hex");

  return prisma.pluginCodingHomeworkAttachment.create({
    data: {
      ownerKind: "submission",
      ownerId: submissionId,
      kind: "submission_zip",
      originalName,
      storedName,
      mimeType: input.mimeType,
      sizeBytes: BigInt(input.bytes.length),
      sha256,
      metadata: { temporary: true } as Prisma.InputJsonValue
    }
  });
}

function fileStorageDir() {
  return path.join(process.cwd(), "../../storage/coding-homework-grader/preflight");
}
