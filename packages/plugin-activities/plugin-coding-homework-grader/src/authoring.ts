import { createHash, randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { AppError } from "@cognelo/core";
import { Prisma, prisma } from "./db-client";

const MAX_ASSIGNMENT_PDF_BYTES = 25 * 1024 * 1024;
const MAX_PROVIDED_FILE_BYTES = 25 * 1024 * 1024;
const MAX_REQUIREMENTS_UPLOAD_BYTES = 2 * 1024 * 1024;
const SAFE_NAME_PATTERN = /[^a-zA-Z0-9._-]/g;

const pathRequirementSchema = z.object({
  path: z.string().trim().min(1).max(500),
  description: z.string().trim().max(1000).optional()
});

const functionRequirementSchema = z.object({
  name: z.string().trim().min(1).max(160),
  filePath: z.string().trim().min(1).max(500).optional(),
  description: z.string().trim().max(1000).optional(),
  required: z.boolean().default(true)
});

export const codingHomeworkSubmissionRequirementsSchema = z.object({
  allowedExtensions: z.array(z.string().trim().min(1).max(24)).default([".c", ".h"]),
  ignoredPaths: z.array(z.string().trim().min(1).max(500)).default([]),
  languageKey: z.string().trim().min(1).max(40).default("c"),
  maxArchiveBytes: z.number().int().min(1).max(250 * 1024 * 1024).default(25 * 1024 * 1024),
  maxFileCount: z.number().int().min(1).max(10000).default(200),
  requiredFiles: z.array(pathRequirementSchema).default([]),
  requiredFolders: z.array(pathRequirementSchema).default([]),
  requiredFunctions: z.array(functionRequirementSchema).default([])
});

const assignmentInputSchema = z.object({
  candidateLimit: z.number().int().min(1).max(50).default(5),
  generationInstructions: z.string().max(12000).default(""),
  languageKey: z.string().trim().min(1).max(40).default("c"),
  promptMarkdown: z.string().max(50000).default(""),
  promptPdfAttachmentId: z.string().nullable().optional(),
  questionCount: z.number().int().min(1).max(20).default(3),
  retrievedExampleCount: z.number().int().min(1).max(20).default(3),
  settings: z.record(z.unknown()).default({})
});

export const codingHomeworkAuthoringInputSchema = z.object({
  assignment: assignmentInputSchema,
  requirements: codingHomeworkSubmissionRequirementsSchema
});

export const codingHomeworkFileUploadInputSchema = z.object({
  base64: z.string().min(1),
  fileName: z.string().trim().min(1).max(240),
  mimeType: z.string().trim().max(120).optional()
});

export type CodingHomeworkAuthoringRecord = Awaited<ReturnType<typeof getCodingHomeworkAuthoring>>;
export type CodingHomeworkSubmissionRequirements = z.infer<typeof codingHomeworkSubmissionRequirementsSchema>;

type OwnerContext =
  | {
      ownerKind: "course_activity";
      ownerId: string;
    }
  | {
      ownerKind: "bank_activity";
      ownerId: string;
    };

type AssignmentRow = {
  id: string;
  promptMarkdown: string;
  promptPdfAttachmentId: string | null;
  languageKey: string;
  candidateLimit: number;
  retrievedExampleCount: number;
  questionCount: number;
  generationInstructions: string;
  settings: unknown;
  createdAt: Date;
  updatedAt: Date;
};

type RequirementSetRow = {
  id: string;
  languageKey: string;
  requirements: unknown;
  sourceAttachmentId: string | null;
  metadata: unknown;
  createdAt: Date;
  updatedAt: Date;
};

type AttachmentRow = {
  id: string;
  ownerKind: "course_activity" | "bank_activity" | "submission";
  ownerId: string;
  kind: "assignment_pdf" | "provided_file" | "requirements_upload" | "submission_zip" | "extracted_source" | "extracted_non_source";
  originalName: string;
  storedName: string;
  mimeType: string | null;
  sizeBytes: bigint;
  sha256: string;
  metadata: unknown;
  createdAt: Date;
  updatedAt: Date;
};

export async function getCodingHomeworkAuthoring(owner: OwnerContext) {
  const [assignment, requirementSet] = await Promise.all([findAssignment(owner), findRequirementSet(owner)]);
  const attachmentIds = [assignment?.promptPdfAttachmentId, requirementSet?.sourceAttachmentId].filter(Boolean) as string[];
  const attachments = attachmentIds.length
    ? await prisma.pluginCodingHomeworkAttachment.findMany({
        where: {
          id: { in: attachmentIds },
          ownerKind: owner.ownerKind,
          ownerId: owner.ownerId
        }
      })
    : [];

  const providedFiles = await prisma.pluginCodingHomeworkAttachment.findMany({
    where: {
      ownerKind: owner.ownerKind,
      ownerId: owner.ownerId,
      kind: "provided_file"
    },
    orderBy: [{ originalName: "asc" }, { createdAt: "asc" }]
  });

  return {
    assignment: toAssignmentRecord(assignment),
    assignmentPdf: assignment?.promptPdfAttachmentId ? toAttachmentRecord(attachments.find((attachment) => attachment.id === assignment.promptPdfAttachmentId)) : null,
    requirements: toRequirementRecord(requirementSet),
    requirementsUpload: requirementSet?.sourceAttachmentId
      ? toAttachmentRecord(attachments.find((attachment) => attachment.id === requirementSet.sourceAttachmentId))
      : null,
    providedFiles: providedFiles.map((attachment) => toAttachmentRecord(attachment)).filter(Boolean)
  };
}

export async function saveCodingHomeworkAuthoring(owner: OwnerContext, input: unknown) {
  const parsed = codingHomeworkAuthoringInputSchema.parse(input);
  const assignment = parsed.assignment;
  const requirements = parsed.requirements;

  await prisma.$transaction(async (transaction) => {
    if (owner.ownerKind === "course_activity") {
      await transaction.pluginCodingHomeworkAssignment.upsert({
        where: { activityId: owner.ownerId },
        create: {
          activityId: owner.ownerId,
          ...assignment,
          promptPdfAttachmentId: assignment.promptPdfAttachmentId ?? null,
          settings: assignment.settings as Prisma.InputJsonValue
        },
        update: {
          ...assignment,
          promptPdfAttachmentId: assignment.promptPdfAttachmentId ?? null,
          settings: assignment.settings as Prisma.InputJsonValue
        }
      });
      await transaction.pluginCodingHomeworkSubmissionRequirementSet.upsert({
        where: { activityId: owner.ownerId },
        create: {
          activityId: owner.ownerId,
          languageKey: requirements.languageKey,
          requirements: requirements as Prisma.InputJsonValue
        },
        update: {
          languageKey: requirements.languageKey,
          requirements: requirements as Prisma.InputJsonValue
        }
      });
      return;
    }

    await transaction.pluginBankCodingHomeworkAssignment.upsert({
      where: { bankActivityId: owner.ownerId },
      create: {
        bankActivityId: owner.ownerId,
        ...assignment,
        promptPdfAttachmentId: assignment.promptPdfAttachmentId ?? null,
        settings: assignment.settings as Prisma.InputJsonValue
      },
      update: {
        ...assignment,
        promptPdfAttachmentId: assignment.promptPdfAttachmentId ?? null,
        settings: assignment.settings as Prisma.InputJsonValue
      }
    });
    await transaction.pluginBankCodingHomeworkSubmissionRequirementSet.upsert({
      where: { bankActivityId: owner.ownerId },
      create: {
        bankActivityId: owner.ownerId,
        languageKey: requirements.languageKey,
        requirements: requirements as Prisma.InputJsonValue
      },
      update: {
        languageKey: requirements.languageKey,
        requirements: requirements as Prisma.InputJsonValue
      }
    });
  });

  return getCodingHomeworkAuthoring(owner);
}

export async function uploadCodingHomeworkAssignmentPdf(owner: OwnerContext, input: unknown) {
  const parsed = codingHomeworkFileUploadInputSchema.parse(input);
  if (parsed.mimeType && parsed.mimeType !== "application/pdf") {
    throw new AppError(400, "ASSIGNMENT_PDF_REQUIRED", "Assignment files must be PDFs.");
  }
  const bytes = decodeUploadBytes(parsed.base64, MAX_ASSIGNMENT_PDF_BYTES);
  const attachment = await createAttachment(owner, {
    bytes,
    kind: "assignment_pdf",
    mimeType: parsed.mimeType || "application/pdf",
    originalName: parsed.fileName
  });

  await upsertAssignmentPdfAttachment(owner, attachment.id);

  return getCodingHomeworkAuthoring(owner);
}

export async function uploadCodingHomeworkProvidedFile(owner: OwnerContext, input: unknown) {
  const parsed = codingHomeworkFileUploadInputSchema.parse(input);
  const bytes = decodeUploadBytes(parsed.base64, MAX_PROVIDED_FILE_BYTES);
  await createAttachment(owner, {
    bytes,
    kind: "provided_file",
    mimeType: parsed.mimeType || "application/octet-stream",
    originalName: parsed.fileName
  });
  return getCodingHomeworkAuthoring(owner);
}

export async function deleteCodingHomeworkProvidedFile(owner: OwnerContext, attachmentId: string) {
  const attachment = await prisma.pluginCodingHomeworkAttachment.findFirst({
    where: {
      id: attachmentId,
      ownerKind: owner.ownerKind,
      ownerId: owner.ownerId,
      kind: "provided_file"
    }
  });
  if (!attachment) {
    throw new AppError(404, "CODING_HOMEWORK_PROVIDED_FILE_NOT_FOUND", "The provided activity file was not found.");
  }
  await prisma.pluginCodingHomeworkAttachment.delete({ where: { id: attachment.id } });
  return getCodingHomeworkAuthoring(owner);
}

export async function getCodingHomeworkActivityAttachment(owner: OwnerContext, attachmentId: string) {
  const assignment = await findAssignment(owner);
  const attachment = await prisma.pluginCodingHomeworkAttachment.findFirst({
    where: {
      id: attachmentId,
      ownerKind: owner.ownerKind,
      ownerId: owner.ownerId,
      OR: [
        { kind: "provided_file" },
        ...(assignment?.promptPdfAttachmentId === attachmentId ? [{ kind: "assignment_pdf" as const }] : [])
      ]
    }
  });
  if (!attachment) {
    throw new AppError(404, "CODING_HOMEWORK_ATTACHMENT_NOT_FOUND", "The activity attachment was not found.");
  }
  return {
    attachment: toAttachmentRecord(attachment),
    filePath: codingHomeworkAttachmentPath(attachment.storedName)
  };
}

export async function importCodingHomeworkRequirements(owner: OwnerContext, input: unknown) {
  const parsed = codingHomeworkFileUploadInputSchema.parse(input);
  const bytes = decodeUploadBytes(parsed.base64, MAX_REQUIREMENTS_UPLOAD_BYTES);
  let decodedRequirements: unknown;
  try {
    decodedRequirements = JSON.parse(bytes.toString("utf8"));
  } catch {
    throw new AppError(400, "REQUIREMENTS_UPLOAD_INVALID_JSON", "Requirements uploads must be valid JSON.");
  }
  const requirements = codingHomeworkSubmissionRequirementsSchema.parse(decodedRequirements);
  const attachment = await createAttachment(owner, {
    bytes,
    kind: "requirements_upload",
    mimeType: parsed.mimeType || "application/json",
    originalName: parsed.fileName
  });

  await upsertRequirementUpload(owner, attachment.id, requirements);

  return getCodingHomeworkAuthoring(owner);
}

export async function copyBankCodingHomeworkAuthoringToCourseActivity(params: { bankActivityId: string; activityId: string }) {
  const [assignment, requirementSet] = await Promise.all([
    prisma.pluginBankCodingHomeworkAssignment.findUnique({ where: { bankActivityId: params.bankActivityId } }),
    prisma.pluginBankCodingHomeworkSubmissionRequirementSet.findUnique({ where: { bankActivityId: params.bankActivityId } })
  ]);
  const attachmentIds = [assignment?.promptPdfAttachmentId, requirementSet?.sourceAttachmentId].filter(Boolean) as string[];
  const sourceAttachments = await prisma.pluginCodingHomeworkAttachment.findMany({
    where: {
      ownerKind: "bank_activity",
      ownerId: params.bankActivityId,
      OR: [{ id: { in: attachmentIds } }, { kind: "provided_file" }]
    }
  });

  await prisma.$transaction(async (transaction) => {
    await transaction.pluginCodingHomeworkAssignment.deleteMany({ where: { activityId: params.activityId } });
    await transaction.pluginCodingHomeworkSubmissionRequirementSet.deleteMany({ where: { activityId: params.activityId } });
    await transaction.pluginCodingHomeworkAttachment.deleteMany({
      where: {
        ownerKind: "course_activity",
        ownerId: params.activityId,
        kind: { in: ["assignment_pdf", "provided_file", "requirements_upload"] }
      }
    });

    let copiedPdfAttachmentId: string | null = null;
    let copiedRequirementsAttachmentId: string | null = null;

    for (const sourceAttachment of sourceAttachments) {
      const copied = await transaction.pluginCodingHomeworkAttachment.create({
        data: {
          ownerKind: "course_activity",
          ownerId: params.activityId,
          kind: sourceAttachment.kind,
          originalName: sourceAttachment.originalName,
          storedName: sourceAttachment.storedName,
          mimeType: sourceAttachment.mimeType,
          sizeBytes: sourceAttachment.sizeBytes,
          sha256: sourceAttachment.sha256,
          metadata: normalizeObject(sourceAttachment.metadata) as Prisma.InputJsonValue
        }
      });
      if (sourceAttachment.id === assignment?.promptPdfAttachmentId) {
        copiedPdfAttachmentId = copied.id;
      }
      if (sourceAttachment.id === requirementSet?.sourceAttachmentId) {
        copiedRequirementsAttachmentId = copied.id;
      }
    }

    if (assignment) {
      await transaction.pluginCodingHomeworkAssignment.create({
        data: {
          activityId: params.activityId,
          promptMarkdown: assignment.promptMarkdown,
          promptPdfAttachmentId: copiedPdfAttachmentId,
          languageKey: assignment.languageKey,
          candidateLimit: assignment.candidateLimit,
          retrievedExampleCount: assignment.retrievedExampleCount,
          questionCount: assignment.questionCount,
          generationInstructions: assignment.generationInstructions,
          settings: normalizeObject(assignment.settings) as Prisma.InputJsonValue
        }
      });
    }

    if (requirementSet) {
      await transaction.pluginCodingHomeworkSubmissionRequirementSet.create({
        data: {
          activityId: params.activityId,
          languageKey: requirementSet.languageKey,
          requirements: normalizeRequirements(requirementSet.requirements) as Prisma.InputJsonValue,
          sourceAttachmentId: copiedRequirementsAttachmentId,
          metadata: normalizeObject(requirementSet.metadata) as Prisma.InputJsonValue
        }
      });
    }
  });
}

export async function copyBankCodingHomeworkAuthoring(params: { sourceBankActivityId: string; bankActivityId: string }) {
  const [assignment, requirementSet, attachments] = await Promise.all([
    prisma.pluginBankCodingHomeworkAssignment.findUnique({ where: { bankActivityId: params.sourceBankActivityId } }),
    prisma.pluginBankCodingHomeworkSubmissionRequirementSet.findUnique({ where: { bankActivityId: params.sourceBankActivityId } }),
    prisma.pluginCodingHomeworkAttachment.findMany({ where: { ownerKind: "bank_activity", ownerId: params.sourceBankActivityId } })
  ]);
  await prisma.$transaction(async (transaction) => {
    const attachmentIdMap = new Map<string, string>();
    for (const source of attachments) {
      const copied = await transaction.pluginCodingHomeworkAttachment.create({
        data: {
          ownerKind: "bank_activity",
          ownerId: params.bankActivityId,
          kind: source.kind,
          originalName: source.originalName,
          storedName: source.storedName,
          mimeType: source.mimeType,
          sizeBytes: source.sizeBytes,
          sha256: source.sha256,
          metadata: normalizeObject(source.metadata) as Prisma.InputJsonValue
        }
      });
      attachmentIdMap.set(source.id, copied.id);
    }
    if (assignment) {
      await transaction.pluginBankCodingHomeworkAssignment.create({
        data: {
          bankActivityId: params.bankActivityId,
          promptMarkdown: assignment.promptMarkdown,
          promptPdfAttachmentId: assignment.promptPdfAttachmentId ? attachmentIdMap.get(assignment.promptPdfAttachmentId) ?? null : null,
          languageKey: assignment.languageKey,
          candidateLimit: assignment.candidateLimit,
          retrievedExampleCount: assignment.retrievedExampleCount,
          questionCount: assignment.questionCount,
          generationInstructions: assignment.generationInstructions,
          settings: normalizeObject(assignment.settings) as Prisma.InputJsonValue
        }
      });
    }
    if (requirementSet) {
      await transaction.pluginBankCodingHomeworkSubmissionRequirementSet.create({
        data: {
          bankActivityId: params.bankActivityId,
          languageKey: requirementSet.languageKey,
          requirements: normalizeRequirements(requirementSet.requirements) as Prisma.InputJsonValue,
          sourceAttachmentId: requirementSet.sourceAttachmentId ? attachmentIdMap.get(requirementSet.sourceAttachmentId) ?? null : null,
          metadata: normalizeObject(requirementSet.metadata) as Prisma.InputJsonValue
        }
      });
    }
  });
}

export async function copyCourseCodingHomeworkAuthoring(params: { sourceActivityId: string; activityId: string }) {
  const [assignment, requirementSet, attachments] = await Promise.all([
    prisma.pluginCodingHomeworkAssignment.findUnique({ where: { activityId: params.sourceActivityId } }),
    prisma.pluginCodingHomeworkSubmissionRequirementSet.findUnique({ where: { activityId: params.sourceActivityId } }),
    prisma.pluginCodingHomeworkAttachment.findMany({
      where: { ownerKind: "course_activity", ownerId: params.sourceActivityId }
    })
  ]);
  await prisma.$transaction(async (transaction) => {
    const attachmentIdMap = new Map<string, string>();
    for (const source of attachments) {
      const copied = await transaction.pluginCodingHomeworkAttachment.create({
        data: {
          ownerKind: "course_activity",
          ownerId: params.activityId,
          kind: source.kind,
          originalName: source.originalName,
          storedName: source.storedName,
          mimeType: source.mimeType,
          sizeBytes: source.sizeBytes,
          sha256: source.sha256,
          metadata: normalizeObject(source.metadata) as Prisma.InputJsonValue
        }
      });
      attachmentIdMap.set(source.id, copied.id);
    }
    if (assignment) {
      await transaction.pluginCodingHomeworkAssignment.create({
        data: {
          activityId: params.activityId,
          promptMarkdown: assignment.promptMarkdown,
          promptPdfAttachmentId: assignment.promptPdfAttachmentId ? attachmentIdMap.get(assignment.promptPdfAttachmentId) ?? null : null,
          languageKey: assignment.languageKey,
          candidateLimit: assignment.candidateLimit,
          retrievedExampleCount: assignment.retrievedExampleCount,
          questionCount: assignment.questionCount,
          generationInstructions: assignment.generationInstructions,
          settings: normalizeObject(assignment.settings) as Prisma.InputJsonValue
        }
      });
    }
    if (requirementSet) {
      await transaction.pluginCodingHomeworkSubmissionRequirementSet.create({
        data: {
          activityId: params.activityId,
          languageKey: requirementSet.languageKey,
          requirements: normalizeRequirements(requirementSet.requirements) as Prisma.InputJsonValue,
          sourceAttachmentId: requirementSet.sourceAttachmentId ? attachmentIdMap.get(requirementSet.sourceAttachmentId) ?? null : null,
          metadata: normalizeObject(requirementSet.metadata) as Prisma.InputJsonValue
        }
      });
    }
  });
}

export async function deleteBankCodingHomeworkAuthoring(params: { bankActivityId: string }) {
  await prisma.$transaction(async (transaction) => {
    await transaction.pluginBankCodingHomeworkAssignment.deleteMany({
      where: { bankActivityId: params.bankActivityId }
    });
    await transaction.pluginBankCodingHomeworkSubmissionRequirementSet.deleteMany({
      where: { bankActivityId: params.bankActivityId }
    });
    await transaction.pluginCodingHomeworkAttachment.deleteMany({
      where: {
        ownerKind: "bank_activity",
        ownerId: params.bankActivityId
      }
    });
  });
}

export async function deleteCourseCodingHomeworkData(params: { activityId: string }) {
  await prisma.$transaction(async (transaction) => {
    const submissions = await transaction.pluginCodingHomeworkSubmission.findMany({
      where: { activityId: params.activityId },
      select: { id: true }
    });
    const submissionIds = submissions.map(({ id }) => id);
    await transaction.pluginCodingHomeworkSubmission.deleteMany({ where: { activityId: params.activityId } });
    await transaction.pluginCodingHomeworkDocumentationSnapshot.deleteMany({ where: { activityId: params.activityId } });
    await transaction.pluginCodingHomeworkAssignment.deleteMany({ where: { activityId: params.activityId } });
    await transaction.pluginCodingHomeworkSubmissionRequirementSet.deleteMany({ where: { activityId: params.activityId } });
    await transaction.pluginCodingHomeworkAttachment.deleteMany({
      where: {
        OR: [
          { ownerKind: "course_activity", ownerId: params.activityId },
          ...(submissionIds.length ? [{ ownerKind: "submission" as const, ownerId: { in: submissionIds } }] : [])
        ]
      }
    });
  });
}

function fileStorageDir() {
  return path.join(process.cwd(), "../../storage/coding-homework-grader");
}

export function codingHomeworkAttachmentPath(storedName: string) {
  if (path.basename(storedName) !== storedName) {
    throw new AppError(400, "CODING_HOMEWORK_ATTACHMENT_PATH_INVALID", "The stored attachment path is invalid.");
  }
  return path.join(fileStorageDir(), storedName);
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

async function createAttachment(
  owner: OwnerContext,
  input: {
    bytes: Buffer;
    kind: "assignment_pdf" | "provided_file" | "requirements_upload";
    mimeType: string;
    originalName: string;
  }
) {
  const originalName = input.originalName || "upload";
  const storedName = `${randomUUID()}-${originalName.replace(SAFE_NAME_PATTERN, "_")}`;
  await mkdir(fileStorageDir(), { recursive: true });
  await writeFile(path.join(fileStorageDir(), storedName), input.bytes);
  const sha256 = createHash("sha256").update(input.bytes).digest("hex");

  return prisma.pluginCodingHomeworkAttachment.create({
    data: {
      ownerKind: owner.ownerKind,
      ownerId: owner.ownerId,
      kind: input.kind,
      originalName,
      storedName,
      mimeType: input.mimeType,
      sizeBytes: BigInt(input.bytes.length),
      sha256,
      metadata: {} as Prisma.InputJsonValue
    }
  });
}

async function upsertAssignmentPdfAttachment(owner: OwnerContext, attachmentId: string) {
  if (owner.ownerKind === "course_activity") {
    await prisma.pluginCodingHomeworkAssignment.upsert({
      where: { activityId: owner.ownerId },
      create: {
        activityId: owner.ownerId,
        promptPdfAttachmentId: attachmentId
      },
      update: {
        promptPdfAttachmentId: attachmentId
      }
    });
    return;
  }

  await prisma.pluginBankCodingHomeworkAssignment.upsert({
    where: { bankActivityId: owner.ownerId },
    create: {
      bankActivityId: owner.ownerId,
      promptPdfAttachmentId: attachmentId
    },
    update: {
      promptPdfAttachmentId: attachmentId
    }
  });
}

async function upsertRequirementUpload(owner: OwnerContext, attachmentId: string, requirements: CodingHomeworkSubmissionRequirements) {
  if (owner.ownerKind === "course_activity") {
    await prisma.pluginCodingHomeworkSubmissionRequirementSet.upsert({
      where: { activityId: owner.ownerId },
      create: {
        activityId: owner.ownerId,
        languageKey: requirements.languageKey,
        requirements: requirements as Prisma.InputJsonValue,
        sourceAttachmentId: attachmentId
      },
      update: {
        languageKey: requirements.languageKey,
        requirements: requirements as Prisma.InputJsonValue,
        sourceAttachmentId: attachmentId
      }
    });
    return;
  }

  await prisma.pluginBankCodingHomeworkSubmissionRequirementSet.upsert({
    where: { bankActivityId: owner.ownerId },
    create: {
      bankActivityId: owner.ownerId,
      languageKey: requirements.languageKey,
      requirements: requirements as Prisma.InputJsonValue,
      sourceAttachmentId: attachmentId
    },
    update: {
      languageKey: requirements.languageKey,
      requirements: requirements as Prisma.InputJsonValue,
      sourceAttachmentId: attachmentId
    }
  });
}

async function findAssignment(owner: OwnerContext) {
  return owner.ownerKind === "course_activity"
    ? prisma.pluginCodingHomeworkAssignment.findUnique({ where: { activityId: owner.ownerId } })
    : prisma.pluginBankCodingHomeworkAssignment.findUnique({ where: { bankActivityId: owner.ownerId } });
}

async function findRequirementSet(owner: OwnerContext) {
  return owner.ownerKind === "course_activity"
    ? prisma.pluginCodingHomeworkSubmissionRequirementSet.findUnique({ where: { activityId: owner.ownerId } })
    : prisma.pluginBankCodingHomeworkSubmissionRequirementSet.findUnique({ where: { bankActivityId: owner.ownerId } });
}

function defaultAssignment() {
  const now = new Date().toISOString();
  return {
    id: null,
    candidateLimit: 5,
    createdAt: now,
    generationInstructions: "",
    languageKey: "c",
    promptMarkdown: "",
    promptPdfAttachmentId: null,
    questionCount: 3,
    retrievedExampleCount: 3,
    settings: {},
    updatedAt: now
  };
}

function toAssignmentRecord(row: AssignmentRow | null) {
  if (!row) {
    return defaultAssignment();
  }

  return {
    id: row.id,
    candidateLimit: row.candidateLimit,
    createdAt: row.createdAt.toISOString(),
    generationInstructions: row.generationInstructions,
    languageKey: row.languageKey,
    promptMarkdown: row.promptMarkdown,
    promptPdfAttachmentId: row.promptPdfAttachmentId,
    questionCount: row.questionCount,
    retrievedExampleCount: row.retrievedExampleCount,
    settings: normalizeObject(row.settings),
    updatedAt: row.updatedAt.toISOString()
  };
}

function toRequirementRecord(row: RequirementSetRow | null) {
  const now = new Date().toISOString();
  const requirements = normalizeRequirements(row?.requirements);
  return {
    id: row?.id ?? null,
    createdAt: row?.createdAt.toISOString() ?? now,
    languageKey: row?.languageKey ?? requirements.languageKey,
    metadata: normalizeObject(row?.metadata),
    requirements,
    sourceAttachmentId: row?.sourceAttachmentId ?? null,
    updatedAt: row?.updatedAt.toISOString() ?? now
  };
}

function toAttachmentRecord(row: AttachmentRow | undefined) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    createdAt: row.createdAt.toISOString(),
    kind: row.kind,
    metadata: normalizeObject(row.metadata),
    mimeType: row.mimeType,
    originalName: row.originalName,
    ownerId: row.ownerId,
    ownerKind: row.ownerKind,
    sha256: row.sha256,
    sizeBytes: Number(row.sizeBytes),
    storedName: row.storedName,
    updatedAt: row.updatedAt.toISOString()
  };
}

function normalizeRequirements(value: unknown): CodingHomeworkSubmissionRequirements {
  return codingHomeworkSubmissionRequirementsSchema.parse(value ?? {});
}

function normalizeObject(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}
