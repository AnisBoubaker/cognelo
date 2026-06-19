import { readFile } from "node:fs/promises";
import path from "node:path";
import { createDeterministicContentEmbeddingProvider } from "@cognelo/content-type-sdk/vector";
import { AppError, canManageCourse, searchContentResourceEmbeddingDocuments } from "@cognelo/core";
import type { CurrentUser } from "@cognelo/contracts";
import { z } from "zod";
import { Prisma, prisma } from "./db-client";
import { parseCodingHomeworkSourceFiles } from "./parsers";
import { appendProcessingEvent, buildProcessingEvent, buildProcessingOperationId, processingFailureMetadata } from "./processing";

type AnalysisScope = {
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

type SubmissionWithFiles = SubmissionRow & {
  files: SubmissionFileRow[];
};

type SnapshotRow = {
  id: string;
  metadata: unknown;
};

type IncludedResource = {
  contentResourceId?: string | null;
};

type PreparedFunction = {
  astText: string;
  divergenceScore: number;
  embedding: number[];
  endLine?: number;
  fileId: string;
  functionCode: string;
  functionName: string;
  languageKey: string;
  nearestExamples: Array<{
    contentResourceId?: string;
    contentTypeKey?: string;
    distance: number;
    documentId: string;
    functionCode: string;
    functionName: string;
    pluginKey?: string;
    score: number;
    sourceTitle: string;
    referenceId: string;
  }>;
  sourcePath: string;
  startLine?: number;
};

const analysisInputSchema = z.object({
  candidateLimit: z.number().int().min(1).max(50).optional(),
  nearestExampleCount: z.number().int().min(1).max(20).optional(),
  submissionId: z.string().trim().min(1).nullable().optional()
});

export async function analyzeCodingHomeworkSubmission(scope: AnalysisScope, input: unknown = {}) {
  const parsed = parseAnalysisInput(input);
  const submission = await findSubmission(scope, parsed.submissionId ?? null);
  if (!submission) {
    throw new AppError(404, "CODING_HOMEWORK_SUBMISSION_NOT_FOUND", "The requested submission was not found.");
  }
  if (submission.kind !== "final") {
    throw new AppError(400, "CODING_HOMEWORK_FINAL_SUBMISSION_REQUIRED", "Only final submissions can be analyzed.");
  }
  if (submission.status === "invalid_structure") {
    throw new AppError(400, "CODING_HOMEWORK_SUBMISSION_INVALID_STRUCTURE", "Fix the submission structure before analysis.");
  }

  const operationId = buildProcessingOperationId("analysis", submission.id);
  await prisma.pluginCodingHomeworkSubmission.update({
    where: { id: submission.id },
    data: {
      metadata: appendProcessingEvent(
        submission.metadata,
        buildProcessingEvent({
          operationId,
          stage: "analysis",
          status: "started"
        })
      ) as Prisma.InputJsonValue,
      status: "processing",
      processingError: null
    }
  });

  try {
    const assignment = await prisma.pluginCodingHomeworkAssignment.findUnique({ where: { activityId: scope.activityId } });
    const candidateLimit = Math.max(1, Math.min(50, parsed.candidateLimit ?? assignment?.candidateLimit ?? 5));
    const nearestExampleCount = Math.max(1, Math.min(20, parsed.nearestExampleCount ?? assignment?.retrievedExampleCount ?? 3));
    const provider = createDeterministicContentEmbeddingProvider();
    const sourceFiles = await readStoredSourceFiles(submission.files);
    const parseResult = await parseCodingHomeworkSourceFiles(sourceFiles);
    const fileIdsByPath = new Map(submission.files.map((file) => [file.path, file.id]));
    const snapshot = submission.documentationSnapshotId ? await findSnapshot(scope, submission.documentationSnapshotId) : null;
    const contentResourceIds = snapshot ? readSnapshotContentResourceIds(snapshot) : [];
    const referenceDiagnostics: unknown[] = [];

    const prepared: PreparedFunction[] = [];
    for (const parsedFunction of parseResult.functions) {
      const fileId = fileIdsByPath.get(parsedFunction.sourcePath);
      if (!fileId) {
        continue;
      }

      const embedding = await provider.embedText(parsedFunction.astText);
      const referenceSearch = contentResourceIds.length
        ? await searchContentResourceEmbeddingDocuments(scope.user, scope.courseId, {
            contentResourceIds,
            enforceVisibility: false,
            groupId: scope.groupId,
            limit: nearestExampleCount,
            queryText: parsedFunction.astText
          })
        : { diagnostics: [], matches: [] };
      referenceDiagnostics.push(...referenceSearch.diagnostics);
      const nearestExamples = referenceSearch.matches.map((match) => ({
        contentResourceId: match.contentResourceId,
        contentTypeKey: match.contentTypeKey,
        distance: match.distance,
        documentId: match.documentId,
        functionCode: match.text,
        functionName: readFunctionName(match.metadata) ?? match.title,
        pluginKey: match.pluginKey,
        referenceId: match.documentId,
        score: match.score,
        sourceTitle: match.resourceTitle || match.title
      }));
      prepared.push({
        astText: parsedFunction.astText,
        divergenceScore: nearestExamples[0]?.distance ?? 1,
        embedding: embedding.values,
        endLine: parsedFunction.endLine,
        fileId,
        functionCode: parsedFunction.functionCode,
        functionName: parsedFunction.functionName,
        languageKey: parsedFunction.languageKey,
        nearestExamples,
        sourcePath: parsedFunction.sourcePath,
        startLine: parsedFunction.startLine
      });
    }

    const selectedKeys = selectCandidateKeys(prepared, candidateLimit);
    await prisma.pluginCodingHomeworkSubmissionFunction.deleteMany({ where: { submissionId: submission.id } });
    const created = [];
    for (const fn of prepared) {
      const row = await prisma.pluginCodingHomeworkSubmissionFunction.create({
        data: {
          astText: fn.astText,
          divergenceScore: fn.divergenceScore,
          embedding: fn.embedding as Prisma.InputJsonValue,
          fileId: fn.fileId,
          functionCode: fn.functionCode,
          functionName: fn.functionName,
          nearestExamples: fn.nearestExamples as Prisma.InputJsonValue,
          selectedForQuestion: selectedKeys.has(candidateKey(fn)),
          submissionId: submission.id
        }
      });
      created.push(row);
    }

    const analysis = {
      status: "ready",
      analyzedAt: new Date().toISOString(),
      modelKey: provider.modelKey,
      dimensions: provider.dimensions,
      sourceFileCount: sourceFiles.length,
      parsedFunctionCount: parseResult.functions.length,
      storedFunctionCount: created.length,
      selectedCandidateCount: selectedKeys.size,
      referenceResourceCount: contentResourceIds.length,
      nearestExampleCount,
      candidateLimit,
      diagnostics: {
        parser: parseResult.diagnostics,
        referenceSearch: referenceDiagnostics
      }
    };
    const updatedSubmission = await prisma.pluginCodingHomeworkSubmission.update({
      where: { id: submission.id },
      data: {
        metadata: {
          ...appendProcessingEvent(
            submission.metadata,
            buildProcessingEvent({
              operationId,
              stage: "analysis",
              status: "completed"
            })
          ),
          analysis
        } as Prisma.InputJsonValue,
        processingError: null,
        status: "structure_valid"
      }
    });

    return {
      analysis,
      functions: created.map(toSubmissionFunctionRecord),
      submission: toSubmissionRecord(updatedSubmission)
    };
  } catch (error) {
    const failure = processingFailureMetadata(submission.metadata, "analysis", error, operationId);
    await prisma.pluginCodingHomeworkSubmission.update({
      where: { id: submission.id },
      data: {
        metadata: failure.metadata as Prisma.InputJsonValue,
        processingError: failure.processingError.message,
        status: "failed"
      }
    });
    throw error;
  }
}

function parseAnalysisInput(input: unknown) {
  return analysisInputSchema.parse(input ?? {});
}

async function findSubmission(scope: AnalysisScope, submissionId: string | null): Promise<SubmissionWithFiles | null> {
  const manager = await canManageCourse(scope.user, scope.courseId);
  return prisma.pluginCodingHomeworkSubmission.findFirst({
    where: {
      ...(submissionId ? { id: submissionId } : {}),
      activityId: scope.activityId,
      groupId: scope.groupId,
      kind: "final",
      ...(manager ? {} : { userId: scope.user.id })
    },
    orderBy: { createdAt: "desc" },
    include: {
      files: {
        orderBy: { path: "asc" }
      }
    }
  });
}

async function findSnapshot(scope: AnalysisScope, snapshotId: string): Promise<SnapshotRow | null> {
  return prisma.pluginCodingHomeworkDocumentationSnapshot.findFirst({
    where: {
      id: snapshotId,
      activityId: scope.activityId,
      courseId: scope.courseId,
      OR: [{ groupId: scope.groupId }, { groupId: null }],
      status: "ready"
    }
  });
}

async function readStoredSourceFiles(files: SubmissionFileRow[]) {
  const sourceFiles = files.filter((file) => file.languageKey);
  return Promise.all(
    sourceFiles.map(async (file) => ({
      content: await readFile(storedSubmissionPath(file.storedName), "utf8"),
      languageKey: file.languageKey as string,
      path: file.path
    }))
  );
}

function storedSubmissionPath(storedName: string) {
  return path.join(process.cwd(), "../../storage/coding-homework-grader/submissions", ...storedName.split("/"));
}

function readSnapshotContentResourceIds(snapshot: SnapshotRow) {
  const metadata = normalizeObject(snapshot.metadata);
  const includedResources = Array.isArray(metadata.includedResources) ? (metadata.includedResources as IncludedResource[]) : [];
  return [...new Set(includedResources.flatMap((resource) => (resource.contentResourceId ? [resource.contentResourceId] : [])))];
}

function selectCandidateKeys(functions: PreparedFunction[], limit: number) {
  const ranked = [...functions].sort(
    (left, right) =>
      right.divergenceScore - left.divergenceScore ||
      left.sourcePath.localeCompare(right.sourcePath) ||
      left.functionName.localeCompare(right.functionName)
  );
  const selected = new Set<string>();
  const seenPaths = new Set<string>();

  for (const fn of ranked) {
    if (selected.size >= limit) {
      break;
    }
    if (seenPaths.has(fn.sourcePath)) {
      continue;
    }
    selected.add(candidateKey(fn));
    seenPaths.add(fn.sourcePath);
  }

  for (const fn of ranked) {
    if (selected.size >= limit) {
      break;
    }
    selected.add(candidateKey(fn));
  }

  return selected;
}

function candidateKey(fn: { functionName: string; sourcePath: string }) {
  return `${fn.sourcePath}:${fn.functionName}`;
}

function readFunctionName(metadata: unknown) {
  const object = normalizeObject(metadata);
  return typeof object.functionName === "string" && object.functionName.trim() ? object.functionName : null;
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

function toSubmissionFunctionRecord(row: {
  id: string;
  submissionId: string;
  fileId: string;
  functionName: string;
  functionCode: string;
  astText: string;
  embedding: unknown;
  nearestExamples: unknown;
  divergenceScore: number | null;
  selectedForQuestion: boolean;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: row.id,
    astText: row.astText,
    createdAt: row.createdAt.toISOString(),
    divergenceScore: row.divergenceScore,
    embedding: Array.isArray(row.embedding) ? row.embedding : [],
    fileId: row.fileId,
    functionCode: row.functionCode,
    functionName: row.functionName,
    nearestExamples: Array.isArray(row.nearestExamples) ? row.nearestExamples : [],
    selectedForQuestion: row.selectedForQuestion,
    submissionId: row.submissionId,
    updatedAt: row.updatedAt.toISOString()
  };
}

function normalizeObject(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}
