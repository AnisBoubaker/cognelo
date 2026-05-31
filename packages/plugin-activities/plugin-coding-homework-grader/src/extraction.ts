import { AppError, getContentResourceEmbeddingDocuments } from "@cognelo/core";
import type { CurrentUser } from "@cognelo/contracts";
import { prisma, type Prisma } from "./db-client";

type ExtractionScope = {
  activityId: string;
  courseId: string;
  groupId?: string | null;
  user: CurrentUser;
};

type ExtractionInput = {
  snapshotId?: string | null;
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
  contentTypeKey?: string | null;
  itemId?: string;
  materialId?: string | null;
  orderIndex?: number;
  path?: string[];
  pluginKey?: string | null;
  resourceFingerprint?: string;
  sourceKind?: string;
  title?: string;
};

export async function extractCodingHomeworkDocumentationSnapshot(scope: ExtractionScope, input: ExtractionInput = {}) {
  const snapshot = await findSnapshot(scope, input.snapshotId ?? null);
  if (!snapshot) {
    throw new AppError(404, "CODING_HOMEWORK_DOCUMENTATION_SNAPSHOT_NOT_FOUND", "Create a documentation snapshot before extracting sources.");
  }

  const metadata = normalizeObject(snapshot.metadata);
  const includedResources = readIncludedResources(metadata);
  const diagnostics: Array<Record<string, unknown>> = [];
  const documents: Array<Record<string, unknown>> = [];

  for (const resource of includedResources) {
    if (!resource.contentResourceId) {
      diagnostics.push({
        code: "CONTENT_RESOURCE_EXTRACTION_UNAVAILABLE",
        message: "This snapshot entry is not backed by a content type plugin resource.",
        severity: "warning",
        itemId: resource.itemId,
        materialId: resource.materialId,
        sourceKind: resource.sourceKind,
        title: resource.title
      });
      continue;
    }

    try {
      const result = await getContentResourceEmbeddingDocuments(scope.user, scope.courseId, resource.contentResourceId, {
        ...(scope.groupId ? { groupId: scope.groupId } : {}),
        enforceVisibility: false
      });
      diagnostics.push(
        ...result.diagnostics.map((diagnostic) => ({
          ...diagnostic,
          contentResourceId: resource.contentResourceId,
          itemId: resource.itemId,
          title: resource.title
        }))
      );
      documents.push(
        ...result.documents.map((document) => ({
          ...document,
          contentResourceId: resource.contentResourceId,
          contentTypeKey: resource.contentTypeKey,
          itemId: resource.itemId,
          orderIndex: resource.orderIndex ?? documents.length,
          path: document.path ?? resource.path ?? null,
          pluginKey: resource.pluginKey,
          resourceFingerprint: resource.resourceFingerprint,
          snapshotResourceTitle: resource.title
        }))
      );
    } catch (error) {
      diagnostics.push({
        code: "CONTENT_RESOURCE_EXTRACTION_FAILED",
        message: error instanceof Error ? error.message : "Content resource extraction failed.",
        severity: "error",
        contentResourceId: resource.contentResourceId,
        itemId: resource.itemId,
        title: resource.title
      });
    }
  }

  const extraction = {
    status: "ready",
    extractedAt: new Date().toISOString(),
    resourceCount: includedResources.length,
    documentCount: documents.length,
    diagnosticCount: diagnostics.length,
    documents,
    diagnostics
  };

  const updated = await prisma.pluginCodingHomeworkDocumentationSnapshot.update({
    where: { id: snapshot.id },
    data: {
      metadata: {
        ...metadata,
        extraction
      } as Prisma.InputJsonValue
    }
  });

  return {
    extraction,
    snapshot: toSnapshotRecord(updated)
  };
}

async function findSnapshot(scope: ExtractionScope, snapshotId: string | null) {
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
