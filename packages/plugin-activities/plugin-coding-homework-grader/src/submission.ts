import { createHash, randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { AppError } from "@cognelo/core";
import type { CurrentUser } from "@cognelo/contracts";
import { Prisma, prisma } from "./db-client";
import { toStudentChallengeQuestionRecord } from "./generation";
import { appendProcessingEvent, buildProcessingEvent, buildProcessingOperationId } from "./processing";
import { normalizeCodingHomeworkSubmissionRequirements, validateCodingHomeworkArchive } from "./validation";
import { readCodingHomeworkZip, type CodingHomeworkZipEntry } from "./zip";

const SAFE_NAME_PATTERN = /[^a-zA-Z0-9._-]/g;

const submissionInputSchema = z.object({
  base64: z.string().min(1),
  documentationSnapshotId: z.string().trim().min(1).nullable().optional(),
  fileName: z.string().trim().min(1).max(240),
  idempotencyKey: z.string().trim().min(8).max(120).regex(/^[a-zA-Z0-9._:-]+$/).optional(),
  mimeType: z.string().trim().max(120).optional()
});

type SubmissionScope = {
  activityId: string;
  courseId: string;
  groupId: string;
  user: CurrentUser;
};

type SubmissionRow = {
  id: string;
  activityId: string;
  groupId: string;
  userId: string;
  coreAttemptId: string | null;
  documentationSnapshotId: string | null;
  zipAttachmentId: string | null;
  kind: string;
  status: string;
  structureValidationSummary: unknown;
  processingError: string | null;
  metadata: unknown;
  createdAt: Date;
  updatedAt: Date;
};

type SubmissionFileRow = {
  id: string;
  submissionId: string;
  path: string;
  languageKey: string | null;
  sizeBytes: bigint;
  sha256: string;
  storedName: string;
  metadata: unknown;
  createdAt: Date;
};

type SubmissionQuestionRow = {
  id: string;
  answerSubmittedAt: Date | null;
  orderIndex: number;
  questionText: string;
  studentAnswer: string | null;
  submissionId: string;
};

type SubmissionWithReplayData = SubmissionRow & {
  files: SubmissionFileRow[];
  questions: SubmissionQuestionRow[];
};

export async function getCodingHomeworkStudentAssignment(scope: SubmissionScope) {
  const [assignment, requirementSet, latestSubmission] = await Promise.all([
    prisma.pluginCodingHomeworkAssignment.findUnique({ where: { activityId: scope.activityId } }),
    prisma.pluginCodingHomeworkSubmissionRequirementSet.findUnique({ where: { activityId: scope.activityId } }),
    getLatestCodingHomeworkSubmission(scope)
  ]);
  const assignmentPdf = assignment?.promptPdfAttachmentId
    ? await prisma.pluginCodingHomeworkAttachment.findFirst({
        where: {
          id: assignment.promptPdfAttachmentId,
          ownerKind: "course_activity",
          ownerId: scope.activityId,
          kind: "assignment_pdf"
        }
      })
    : null;

  return {
    assignment: {
      languageKey: assignment?.languageKey ?? "c",
      promptMarkdown: assignment?.promptMarkdown ?? "",
      promptPdf: assignmentPdf
        ? {
            id: assignmentPdf.id,
            originalName: assignmentPdf.originalName,
            sizeBytes: Number(assignmentPdf.sizeBytes)
          }
        : null
    },
    latestSubmission,
    requirements: normalizeCodingHomeworkSubmissionRequirements(requirementSet?.requirements)
  };
}

export async function getLatestCodingHomeworkSubmission(scope: SubmissionScope) {
  const submission = await prisma.pluginCodingHomeworkSubmission.findFirst({
    where: {
      activityId: scope.activityId,
      groupId: scope.groupId,
      kind: "final",
      userId: scope.user.id
    },
    orderBy: { createdAt: "desc" },
    include: {
      files: { orderBy: { path: "asc" } },
      questions: { orderBy: { orderIndex: "asc" } }
    }
  });

  if (!submission) {
    return null;
  }

  return {
    files: submission.files.map(toSubmissionFileRecord),
    questions: submission.questions.map(toStudentChallengeQuestionRecord),
    submission: toSubmissionRecord(submission)
  };
}

export async function runCodingHomeworkSubmission(scope: SubmissionScope, input: unknown) {
  const parsed = submissionInputSchema.parse(input);
  assertZipUpload(parsed.fileName, parsed.mimeType, "Final submissions must be ZIP archives.");

  const requirements = await getCourseActivityRequirements(scope.activityId);
  const bytes = decodeUploadBytes(parsed.base64, requirements.maxArchiveBytes);
  const uploadFingerprint = createHash("sha256").update(bytes).digest("hex");
  const idempotencyKey = parsed.idempotencyKey?.trim() || null;
  const operationId = buildProcessingOperationId("submission", idempotencyKey);
  const existingSubmission = idempotencyKey ? await findIdempotentSubmission(scope, idempotencyKey) : null;
  if (existingSubmission) {
    const metadata = normalizeObject(existingSubmission.metadata);
    if (metadata.uploadFingerprint && metadata.uploadFingerprint !== uploadFingerprint) {
      throw new AppError(409, "CODING_HOMEWORK_IDEMPOTENCY_CONFLICT", "This upload retry key was already used for different file content.");
    }
    return {
      files: existingSubmission.files.map(toSubmissionFileRecord),
      idempotent: true,
      questions: existingSubmission.questions.map(toStudentChallengeQuestionRecord),
      submission: toSubmissionRecord(existingSubmission),
      summary: normalizeCodingHomeworkSubmissionSummary(existingSubmission.structureValidationSummary)
    };
  }

  const zip = readCodingHomeworkZip(bytes);
  const summary = await validateCodingHomeworkArchive({
    archiveSizeBytes: bytes.length,
    entries: zip.entries,
    requirements,
    zipDiagnostics: zip.diagnostics
  });
  const documentationSnapshotId = await resolveDocumentationSnapshotId(scope, parsed.documentationSnapshotId ?? null);

  if (!summary.isValid) {
    const invalidSubmission = await prisma.pluginCodingHomeworkSubmission.create({
      data: {
        activityId: scope.activityId,
        documentationSnapshotId,
        groupId: scope.groupId,
        kind: "final",
        metadata: appendProcessingEvent(
          {
            idempotencyKey,
            originalName: parsed.fileName,
            rejectedAt: new Date().toISOString(),
            uploadFingerprint
          },
          buildProcessingEvent({
            code: "CODING_HOMEWORK_SUBMISSION_INVALID_STRUCTURE",
            message: "Submission structure validation failed.",
            operationId,
            retryable: false,
            stage: "validation",
            status: "failed"
          })
        ) as Prisma.InputJsonValue,
        status: "invalid_structure",
        structureValidationSummary: summary as Prisma.InputJsonValue,
        userId: scope.user.id
      }
    });

    return {
      files: [],
      submission: toSubmissionRecord(invalidSubmission),
      summary
    };
  }

  const submission = await prisma.pluginCodingHomeworkSubmission.create({
    data: {
      activityId: scope.activityId,
      documentationSnapshotId,
      groupId: scope.groupId,
      kind: "final",
      metadata: {
        idempotencyKey,
        originalName: parsed.fileName,
        processingTimeline: [
          buildProcessingEvent({
            operationId,
            stage: "upload",
            status: "completed"
          })
        ],
        uploadFingerprint,
        uploadedAt: new Date().toISOString()
      } as Prisma.InputJsonValue,
      status: "validating",
      structureValidationSummary: summary as Prisma.InputJsonValue,
      userId: scope.user.id
    }
  });
  const zipAttachment = await createSubmissionZipAttachment(submission.id, {
    bytes,
    mimeType: parsed.mimeType || "application/zip",
    originalName: parsed.fileName
  });
  const files = await extractSubmissionFiles({
    entries: zip.entries,
    languageKey: requirements.languageKey,
    submissionId: submission.id,
    validFiles: new Set(summary.validFiles)
  });
  const updatedSubmission = await prisma.pluginCodingHomeworkSubmission.update({
    where: { id: submission.id },
    data: {
      metadata: {
        idempotencyKey,
        originalName: parsed.fileName,
        processingTimeline: [
          buildProcessingEvent({
            operationId,
            stage: "upload",
            status: "completed"
          }),
          buildProcessingEvent({
            operationId,
            stage: "extraction",
            status: "completed"
          })
        ],
        uploadFingerprint,
        uploadedAt: new Date().toISOString(),
        zipAttachmentId: zipAttachment.id,
        extractedFileCount: files.length,
        matchedFunctionCount: summary.validFunctions.length
      } as Prisma.InputJsonValue,
      status: "structure_valid",
      zipAttachmentId: zipAttachment.id
    }
  });

  return {
    files: files.map(toSubmissionFileRecord),
    submission: toSubmissionRecord(updatedSubmission),
    summary
  };
}

async function getCourseActivityRequirements(activityId: string) {
  const row = await prisma.pluginCodingHomeworkSubmissionRequirementSet.findUnique({ where: { activityId } });
  return normalizeCodingHomeworkSubmissionRequirements(row?.requirements);
}

async function findIdempotentSubmission(scope: SubmissionScope, idempotencyKey: string): Promise<SubmissionWithReplayData | null> {
  const submissions = await prisma.pluginCodingHomeworkSubmission.findMany({
    where: {
      activityId: scope.activityId,
      groupId: scope.groupId,
      kind: "final",
      userId: scope.user.id
    },
    orderBy: { createdAt: "desc" },
    take: 20,
    include: {
      files: { orderBy: { path: "asc" } },
      questions: { orderBy: { orderIndex: "asc" } }
    }
  });

  return submissions.find((submission) => normalizeObject(submission.metadata).idempotencyKey === idempotencyKey) ?? null;
}

function normalizeCodingHomeworkSubmissionSummary(value: unknown) {
  const summary = normalizeObject(value);
  return {
    fileCount: typeof summary.fileCount === "number" ? summary.fileCount : 0,
    ignoredFiles: Array.isArray(summary.ignoredFiles) ? summary.ignoredFiles.filter((item): item is string => typeof item === "string") : [],
    issues: Array.isArray(summary.issues) ? summary.issues : [],
    isValid: summary.isValid === true,
    matchedFunctions: Array.isArray(summary.matchedFunctions) ? summary.matchedFunctions : [],
    missingRequired: Array.isArray(summary.missingRequired) ? summary.missingRequired : [],
    parserDiagnostics: Array.isArray(summary.parserDiagnostics) ? summary.parserDiagnostics : [],
    unexpectedItems: Array.isArray(summary.unexpectedItems) ? summary.unexpectedItems : [],
    validFiles: Array.isArray(summary.validFiles) ? summary.validFiles.filter((item): item is string => typeof item === "string") : [],
    validFunctions: Array.isArray(summary.validFunctions) ? summary.validFunctions : []
  };
}

async function resolveDocumentationSnapshotId(scope: SubmissionScope, requestedSnapshotId: string | null) {
  if (requestedSnapshotId) {
    const snapshot = await prisma.pluginCodingHomeworkDocumentationSnapshot.findFirst({
      where: {
        id: requestedSnapshotId,
        activityId: scope.activityId,
        courseId: scope.courseId,
        OR: [{ groupId: scope.groupId }, { groupId: null }],
        status: "ready"
      }
    });
    if (!snapshot) {
      throw new AppError(400, "DOCUMENTATION_SNAPSHOT_NOT_FOUND", "The requested documentation snapshot is not available.");
    }
    return snapshot.id;
  }

  const groupSnapshot = await prisma.pluginCodingHomeworkDocumentationSnapshot.findFirst({
    where: {
      activityId: scope.activityId,
      courseId: scope.courseId,
      groupId: scope.groupId,
      status: "ready"
    },
    orderBy: { createdAt: "desc" }
  });
  if (groupSnapshot) {
    return groupSnapshot.id;
  }

  const courseSnapshot = await prisma.pluginCodingHomeworkDocumentationSnapshot.findFirst({
    where: {
      activityId: scope.activityId,
      courseId: scope.courseId,
      groupId: null,
      status: "ready"
    },
    orderBy: { createdAt: "desc" }
  });
  return courseSnapshot?.id ?? null;
}

function assertZipUpload(fileName: string, mimeType: string | undefined, message: string) {
  if (mimeType && mimeType !== "application/zip" && mimeType !== "application/x-zip-compressed") {
    throw new AppError(400, "CODING_HOMEWORK_ZIP_REQUIRED", message);
  }
  if (!fileName.toLowerCase().endsWith(".zip")) {
    throw new AppError(400, "CODING_HOMEWORK_ZIP_REQUIRED", message);
  }
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

async function createSubmissionZipAttachment(
  submissionId: string,
  input: {
    bytes: Buffer;
    mimeType: string;
    originalName: string;
  }
) {
  const originalName = input.originalName || "submission.zip";
  const storedName = `${submissionId}/${randomUUID()}-${safeFileName(originalName)}`;
  await writeStoredSubmissionFile(storedName, input.bytes);
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
      metadata: { temporary: false } as Prisma.InputJsonValue
    }
  });
}

async function extractSubmissionFiles(input: {
  entries: CodingHomeworkZipEntry[];
  languageKey: string;
  submissionId: string;
  validFiles: Set<string>;
}) {
  const rows: SubmissionFileRow[] = [];
  for (const entry of input.entries) {
    if (entry.isDirectory || !entry.content || !input.validFiles.has(entry.path)) {
      continue;
    }

    const storedName = `${input.submissionId}/files/${randomUUID()}-${safeFileName(path.posix.basename(entry.path))}`;
    await writeStoredSubmissionFile(storedName, entry.content);
    const sha256 = createHash("sha256").update(entry.content).digest("hex");
    const languageKey = isLikelySourceForLanguage(entry.path, input.languageKey) ? input.languageKey : null;
    const row = await prisma.pluginCodingHomeworkSubmissionFile.create({
      data: {
        languageKey,
        metadata: {
          compressedSize: entry.compressedSize,
          originalPath: entry.path,
          sourceKind: languageKey ? "source" : "non_source",
          uncompressedSize: entry.uncompressedSize
        } as Prisma.InputJsonValue,
        path: entry.path,
        sha256,
        sizeBytes: BigInt(entry.content.length),
        storedName,
        submissionId: input.submissionId
      }
    });
    rows.push(row);
  }
  return rows;
}

async function writeStoredSubmissionFile(storedName: string, bytes: Buffer) {
  const destination = path.join(submissionStorageDir(), ...storedName.split("/"));
  await mkdir(path.dirname(destination), { recursive: true });
  await writeFile(destination, bytes);
}

function submissionStorageDir() {
  return path.join(process.cwd(), "../../storage/coding-homework-grader/submissions");
}

function safeFileName(fileName: string) {
  const safe = fileName.replace(SAFE_NAME_PATTERN, "_").replace(/^_+/, "");
  return safe || "upload";
}

function isLikelySourceForLanguage(filePath: string, languageKey: string) {
  if (languageKey === "c") {
    return /\.(c|h)$/i.test(filePath);
  }
  return true;
}

function toSubmissionRecord(row: SubmissionRow) {
  return {
    id: row.id,
    activityId: row.activityId,
    coreAttemptId: row.coreAttemptId,
    createdAt: row.createdAt.toISOString(),
    documentationSnapshotId: row.documentationSnapshotId,
    groupId: row.groupId,
    kind: row.kind,
    metadata: normalizeObject(row.metadata),
    processingError: row.processingError,
    status: row.status,
    structureValidationSummary: normalizeObject(row.structureValidationSummary),
    updatedAt: row.updatedAt.toISOString(),
    userId: row.userId,
    zipAttachmentId: row.zipAttachmentId
  };
}

function toSubmissionFileRecord(row: SubmissionFileRow) {
  return {
    id: row.id,
    createdAt: row.createdAt.toISOString(),
    languageKey: row.languageKey,
    metadata: normalizeObject(row.metadata),
    path: row.path,
    sha256: row.sha256,
    sizeBytes: Number(row.sizeBytes),
    storedName: row.storedName,
    submissionId: row.submissionId
  };
}

function normalizeObject(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}
