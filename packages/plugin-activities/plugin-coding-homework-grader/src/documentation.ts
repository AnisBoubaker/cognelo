import { createHash } from "node:crypto";
import { AppError, listContentItems, listContentResources, listMaterials } from "@cognelo/core";
import type { CurrentUser } from "@cognelo/contracts";
import { prisma, type Prisma } from "./db-client";

type SnapshotScope = {
  activityId: string;
  courseGroupActivityId?: string | null;
  courseId: string;
  groupId?: string | null;
  user: CurrentUser;
};

type ContentItemRecord = {
  id: string;
  courseId: string;
  groupId: string | null;
  parentId: string | null;
  kind: "folder" | "content" | "activity";
  titleSnapshot: string | null;
  position: number;
  isVisible: boolean;
  materialId: string | null;
  activityId: string | null;
  courseGroupActivityId: string | null;
  contentResourceId: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
  metadata: unknown;
};

type ContentResourceRecord = {
  id: string;
  courseId: string;
  groupId: string | null;
  contentTypeKey: string;
  pluginKey: string;
  title: string;
  metadata: unknown;
  createdAt: Date | string;
  updatedAt: Date | string;
};

type MaterialRecord = {
  id: string;
  title: string;
  kind: string;
  body?: string | null;
  url?: string | null;
  metadata: unknown;
  createdAt: Date | string;
  updatedAt: Date | string;
};

type FlattenedContentItem = {
  depth: number;
  item: ContentItemRecord;
  path: string[];
};

export type CodingHomeworkDocumentationResource = {
  contentResourceId: string | null;
  contentTypeKey: string | null;
  depth: number;
  groupId: string | null;
  itemId: string;
  materialId: string | null;
  orderIndex: number;
  path: string[];
  pluginKey: string | null;
  resourceFingerprint: string;
  sourceKind: "content_resource" | "legacy_material";
  title: string;
  updatedAt: string;
};

export async function buildCodingHomeworkDocumentationPreview(scope: SnapshotScope) {
  const [items, resources, materials, latestSnapshot] = await Promise.all([
    listContentItems(scope.user, scope.courseId, {
      ...(scope.groupId ? { groupId: scope.groupId } : {}),
      visibleOnly: true
    }),
    listContentResources(scope.user, scope.courseId, scope.groupId ? { groupId: scope.groupId } : {}),
    listMaterials(scope.user, scope.courseId),
    prisma.pluginCodingHomeworkDocumentationSnapshot.findFirst({
      where: { activityId: scope.activityId, courseId: scope.courseId, groupId: scope.groupId ?? null },
      orderBy: { createdAt: "desc" }
    })
  ]);
  const flattened = flattenContentItems(items as ContentItemRecord[]);
  const anchorIndex = flattened.findIndex(({ item }) => isActivityAnchor(item, scope.activityId, scope.courseGroupActivityId));
  const anchor = anchorIndex >= 0 ? flattened[anchorIndex] : null;
  const resourcesById = new Map((resources as ContentResourceRecord[]).map((resource) => [resource.id, resource]));
  const materialsById = new Map((materials as MaterialRecord[]).map((material) => [material.id, material]));
  const priorItems = anchor ? flattened.slice(0, anchorIndex) : [];
  const includedResources = priorItems.flatMap((row, index) => contentResourceForRow(row, index, resourcesById, materialsById));
  const contentTreeFingerprint = fingerprint({
    anchorItemId: anchor?.item.id ?? null,
    activityId: scope.activityId,
    courseGroupActivityId: scope.courseGroupActivityId ?? null,
    courseId: scope.courseId,
    groupId: scope.groupId ?? null,
    resources: includedResources.map((resource) => ({
      itemId: resource.itemId,
      contentResourceId: resource.contentResourceId,
      materialId: resource.materialId,
      resourceFingerprint: resource.resourceFingerprint
    }))
  });

  return {
    anchor: anchor
      ? {
          id: anchor.item.id,
          depth: anchor.depth,
          path: anchor.path,
          title: titleForItem(anchor.item),
          updatedAt: toIso(anchor.item.updatedAt)
        }
      : null,
    contentTreeFingerprint,
    latestSnapshot: toSnapshotRecord(latestSnapshot),
    resources: includedResources,
    resourceCount: includedResources.length
  };
}

export async function createCodingHomeworkDocumentationSnapshot(scope: SnapshotScope) {
  const preview = await buildCodingHomeworkDocumentationPreview(scope);
  if (!preview.anchor) {
    throw new AppError(
      400,
      "CODING_HOMEWORK_CONTENT_ANCHOR_NOT_FOUND",
      "Add this activity to the content tree before creating a documentation snapshot."
    );
  }

  const snapshot = await prisma.pluginCodingHomeworkDocumentationSnapshot.create({
    data: {
      activityId: scope.activityId,
      courseId: scope.courseId,
      groupId: scope.groupId ?? null,
      contentTreeAnchorItemId: preview.anchor.id,
      contentTreeFingerprint: preview.contentTreeFingerprint,
      status: "ready",
      metadata: {
        anchor: preview.anchor,
        generatedAt: new Date().toISOString(),
        includedResources: preview.resources,
        resourceCount: preview.resourceCount
      } as Prisma.InputJsonValue
    }
  });

  return {
    preview: {
      ...preview,
      latestSnapshot: toSnapshotRecord(snapshot)
    },
    snapshot: toSnapshotRecord(snapshot)
  };
}

function contentResourceForRow(
  row: FlattenedContentItem,
  orderIndex: number,
  resourcesById: Map<string, ContentResourceRecord>,
  materialsById: Map<string, MaterialRecord>
): CodingHomeworkDocumentationResource[] {
  if (row.item.kind !== "content") {
    return [];
  }

  if (row.item.contentResourceId) {
    const resource = resourcesById.get(row.item.contentResourceId);
    if (!resource) {
      return [];
    }
    return [
      {
        contentResourceId: resource.id,
        contentTypeKey: resource.contentTypeKey,
        depth: row.depth,
        groupId: resource.groupId,
        itemId: row.item.id,
        materialId: null,
        orderIndex,
        path: row.path,
        pluginKey: resource.pluginKey,
        resourceFingerprint: fingerprint({
          id: resource.id,
          metadata: resource.metadata,
          title: resource.title,
          type: resource.contentTypeKey,
          updatedAt: toIso(resource.updatedAt)
        }),
        sourceKind: "content_resource",
        title: row.item.titleSnapshot ?? resource.title,
        updatedAt: toIso(resource.updatedAt)
      }
    ];
  }

  if (row.item.materialId) {
    const material = materialsById.get(row.item.materialId);
    if (!material || material.kind === "folder") {
      return [];
    }
    return [
      {
        contentResourceId: null,
        contentTypeKey: null,
        depth: row.depth,
        groupId: row.item.groupId,
        itemId: row.item.id,
        materialId: material.id,
        orderIndex,
        path: row.path,
        pluginKey: null,
        resourceFingerprint: fingerprint({
          body: material.body ?? null,
          id: material.id,
          kind: material.kind,
          metadata: material.metadata,
          title: material.title,
          updatedAt: toIso(material.updatedAt),
          url: material.url ?? null
        }),
        sourceKind: "legacy_material",
        title: row.item.titleSnapshot ?? material.title,
        updatedAt: toIso(material.updatedAt)
      }
    ];
  }

  return [];
}

function flattenContentItems(items: ContentItemRecord[]) {
  const byParent = new Map<string, ContentItemRecord[]>();
  for (const item of items) {
    const parentKey = item.parentId ?? "";
    byParent.set(parentKey, [...(byParent.get(parentKey) ?? []), item]);
  }
  for (const [parentKey, siblings] of byParent) {
    byParent.set(parentKey, siblings.sort(compareContentItems));
  }

  const flattened: FlattenedContentItem[] = [];
  function walk(parentId: string | null, depth: number, parentPath: string[]) {
    for (const item of byParent.get(parentId ?? "") ?? []) {
      const path = item.kind === "folder" ? [...parentPath, titleForItem(item)] : parentPath;
      flattened.push({ depth, item, path });
      walk(item.id, depth + 1, path);
    }
  }
  walk(null, 0, []);
  return flattened;
}

function compareContentItems(left: ContentItemRecord, right: ContentItemRecord) {
  return left.position - right.position || toIso(left.createdAt).localeCompare(toIso(right.createdAt)) || left.id.localeCompare(right.id);
}

function isActivityAnchor(item: ContentItemRecord, activityId: string, courseGroupActivityId: string | null | undefined) {
  return item.kind === "activity" && (item.activityId === activityId || Boolean(courseGroupActivityId && item.courseGroupActivityId === courseGroupActivityId));
}

function titleForItem(item: ContentItemRecord) {
  return item.titleSnapshot?.trim() || "Untitled";
}

function toSnapshotRecord(
  row:
    | {
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
      }
    | null
) {
  if (!row) {
    return null;
  }
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

function fingerprint(value: unknown) {
  return createHash("sha256").update(JSON.stringify(stableJson(value))).digest("hex");
}

function stableJson(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(stableJson);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, stableJson(item)])
    );
  }
  return value;
}

function normalizeObject(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function toIso(value: Date | string) {
  return value instanceof Date ? value.toISOString() : value;
}
