import { Prisma, prisma } from "@cognelo/db";
import { getContentTypePluginForType } from "@cognelo/content-type-sdk";
import {
  getServerContentTypePlugin,
  type ContentEmbeddingDiagnostic,
  type ContentEmbeddingDocumentsResult,
  type ContentEmbeddingSource,
  type ContentVectorIndexResult,
  type ContentVectorSearchMatch
} from "@cognelo/content-type-sdk/server";
import type { CurrentUser } from "@cognelo/contracts";
import { assertCanManageCourse, assertCanViewCourse, canManageCourse } from "./authorization";
import { AppError, notFound } from "./errors";
import { assertContentResourcePluginActive, assertContentTypePluginEnabled } from "./plugins";

type ContentScope = {
  groupId?: string | null;
};

type CreateFolderInput = ContentScope & {
  title: string;
  parentId?: string | null;
  position?: number;
  isVisible?: boolean;
  metadata?: unknown;
};

type CreateMaterialContentItemInput = ContentScope & {
  materialId: string;
  parentId?: string | null;
  titleSnapshot?: string | null;
  position?: number;
  isVisible?: boolean;
  metadata?: unknown;
};

type CreateContentResourceInput = ContentScope & {
  contentTypeKey: string;
  pluginKey: string;
  title: string;
  metadata?: unknown;
};

type UpdateContentResourceInput = {
  title?: string;
  metadata?: unknown;
};

type CreateContentResourceContentItemInput = ContentScope & {
  contentResourceId: string;
  parentId?: string | null;
  titleSnapshot?: string | null;
  position?: number;
  isVisible?: boolean;
  metadata?: unknown;
};

type CreatePluginContentResourceInput = ContentScope & {
  contentTypeKey: string;
  payload?: unknown;
  parentId?: string | null;
  position?: number;
  isVisible?: boolean;
  itemMetadata?: unknown;
};

type UpdatePluginContentResourceInput = {
  payload?: unknown;
};

type CreateActivityContentItemInput = ContentScope & {
  activityId?: string | null;
  courseGroupActivityId?: string | null;
  parentId?: string | null;
  titleSnapshot?: string | null;
  position?: number;
  isVisible?: boolean;
  metadata?: unknown;
};

type UpdateContentItemInput = {
  parentId?: string | null;
  position?: number;
  isVisible?: boolean;
  titleSnapshot?: string | null;
  metadata?: unknown;
};

type ListContentOptions = ContentScope & {
  visibleOnly?: boolean;
  includeGroupItems?: boolean;
};

type CourseContentDb = Pick<
  typeof prisma,
  "activity" | "courseContentItem" | "courseContentResource" | "courseGroup" | "courseGroupActivity" | "courseMaterial"
>;

export type EffectiveContentVisibility = "visible" | "hidden" | "hidden_by_parent";

export type ContentResourceVectorSearchMatch = ContentVectorSearchMatch & {
  contentResourceId: string;
  contentTypeKey: string;
  pluginKey: string;
  resourceTitle: string;
};

export type ContentResourceVectorSearchResult = {
  matches: ContentResourceVectorSearchMatch[];
  diagnostics: Array<ContentEmbeddingDiagnostic & { contentResourceId?: string; resourceTitle?: string }>;
};

export async function createContentFolder(user: CurrentUser, courseId: string, input: CreateFolderInput) {
  await assertCanManageCourse(user, courseId);
  if (input.groupId) {
    throw new AppError(400, "CONTENT_FOLDERS_ARE_COURSE_SCOPED", "Content folders belong to the course structure, not one group.");
  }
  await assertValidParent(prisma, courseId, input.parentId);

  return prisma.courseContentItem.create({
    data: {
      courseId,
      groupId: null,
      parentId: input.parentId ?? null,
      kind: "folder",
      titleSnapshot: assertTitle(input.title),
      position: await resolvePosition(prisma, courseId, null, input.parentId, input.position),
      isVisible: input.isVisible ?? true,
      metadata: toJson(input.metadata)
    }
  });
}

export async function createMaterialContentItem(user: CurrentUser, courseId: string, input: CreateMaterialContentItemInput) {
  await assertCanManageCourse(user, courseId);
  const scope = normalizeScope(input);
  await assertValidScope(prisma, courseId, scope.groupId);
  await assertValidParent(prisma, courseId, input.parentId);
  const material = await prisma.courseMaterial.findFirst({
    where: { id: input.materialId, courseId },
    select: { id: true, title: true }
  });
  if (!material) {
    throw notFound("Course material");
  }

  return prisma.courseContentItem.create({
    data: {
      courseId,
      groupId: scope.groupId,
      parentId: input.parentId ?? null,
      kind: "content",
      titleSnapshot: input.titleSnapshot ?? material.title,
      position: await resolvePosition(prisma, courseId, scope.groupId, input.parentId, input.position),
      isVisible: input.isVisible ?? true,
      materialId: material.id,
      metadata: toJson(input.metadata)
    }
  });
}

export async function createContentResource(user: CurrentUser, courseId: string, input: CreateContentResourceInput) {
  await assertCanManageCourse(user, courseId);
  const scope = normalizeScope(input);
  await assertValidScope(prisma, courseId, scope.groupId);

  return prisma.courseContentResource.create({
    data: {
      courseId,
      groupId: scope.groupId,
      contentTypeKey: assertPluginKey(input.contentTypeKey, "contentTypeKey"),
      pluginKey: assertPluginKey(input.pluginKey, "pluginKey"),
      title: assertTitle(input.title),
      metadata: toJson(input.metadata)
    }
  });
}

export async function updateContentResource(
  user: CurrentUser,
  courseId: string,
  contentResourceId: string,
  input: UpdateContentResourceInput,
  scope: ContentScope = {}
) {
  await assertCanManageCourse(user, courseId);
  const resource = await prisma.courseContentResource.findFirst({ where: { id: contentResourceId, courseId, ...scopeWhere(scope) } });
  if (!resource) {
    throw notFound("Course content resource");
  }

  return prisma.courseContentResource.update({
    where: { id: contentResourceId },
    data: {
      ...(input.title !== undefined ? { title: assertTitle(input.title) } : {}),
      ...(input.metadata !== undefined ? { metadata: toJson(input.metadata) } : {})
    }
  });
}

export async function listContentResources(user: CurrentUser, courseId: string, options: ContentScope = {}) {
  await assertCanViewCourse(user, courseId);
  const scope = normalizeScope(options);
  await assertValidScope(prisma, courseId, scope.groupId);

  const resources = await prisma.courseContentResource.findMany({
    where: {
      courseId,
      ...(scope.groupId ? { OR: [{ groupId: null }, { groupId: scope.groupId }] } : { groupId: null })
    },
    orderBy: [{ title: "asc" }, { createdAt: "asc" }]
  });
  if (await canManageCourse(user, courseId)) {
    return resources;
  }

  const visibleResourceIds = await getVisibleContentResourceIds(courseId, scope.groupId);
  return resources.filter((resource) => visibleResourceIds.has(resource.id));
}

export async function deleteContentResource(user: CurrentUser, courseId: string, contentResourceId: string, scope: ContentScope = {}) {
  await assertCanManageCourse(user, courseId);
  const resource = await prisma.courseContentResource.findFirst({ where: { id: contentResourceId, courseId, ...scopeWhere(scope) } });
  if (!resource) {
    throw notFound("Course content resource");
  }
  await prisma.courseContentResource.delete({ where: { id: contentResourceId } });
  return { ok: true };
}

export async function createContentResourceContentItem(user: CurrentUser, courseId: string, input: CreateContentResourceContentItemInput) {
  await assertCanManageCourse(user, courseId);
  const scope = normalizeScope(input);
  await assertValidScope(prisma, courseId, scope.groupId);
  await assertValidParent(prisma, courseId, input.parentId);
  const resource = await prisma.courseContentResource.findFirst({
    where: { id: input.contentResourceId, courseId, groupId: scope.groupId },
    select: { id: true, title: true }
  });
  if (!resource) {
    throw notFound("Course content resource");
  }

  return prisma.courseContentItem.create({
    data: {
      courseId,
      groupId: scope.groupId,
      parentId: input.parentId ?? null,
      kind: "content",
      titleSnapshot: input.titleSnapshot ?? resource.title,
      position: await resolvePosition(prisma, courseId, scope.groupId, input.parentId, input.position),
      isVisible: input.isVisible ?? true,
      contentResourceId: resource.id,
      metadata: toJson(input.metadata)
    }
  });
}

export async function createPluginContentResource(user: CurrentUser, courseId: string, input: CreatePluginContentResourceInput) {
  await assertCanManageCourse(user, courseId);
  const scope = normalizeScope(input);
  await assertValidScope(prisma, courseId, scope.groupId);
  await assertValidParent(prisma, courseId, input.parentId);
  await assertContentTypePluginEnabled(input.contentTypeKey);

  const plugin = getContentTypePluginForType(input.contentTypeKey);
  const serverPlugin = plugin ? getServerContentTypePlugin(plugin.key) : null;
  const create = serverPlugin?.handlers?.create;
  if (!plugin || !serverPlugin || !create) {
    throw new AppError(400, "CONTENT_TYPE_CREATE_UNAVAILABLE", "This content type does not support generic creation yet.");
  }

  const result = await create({
    user,
    courseId,
    groupId: scope.groupId,
    contentTypeKey: input.contentTypeKey,
    payload: input.payload ?? {}
  });

  return prisma.$transaction(async (transaction) => {
    const resource = await transaction.courseContentResource.create({
      data: {
        courseId,
        groupId: scope.groupId,
        contentTypeKey: assertPluginKey(input.contentTypeKey, "contentTypeKey"),
        pluginKey: plugin.key,
        title: assertTitle(result.title),
        metadata: toJson(result.metadata)
      }
    });
    const contentItem = await transaction.courseContentItem.create({
      data: {
        courseId,
        groupId: scope.groupId,
        parentId: input.parentId ?? null,
        kind: "content",
        titleSnapshot: resource.title,
        position: await resolvePosition(transaction, courseId, scope.groupId, input.parentId, input.position),
        isVisible: input.isVisible ?? true,
        contentResourceId: resource.id,
        metadata: toJson(input.itemMetadata)
      }
    });
    return { resource, contentItem };
  });
}

export async function updatePluginContentResource(
  user: CurrentUser,
  courseId: string,
  contentResourceId: string,
  input: UpdatePluginContentResourceInput,
  scope: ContentScope = {}
) {
  const resource = await getContentResourceForPluginRoute(user, courseId, contentResourceId, scope);
  await assertCanManageCourse(user, courseId);
  const serverPlugin = getServerContentTypePlugin(resource.pluginKey);
  const update = serverPlugin?.handlers?.update;
  if (!serverPlugin || !update) {
    throw new AppError(400, "CONTENT_TYPE_UPDATE_UNAVAILABLE", "This content type does not support generic updates yet.");
  }
  const result = await update({ user, resource: toServerResourceRecord(resource), payload: input.payload ?? {} });
  return updateContentResource(
    user,
    courseId,
    contentResourceId,
    {
      ...(result.title !== undefined ? { title: result.title } : {}),
      ...(result.metadata !== undefined ? { metadata: result.metadata } : {})
    },
    scope
  );
}

export async function deletePluginContentResource(user: CurrentUser, courseId: string, contentResourceId: string, scope: ContentScope = {}) {
  const resource = await getContentResourceForPluginRoute(user, courseId, contentResourceId, scope);
  await assertCanManageCourse(user, courseId);
  const serverPlugin = getServerContentTypePlugin(resource.pluginKey);
  const remove = serverPlugin?.handlers?.delete;
  if (remove) {
    await remove({ user, resource: toServerResourceRecord(resource) });
  }
  return deleteContentResource(user, courseId, contentResourceId, scope);
}

export async function getContentResourceEmbeddingSource(
  user: CurrentUser,
  courseId: string,
  contentResourceId: string,
  options: ContentScope & { enforceVisibility?: boolean } = {}
): Promise<ContentEmbeddingSource> {
  const resource = await getContentResourceForPluginRoute(user, courseId, contentResourceId, options);
  const serverPlugin = getServerContentTypePlugin(resource.pluginKey);
  const getEmbeddingSource = serverPlugin?.handlers?.getEmbeddingSource;
  if (!serverPlugin || !getEmbeddingSource) {
    return { kind: "none", sourceId: resource.id };
  }
  return getEmbeddingSource({ resource: toServerResourceRecord(resource) });
}

export async function getContentResourceEmbeddingDocuments(
  user: CurrentUser,
  courseId: string,
  contentResourceId: string,
  options: ContentScope & { enforceVisibility?: boolean } = {}
): Promise<ContentEmbeddingDocumentsResult> {
  const resource = await getContentResourceForPluginRoute(user, courseId, contentResourceId, options);
  const serverPlugin = getServerContentTypePlugin(resource.pluginKey);
  const getEmbeddingDocuments = serverPlugin?.handlers?.getEmbeddingDocuments;
  if (!serverPlugin || !getEmbeddingDocuments) {
    return {
      sourceId: resource.id,
      documents: [],
      diagnostics: [
        {
          code: "CONTENT_EMBEDDING_DOCUMENTS_UNAVAILABLE",
          message: "This content type does not expose extracted embedding documents.",
          severity: "warning"
        }
      ]
    };
  }
  return getEmbeddingDocuments({ resource: toServerResourceRecord(resource) });
}

export async function indexContentResourceEmbeddingDocuments(
  user: CurrentUser,
  courseId: string,
  contentResourceId: string,
  options: ContentScope & { enforceVisibility?: boolean } = {}
): Promise<ContentVectorIndexResult> {
  const resource = await getContentResourceForPluginRoute(user, courseId, contentResourceId, options);
  await assertCanManageCourse(user, courseId);
  const serverPlugin = getServerContentTypePlugin(resource.pluginKey);
  const indexEmbeddingDocuments = serverPlugin?.handlers?.indexEmbeddingDocuments;
  if (!serverPlugin || !indexEmbeddingDocuments) {
    return {
      sourceId: resource.id,
      documentCount: 0,
      vectorCount: 0,
      diagnostics: [
        {
          code: "CONTENT_VECTOR_INDEX_UNAVAILABLE",
          message: "This content type does not expose vector indexing.",
          severity: "warning"
        }
      ]
    };
  }
  return indexEmbeddingDocuments({ user, resource: toServerResourceRecord(resource) });
}

export async function searchContentResourceEmbeddingDocuments(
  user: CurrentUser,
  courseId: string,
  input: ContentScope & {
    contentResourceIds: string[];
    enforceVisibility?: boolean;
    limit?: number;
    minScore?: number;
    queryText?: string;
    queryVector?: number[];
  }
): Promise<ContentResourceVectorSearchResult> {
  if (!input.queryText && !input.queryVector) {
    throw new AppError(400, "CONTENT_VECTOR_QUERY_REQUIRED", "Vector search requires query text or a query vector.");
  }

  const limit = Math.max(1, input.limit ?? 10);
  const matches: ContentResourceVectorSearchMatch[] = [];
  const diagnostics: ContentResourceVectorSearchResult["diagnostics"] = [];

  for (const contentResourceId of [...new Set(input.contentResourceIds)]) {
    const resource = await getContentResourceForPluginRoute(user, courseId, contentResourceId, input);
    const serverPlugin = getServerContentTypePlugin(resource.pluginKey);
    const searchEmbeddingDocuments = serverPlugin?.handlers?.searchEmbeddingDocuments;
    if (!serverPlugin || !searchEmbeddingDocuments) {
      diagnostics.push({
        code: "CONTENT_VECTOR_SEARCH_UNAVAILABLE",
        message: "This content type does not expose vector search.",
        severity: "warning",
        contentResourceId: resource.id,
        resourceTitle: resource.title
      });
      continue;
    }

    const result = await searchEmbeddingDocuments({
      user,
      resource: toServerResourceRecord(resource),
      limit,
      minScore: input.minScore,
      queryText: input.queryText,
      queryVector: input.queryVector
    });
    diagnostics.push(
      ...result.diagnostics.map((diagnostic) => ({
        ...diagnostic,
        contentResourceId: resource.id,
        resourceTitle: resource.title
      }))
    );
    matches.push(
      ...result.matches.map((match) => ({
        ...match,
        contentResourceId: resource.id,
        contentTypeKey: resource.contentTypeKey,
        pluginKey: resource.pluginKey,
        resourceTitle: resource.title
      }))
    );
  }

  return {
    diagnostics,
    matches: matches.sort((left, right) => right.score - left.score || left.documentId.localeCompare(right.documentId)).slice(0, limit)
  };
}

export async function getContentResourceForPluginRoute(
  user: CurrentUser,
  courseId: string,
  contentResourceId: string,
  options: ContentScope & { enforceVisibility?: boolean } = {}
) {
  await assertCanViewCourse(user, courseId);
  const scope = normalizeScope(options);
  await assertValidScope(prisma, courseId, scope.groupId);

  const resource = await prisma.courseContentResource.findFirst({
    where: {
      id: contentResourceId,
      courseId,
      ...(scope.groupId ? { OR: [{ groupId: null }, { groupId: scope.groupId }] } : { groupId: null })
    }
  });
  if (!resource) {
    throw notFound("Course content resource");
  }
  await assertContentResourcePluginActive(resource.pluginKey);

  const mustEnforceVisibility = options.enforceVisibility ?? !(await canManageCourse(user, courseId));
  if (mustEnforceVisibility) {
    await assertContentResourceVisible(courseId, contentResourceId, scope.groupId);
  }

  return resource;
}

export async function createActivityContentItem(user: CurrentUser, courseId: string, input: CreateActivityContentItemInput) {
  await assertCanManageCourse(user, courseId);
  if (!input.activityId && !input.courseGroupActivityId) {
    throw new AppError(400, "ACTIVITY_CONTENT_TARGET_REQUIRED", "Activity content must reference an activity or assigned group activity.");
  }
  if (input.activityId && input.courseGroupActivityId) {
    throw new AppError(400, "ACTIVITY_CONTENT_TARGET_AMBIGUOUS", "Activity content cannot reference both an activity and assigned group activity.");
  }

  const target = input.courseGroupActivityId
    ? await assertGroupActivityTarget(courseId, input.courseGroupActivityId, input.groupId)
    : await assertActivityTarget(courseId, input.activityId as string, input.groupId);

  await assertValidScope(prisma, courseId, target.groupId);
  await assertValidParent(prisma, courseId, input.parentId);

  return prisma.courseContentItem.create({
    data: {
      courseId,
      groupId: target.groupId,
      parentId: input.parentId ?? null,
      kind: "activity",
      titleSnapshot: input.titleSnapshot ?? target.title,
      position: await resolvePosition(prisma, courseId, target.groupId, input.parentId, input.position),
      isVisible: input.isVisible ?? true,
      activityId: target.activityId,
      courseGroupActivityId: target.courseGroupActivityId,
      metadata: toJson(input.metadata)
    }
  });
}

export async function updateContentItem(
  user: CurrentUser,
  courseId: string,
  contentItemId: string,
  input: UpdateContentItemInput,
  scope: ContentScope = {}
) {
  await assertCanManageCourse(user, courseId);
  const item = await prisma.courseContentItem.findFirst({ where: { id: contentItemId, courseId, ...scopeWhere(scope) } });
  if (!item) {
    throw notFound("Course content item");
  }

  if (input.parentId !== undefined) {
    await assertCanMoveToParent(prisma, item, input.parentId);
  }

  return prisma.courseContentItem.update({
    where: { id: contentItemId },
    data: {
      ...(input.parentId !== undefined ? { parentId: input.parentId } : {}),
      ...(input.position !== undefined ? { position: assertNonNegativeInteger(input.position, "position") } : {}),
      ...(input.isVisible !== undefined ? { isVisible: input.isVisible } : {}),
      ...(input.titleSnapshot !== undefined ? { titleSnapshot: normalizeOptionalTitle(input.titleSnapshot) } : {}),
      ...(input.metadata !== undefined ? { metadata: toJson(input.metadata) } : {})
    }
  });
}

export async function listContentItems(user: CurrentUser, courseId: string, options: ListContentOptions = {}) {
  await assertCanViewCourse(user, courseId);
  const scope = normalizeScope(options);
  await assertValidScope(prisma, courseId, scope.groupId);
  const items = await prisma.courseContentItem.findMany({
    where: {
      courseId,
      ...(scope.groupId
        ? { OR: [{ groupId: null }, { groupId: scope.groupId }] }
        : options.includeGroupItems
          ? {}
          : { groupId: null })
    },
    orderBy: [{ parentId: "asc" }, { position: "asc" }, { createdAt: "asc" }]
  });
  const scopedItems = removeCourseActivityPlacementsShadowedByGroupAssignments(items, scope.groupId);
  const withVisibility = addEffectiveVisibility(scopedItems);
  return options.visibleOnly ? withVisibility.filter((item) => item.effectiveVisibility === "visible") : withVisibility;
}

function removeCourseActivityPlacementsShadowedByGroupAssignments<
  T extends { activityId: string | null; courseGroupActivityId: string | null; groupId: string | null; kind: string }
>(items: T[], groupId: string | null) {
  if (!groupId) {
    return items;
  }

  const assignedActivityIds = new Set(
    items
      .filter(
        (item) =>
          item.groupId === groupId && item.kind === "activity" && Boolean(item.courseGroupActivityId) && typeof item.activityId === "string"
      )
      .map((item) => item.activityId as string)
  );

  return items.filter(
    (item) =>
      !(item.groupId === null && item.kind === "activity" && typeof item.activityId === "string" && assignedActivityIds.has(item.activityId))
  );
}

export async function deleteContentItem(user: CurrentUser, courseId: string, contentItemId: string, scope: ContentScope = {}) {
  await assertCanManageCourse(user, courseId);
  const item = await prisma.courseContentItem.findFirst({ where: { id: contentItemId, courseId, ...scopeWhere(scope) } });
  if (!item) {
    throw notFound("Course content item");
  }
  await prisma.courseContentItem.delete({ where: { id: contentItemId } });
  return { ok: true };
}

function normalizeScope(input: ContentScope) {
  return {
    groupId: input.groupId ?? null
  };
}

function scopeWhere(scope: ContentScope) {
  return scope.groupId === undefined ? {} : { groupId: scope.groupId ?? null };
}

async function assertValidScope(db: CourseContentDb, courseId: string, groupId: string | null) {
  if (!groupId) {
    return;
  }
  const group = await db.courseGroup.findFirst({ where: { id: groupId, courseId }, select: { id: true } });
  if (!group) {
    throw notFound("Course group");
  }
}

async function assertValidParent(db: CourseContentDb, courseId: string, parentId: string | null | undefined) {
  if (!parentId) {
    return;
  }
  const parent = await db.courseContentItem.findFirst({
    where: { id: parentId, courseId, groupId: null, kind: "folder" },
    select: { id: true }
  });
  if (!parent) {
    throw notFound("Parent folder");
  }
}

async function assertActivityTarget(courseId: string, activityId: string, groupId: string | null | undefined) {
  const activity = await prisma.activity.findFirst({ where: { id: activityId, courseId }, select: { id: true, title: true } });
  if (!activity) {
    throw notFound("Activity");
  }
  return {
    groupId: groupId ?? null,
    activityId: activity.id,
    courseGroupActivityId: null,
    title: activity.title
  };
}

async function assertGroupActivityTarget(courseId: string, courseGroupActivityId: string, expectedGroupId: string | null | undefined) {
  const groupActivity = await prisma.courseGroupActivity.findFirst({
    where: {
      id: courseGroupActivityId,
      group: { courseId }
    },
    include: {
      activity: { select: { id: true, title: true } },
      group: { select: { id: true } }
    }
  });
  if (!groupActivity) {
    throw notFound("Assigned group activity");
  }
  if (expectedGroupId && expectedGroupId !== groupActivity.group.id) {
    throw new AppError(400, "CONTENT_GROUP_SCOPE_MISMATCH", "Assigned activity content must use the assignment group scope.");
  }
  return {
    groupId: groupActivity.group.id,
    activityId: groupActivity.activity.id,
    courseGroupActivityId: groupActivity.id,
    title: groupActivity.activity.title
  };
}

async function resolvePosition(
  db: CourseContentDb,
  courseId: string,
  groupId: string | null,
  parentId: string | null | undefined,
  position: number | undefined
) {
  if (position !== undefined) {
    return assertNonNegativeInteger(position, "position");
  }
  return db.courseContentItem.count({ where: { courseId, groupId, parentId: parentId ?? null } });
}

async function assertCanMoveToParent(
  db: CourseContentDb,
  item: { id: string; courseId: string; groupId: string | null },
  parentId: string | null
) {
  if (!parentId) {
    return;
  }
  if (parentId === item.id) {
    throw new AppError(400, "INVALID_CONTENT_PARENT", "A content item cannot be moved inside itself.");
  }
  await assertValidParent(db, item.courseId, parentId);
  const descendants = await collectDescendantIds(db, item.id);
  if (descendants.has(parentId)) {
    throw new AppError(400, "INVALID_CONTENT_PARENT", "A folder cannot be moved inside one of its descendants.");
  }
}

async function collectDescendantIds(db: CourseContentDb, itemId: string) {
  const descendantIds = new Set<string>();
  let frontier = [itemId];
  while (frontier.length) {
    const children = await db.courseContentItem.findMany({
      where: { parentId: { in: frontier } },
      select: { id: true }
    });
    frontier = children.map((child) => child.id).filter((id) => !descendantIds.has(id));
    frontier.forEach((id) => descendantIds.add(id));
  }
  return descendantIds;
}

function addEffectiveVisibility<T extends { id: string; parentId: string | null; isVisible: boolean }>(items: T[]) {
  const byId = new Map(items.map((item) => [item.id, item]));
  const cache = new Map<string, EffectiveContentVisibility>();

  function resolve(item: T, stack = new Set<string>()): EffectiveContentVisibility {
    if (cache.has(item.id)) {
      return cache.get(item.id) as EffectiveContentVisibility;
    }
    if (!item.isVisible) {
      cache.set(item.id, "hidden");
      return "hidden";
    }
    if (!item.parentId) {
      cache.set(item.id, "visible");
      return "visible";
    }
    if (stack.has(item.id)) {
      cache.set(item.id, "hidden_by_parent");
      return "hidden_by_parent";
    }
    const parent = byId.get(item.parentId);
    if (!parent) {
      cache.set(item.id, "visible");
      return "visible";
    }
    const parentVisibility = resolve(parent, new Set([...stack, item.id]));
    const visibility = parentVisibility === "visible" ? "visible" : "hidden_by_parent";
    cache.set(item.id, visibility);
    return visibility;
  }

  return items.map((item) => ({
    ...item,
    effectiveVisibility: resolve(item)
  }));
}

async function assertContentResourceVisible(courseId: string, contentResourceId: string, groupId: string | null) {
  const visibleResourceIds = await getVisibleContentResourceIds(courseId, groupId);
  if (!visibleResourceIds.has(contentResourceId)) {
    throw new AppError(404, "CONTENT_RESOURCE_NOT_AVAILABLE", "This content resource is not available.");
  }
}

async function getVisibleContentResourceIds(courseId: string, groupId: string | null) {
  const items = await prisma.courseContentItem.findMany({
    where: {
      courseId,
      ...(groupId ? { OR: [{ groupId: null }, { groupId }] } : { groupId: null })
    },
    orderBy: [{ parentId: "asc" }, { position: "asc" }, { createdAt: "asc" }]
  });
  const visibleItems = addEffectiveVisibility(items);
  return new Set(
    visibleItems
      .filter((item) => item.contentResourceId && item.effectiveVisibility === "visible")
      .map((item) => item.contentResourceId as string)
  );
}

function toServerResourceRecord(resource: {
  id: string;
  courseId: string;
  groupId: string | null;
  contentTypeKey: string;
  pluginKey: string;
  title: string;
  metadata: unknown;
}) {
  return {
    id: resource.id,
    courseId: resource.courseId,
    groupId: resource.groupId,
    contentTypeKey: resource.contentTypeKey,
    pluginKey: resource.pluginKey,
    title: resource.title,
    metadata: (resource.metadata as Record<string, unknown> | null) ?? undefined
  };
}

function assertTitle(title: string) {
  const normalized = title.trim();
  if (!normalized) {
    throw new AppError(400, "CONTENT_TITLE_REQUIRED", "Content folders require a title.");
  }
  return normalized;
}

function assertPluginKey(value: string, field: string) {
  const normalized = value.trim();
  if (!/^[a-z0-9][a-z0-9_-]*$/.test(normalized)) {
    throw new AppError(400, "INVALID_CONTENT_PLUGIN_KEY", `${field} must be a plugin key.`);
  }
  return normalized;
}

function normalizeOptionalTitle(title: string | null) {
  if (title === null) {
    return null;
  }
  return assertTitle(title);
}

function assertNonNegativeInteger(value: number, field: string) {
  if (!Number.isInteger(value) || value < 0) {
    throw new AppError(400, "INVALID_CONTENT_POSITION", `${field} must be a non-negative integer.`);
  }
  return value;
}

function toJson(value: unknown) {
  return (value ?? {}) as Prisma.InputJsonValue;
}
