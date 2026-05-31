import { createHash } from "node:crypto";
import { z } from "zod";
import { AppError, searchContentResourceEmbeddingDocuments } from "@cognelo/core";
import type { CurrentUser } from "@cognelo/contracts";
import { prisma, type Prisma } from "./db-client";

type ReferenceSearchScope = {
  activityId: string;
  courseId: string;
  groupId?: string | null;
  user: CurrentUser;
};

type SnapshotRow = {
  id: string;
  activityId: string;
  courseId: string;
  groupId: string | null;
  contentTreeAnchorItemId: string | null;
  contentTreeFingerprint: string;
  status: string;
  metadata: unknown;
  createdAt: Date;
  updatedAt: Date;
};

type IncludedResource = {
  contentResourceId?: string | null;
  itemId?: string;
  orderIndex?: number;
  title?: string;
};

const referenceSearchInputSchema = z.object({
  limit: z.number().int().min(1).max(50).default(10),
  minScore: z.number().min(-1).max(1).optional(),
  queryText: z.string().trim().min(1).max(20000),
  snapshotId: z.string().trim().min(1).optional().nullable()
});

export async function searchCodingHomeworkReferenceContent(scope: ReferenceSearchScope, input: unknown) {
  const parsed = referenceSearchInputSchema.parse(input);
  const snapshot = await findSnapshot(scope, parsed.snapshotId ?? null);
  if (!snapshot) {
    throw new AppError(404, "CODING_HOMEWORK_DOCUMENTATION_SNAPSHOT_NOT_FOUND", "Create a documentation snapshot before searching references.");
  }

  const metadata = normalizeObject(snapshot.metadata);
  const includedResources = readIncludedResources(metadata);
  const contentResourceIds = [...new Set(includedResources.flatMap((resource) => (resource.contentResourceId ? [resource.contentResourceId] : [])))];
  if (!contentResourceIds.length) {
    throw new AppError(400, "CODING_HOMEWORK_REFERENCE_RESOURCES_EMPTY", "This documentation snapshot has no plugin-backed content resources to search.");
  }

  const search = await searchContentResourceEmbeddingDocuments(scope.user, scope.courseId, {
    contentResourceIds,
    enforceVisibility: false,
    ...(scope.groupId ? { groupId: scope.groupId } : {}),
    limit: parsed.limit,
    minScore: parsed.minScore,
    queryText: parsed.queryText
  });

  const referenceSearch = {
    status: "ready",
    searchedAt: new Date().toISOString(),
    queryFingerprint: fingerprint(parsed.queryText),
    resourceCount: contentResourceIds.length,
    matchCount: search.matches.length,
    matches: search.matches.map((match) => ({
      contentResourceId: match.contentResourceId,
      contentTypeKey: match.contentTypeKey,
      distance: match.distance,
      documentId: match.documentId,
      kind: match.kind,
      languageKey: match.languageKey ?? null,
      path: match.path ?? null,
      pluginKey: match.pluginKey,
      resourceTitle: match.resourceTitle,
      score: match.score,
      sourceId: match.sourceId,
      text: match.text,
      title: match.title
    })),
    diagnostics: search.diagnostics
  };

  const updated = await prisma.pluginCodingHomeworkDocumentationSnapshot.update({
    where: { id: snapshot.id },
    data: {
      metadata: {
        ...metadata,
        latestReferenceSearch: referenceSearch
      } as Prisma.InputJsonValue
    }
  });

  return {
    referenceSearch,
    snapshot: toSnapshotRecord(updated)
  };
}

async function findSnapshot(scope: ReferenceSearchScope, snapshotId: string | null) {
  if (snapshotId) {
    return prisma.pluginCodingHomeworkDocumentationSnapshot.findFirst({
      where: {
        id: snapshotId,
        activityId: scope.activityId,
        courseId: scope.courseId,
        groupId: scope.groupId ?? null
      }
    });
  }

  return prisma.pluginCodingHomeworkDocumentationSnapshot.findFirst({
    where: {
      activityId: scope.activityId,
      courseId: scope.courseId,
      groupId: scope.groupId ?? null
    },
    orderBy: { createdAt: "desc" }
  });
}

function readIncludedResources(metadata: Record<string, unknown>): IncludedResource[] {
  return Array.isArray(metadata.includedResources) ? (metadata.includedResources as IncludedResource[]) : [];
}

function toSnapshotRecord(row: SnapshotRow) {
  return {
    id: row.id,
    activityId: row.activityId,
    courseId: row.courseId,
    groupId: row.groupId,
    contentTreeAnchorItemId: row.contentTreeAnchorItemId,
    contentTreeFingerprint: row.contentTreeFingerprint,
    status: row.status,
    metadata: normalizeObject(row.metadata),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  };
}

function normalizeObject(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function fingerprint(value: string) {
  return createHash("sha256").update(value).digest("hex");
}
