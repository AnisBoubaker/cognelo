import { z } from "zod";
import { reconcileMediaAssetReferences } from "./media-assets";
import { assertCanViewGroup } from "./groups";
import { Prisma, prisma } from "@cognelo/db";
import { getContentTypePluginForType } from "@cognelo/content-type-sdk";
import {
  getServerContentTypePlugin,
  type ContentEmbeddingDiagnostic,
  type ContentEmbeddingDocumentsResult,
  type ContentEmbeddingSource,
  type ContentTypeCreateResult,
  type ContentTypePersistHandler,
  type ContentVectorIndexResult,
  type ContentVectorSearchMatch
} from "@cognelo/content-type-sdk/server";
import { CourseContentDuplicateSchema, type CurrentUser } from "@cognelo/contracts";
import { assertCanManageCourse, assertCanViewCourse, canManageCourse } from "./authorization";
import { AppError, notFound } from "./errors";
import { assignmentExceptionsForUser } from "./activity-assignment-exceptions";
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
  isVisible?: boolean;
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
  "activity" | "courseContentItem" | "courseContentResource" | "courseGroup" | "courseGroupActivity" | "courseGroupContentVisibilityOverride" | "courseMaterial"
>;

const contentFields = {
  groupId: z.string().min(1).max(128).nullable().optional(),
  parentId: z.string().min(1).max(128).nullable().optional(),
  position: z.number().int().min(0).max(2_147_483_647).optional(),
  isVisible: z.boolean().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  titleSnapshot: z.string().trim().min(1).max(180).nullable().optional()
};
const folderInputSchema = z.object({ ...contentFields, title: z.string().trim().min(1).max(180) });
const materialItemInputSchema = z.object({ ...contentFields, materialId: z.string().min(1).max(128) });
const activityItemInputSchema = z.object({ ...contentFields, activityId: z.string().min(1).max(128).nullable().optional(), courseGroupActivityId: z.string().min(1).max(128).nullable().optional() });
const contentItemUpdateSchema = z.object(contentFields);
const pluginResourceInputSchema = z.object({ ...contentFields, contentTypeKey: z.string().min(1).max(80), payload: z.unknown().optional(), itemMetadata: z.record(z.string(), z.unknown()).optional() });
const pluginResourceUpdateSchema = z.object({ payload: z.unknown().optional(), isVisible: z.boolean().optional() });

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

export async function createContentFolder(user: CurrentUser, courseId: string, rawInput: unknown) {
  const input: CreateFolderInput = folderInputSchema.parse(rawInput);
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

export async function createMaterialContentItem(user: CurrentUser, courseId: string, rawInput: unknown) {
  const input: CreateMaterialContentItemInput = materialItemInputSchema.parse(rawInput);
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

  const visibleResourceIds = new Set((await listContentItems(user, courseId, { groupId: scope.groupId, visibleOnly: true })).map((item) => item.contentResourceId));
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

export async function duplicateCourseContentItem(user: CurrentUser, courseId: string, contentItemId: string, input: unknown) {
  await assertCanManageCourse(user, courseId);
  const data = CourseContentDuplicateSchema.parse(input);
  const source = await prisma.courseContentItem.findFirst({
    where: { id: contentItemId, courseId, groupId: null, kind: "content" },
    include: { contentResource: true, material: true }
  });
  if (!source || (!source.contentResource && !source.material)) throw notFound("Course content item");
  const position = await prisma.courseContentItem.count({ where: { courseId, groupId: null, parentId: source.parentId } });

  let resourceCopy: ContentTypeCreateResult | null = null;
  if (source.contentResource) {
    const plugin = getServerContentTypePlugin(source.contentResource.pluginKey);
    if (!plugin?.handlers?.duplicate) {
      throw new AppError(400, "CONTENT_TYPE_DUPLICATE_UNAVAILABLE", "This content type does not support duplication.");
    }
    resourceCopy = await plugin.handlers.duplicate({
      user,
      resource: toServerResourceRecord(source.contentResource),
      title: data.title
    });
  }

  return prisma.$transaction(async (transaction) => {
    const contentResource = source.contentResource && resourceCopy
      ? await transaction.courseContentResource.create({ data: {
          courseId,
          groupId: null,
          contentTypeKey: source.contentResource.contentTypeKey,
          pluginKey: source.contentResource.pluginKey,
          title: assertTitle(resourceCopy.title),
          metadata: toJson(resourceCopy.metadata)
        } })
      : null;
    const material = source.material
      ? await transaction.courseMaterial.create({ data: {
          courseId,
          parentId: source.material.parentId,
          title: data.title,
          kind: source.material.kind,
          body: source.material.body,
          url: source.material.url,
          metadata: source.material.metadata as Prisma.InputJsonValue,
          position: source.material.position + 1,
          createdById: user.id
        } })
      : null;
    const contentItem = await transaction.courseContentItem.create({ data: {
      courseId,
      groupId: null,
      parentId: source.parentId,
      kind: "content",
      titleSnapshot: data.title,
      position,
      isVisible: source.isVisible,
      contentResourceId: contentResource?.id,
      materialId: material?.id,
      metadata: source.metadata as Prisma.InputJsonValue
    } });
    if (contentResource) await reconcileContentResourceMedia(transaction, contentResource, user.id, true);
    if (contentResource && resourceCopy?.afterPersist) {
      await runContentTypePersist(resourceCopy.afterPersist, transaction, contentResource);
    }
    return { contentItem, contentResource, material };
  });
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

export async function createPluginContentResource(user: CurrentUser, courseId: string, rawInput: unknown) {
  const input: CreatePluginContentResourceInput = pluginResourceInputSchema.parse(rawInput);
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
    await reconcileContentResourceMedia(transaction, resource, user.id);
    if (result.afterPersist) await runContentTypePersist(result.afterPersist, transaction, resource);
    return { resource, contentItem };
  });
}

export async function updatePluginContentResource(
  user: CurrentUser,
  courseId: string,
  contentResourceId: string,
  rawInput: unknown,
  scope: ContentScope = {}
) {
  const input: UpdatePluginContentResourceInput = pluginResourceUpdateSchema.parse(rawInput);
  const resource = await getContentResourceForPluginRoute(user, courseId, contentResourceId, scope);
  await assertCanManageCourse(user, courseId);
  const serverPlugin = getServerContentTypePlugin(resource.pluginKey);
  const update = serverPlugin?.handlers?.update;
  if (!serverPlugin || !update) {
    throw new AppError(400, "CONTENT_TYPE_UPDATE_UNAVAILABLE", "This content type does not support generic updates yet.");
  }
  const result = await update({ user, resource: toServerResourceRecord(resource), payload: input.payload ?? {} });
  const isVisible = z.boolean().optional().parse(input.isVisible);
  if (result.afterPersist || contentResourceMarkdownFields(resource.contentTypeKey).length || isVisible !== undefined) {
    return prisma.$transaction(async (transaction) => {
      const updated = await transaction.courseContentResource.update({
        where: { id: resource.id },
        data: {
          ...(result.title !== undefined ? { title: assertTitle(result.title) } : {}),
          ...(result.metadata !== undefined ? { metadata: toJson(result.metadata) } : {})
        }
      });
      await reconcileContentResourceMedia(transaction, updated, user.id);
      await transaction.courseContentItem.updateMany({
        where: { contentResourceId: resource.id },
        data: { titleSnapshot: updated.title, ...(isVisible !== undefined ? { isVisible } : {}) }
      });
      if (result.afterPersist) await runContentTypePersist(result.afterPersist, transaction, updated);
      return updated;
    });
  }
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

/** Reader/editor page data. Learners must use their section so overrides cannot be bypassed. */
export async function getContentResourcePage(user: CurrentUser, courseId: string, resourceId: string, scope: ContentScope = {}) {
  const canManage = await canManageCourse(user, courseId);
  if (scope.groupId) await assertCanViewGroup(user, courseId, scope.groupId);
  else await assertCanManageCourse(user, courseId);
  const resource = await getContentResourceForPluginRoute(user, courseId, resourceId, scope);
  const contentItem = await prisma.courseContentItem.findFirst({ where: { contentResourceId: resource.id } });
  return { resource, contentItem, canManage };
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

  const mustEnforceVisibility = options.enforceVisibility === true || !(await canManageCourse(user, courseId));
  if (mustEnforceVisibility) {
    const visible = await listContentItems(user, courseId, { groupId: scope.groupId, visibleOnly: true });
    if (!visible.some((item) => item.contentResourceId === contentResourceId)) throw new AppError(404, "CONTENT_RESOURCE_NOT_AVAILABLE", "This content resource is not available.");
  }

  return resource;
}

export async function createActivityContentItem(user: CurrentUser, courseId: string, rawInput: unknown) {
  const input: CreateActivityContentItemInput = activityItemInputSchema.parse(rawInput);
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
  rawInput: unknown,
  scope: ContentScope = {}
) {
  const input: UpdateContentItemInput = contentItemUpdateSchema.parse(rawInput);
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

export async function updateGroupContentItem(
  user: CurrentUser,
  courseId: string,
  groupId: string,
  contentItemId: string,
  rawInput: unknown
) {
  const input: UpdateContentItemInput = contentItemUpdateSchema.parse(rawInput);
  await assertCanManageCourse(user, courseId);
  await assertValidScope(prisma, courseId, groupId);
  const item = await prisma.courseContentItem.findFirst({
    where: {
      id: contentItemId,
      courseId,
      OR: [{ groupId }, { groupId: null }]
    }
  });
  if (!item) {
    throw notFound("Course content item");
  }

  if (item.groupId === groupId) {
    return updateContentItem(user, courseId, contentItemId, input, { groupId });
  }

  const hasNonVisibilityUpdate = Object.entries(input).some(([key, value]) => key !== "isVisible" && value !== undefined);
  if (input.isVisible === undefined || hasNonVisibilityUpdate) {
    throw new AppError(
      400,
      "GROUP_INHERITED_CONTENT_VISIBILITY_ONLY",
      "A group can only override the visibility of inherited course content."
    );
  }

  if (input.isVisible === item.isVisible) {
    await prisma.courseGroupContentVisibilityOverride.deleteMany({ where: { groupId, contentItemId } });
  } else {
    await prisma.courseGroupContentVisibilityOverride.upsert({
      where: { groupId_contentItemId: { groupId, contentItemId } },
      create: { groupId, contentItemId, isVisible: input.isVisible },
      update: { isVisible: input.isVisible }
    });
  }

  return { ...item, isVisible: input.isVisible };
}

export async function listContentItems(user: CurrentUser, courseId: string, options: ListContentOptions = {}) {
  await assertCanViewCourse(user, courseId);
  const scope = normalizeScope(options);
  const manager = await canManageCourse(user, courseId);
  if (!manager && !scope.groupId) {
    const groups = await prisma.courseGroup.findMany({ where: { courseId, participants: { some: { userId: user.id } } }, select: { id: true } });
    const visible = new Map<string, Awaited<ReturnType<typeof listScopedContentItems>>[number]>();
    for (const group of groups) {
      try {
        for (const item of await listScopedContentItems(user, courseId, { groupId: group.id, visibleOnly: true })) visible.set(item.id, item);
      } catch (error) { if (!(error instanceof AppError && error.status === 403)) throw error; }
    }
    return [...visible.values()];
  }
  return listScopedContentItems(user, courseId, options);
}

async function listScopedContentItems(user: CurrentUser, courseId: string, options: ListContentOptions) {
  const scope = normalizeScope(options);
  const manager = await canManageCourse(user, courseId);
  if (scope.groupId && !manager) await assertCanViewGroup(user, courseId, scope.groupId);
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
  const overrides = scope.groupId
    ? await prisma.courseGroupContentVisibilityOverride.findMany({ where: { groupId: scope.groupId } })
    : [];
  let effectiveItems = applyGroupVisibilityOverrides(items, overrides);
  if (!manager && scope.groupId) {
    const hidden = await prisma.courseGroupHiddenCourseMaterial.findMany({ where: { groupId: scope.groupId }, select: { courseMaterialId: true } });
    if (hidden.length) {
      const hiddenIds = new Set(hidden.map((entry) => entry.courseMaterialId));
      const materials = await prisma.courseMaterial.findMany({ where: { courseId }, select: { id: true, parentId: true } });
      const parents = new Map(materials.map((item) => [item.id, item.parentId]));
      const hiddenMaterial = (id: string) => {
        const seen = new Set<string>();
        let current: string | null = id;
        while (current) { if (hiddenIds.has(current) || seen.has(current)) return true; seen.add(current); current = parents.get(current) ?? null; }
        return false;
      };
      effectiveItems = effectiveItems.map((item) => item.materialId && hiddenMaterial(item.materialId) ? { ...item, isVisible: false } : item);
    }
  }
  if (scope.groupId && !await canManageCourse(user, courseId)) {
    const assignmentByActivity = new Map(items.filter((item) => item.groupId === scope.groupId && item.courseGroupActivityId).map((item) => [item.activityId, item.courseGroupActivityId!]));
    const exceptions = await assignmentExceptionsForUser([...assignmentByActivity.values()], user.id);
    effectiveItems = effectiveItems.map((item) => {
      const assignmentId = item.courseGroupActivityId ?? assignmentByActivity.get(item.activityId);
      const isVisible = assignmentId ? exceptions.get(assignmentId)?.isVisible : undefined;
      return item.kind === "activity" && isVisible !== undefined ? { ...item, isVisible } : item;
    });
  }
  const withVisibility = addEffectiveVisibility(effectiveItems);
  const scopedItems = mergeGroupAssignmentsIntoSharedActivityPlacements(withVisibility, scope.groupId);
  return manager && !options.visibleOnly ? scopedItems : scopedItems.filter((item) =>
    item.effectiveVisibility === "visible" && (manager || item.kind !== "activity" || Boolean(item.courseGroupActivityId)));
}

function applyGroupVisibilityOverrides<T extends { id: string; isVisible: boolean }>(
  items: T[],
  overrides: Array<{ contentItemId: string; isVisible: boolean }>
) {
  if (!overrides.length) {
    return items;
  }
  const visibilityByItemId = new Map(overrides.map((override) => [override.contentItemId, override.isVisible]));
  return items.map((item) => visibilityByItemId.has(item.id)
    ? { ...item, isVisible: visibilityByItemId.get(item.id) as boolean }
    : item);
}

function mergeGroupAssignmentsIntoSharedActivityPlacements<
  T extends {
    activityId: string | null;
    courseGroupActivityId: string | null;
    effectiveVisibility: EffectiveContentVisibility;
    groupId: string | null;
    kind: string;
  }
>(items: T[], groupId: string | null) {
  if (!groupId) {
    return items;
  }

  const groupAssignmentByActivityId = new Map(
    items
      .filter(
        (item) =>
          item.groupId === groupId && item.kind === "activity" && Boolean(item.courseGroupActivityId) && typeof item.activityId === "string"
      )
      .map((item) => [item.activityId as string, item] as const)
  );
  const sharedActivityIds = new Set(
    items
      .filter((item) => item.groupId === null && item.kind === "activity" && typeof item.activityId === "string")
      .map((item) => item.activityId as string)
  );

  return items
    .filter(
      (item) =>
        !(
          item.groupId === groupId &&
          item.kind === "activity" &&
          typeof item.activityId === "string" &&
          Boolean(item.courseGroupActivityId) &&
          sharedActivityIds.has(item.activityId)
        )
    )
    .map((item) => {
      if (
        item.groupId === null &&
        item.kind === "activity" &&
        typeof item.activityId === "string"
      ) {
        const groupAssignment = groupAssignmentByActivityId.get(item.activityId);
        if (groupAssignment?.courseGroupActivityId) {
          return { ...item, courseGroupActivityId: groupAssignment.courseGroupActivityId };
        }
      }
      return item;
    });
}

export type CourseContentDeletionActivity = {
  activityId: string;
  activityTypeKey: string;
  isTest: boolean;
  title: string;
  recordedAttemptCount: number;
  testItems: Array<{ activityId: string; activityTypeKey: string }>;
};

export type CourseContentItemDeletionImpact = {
  contentItemId: string;
  kind: string;
  parentId: string | null;
  activities: CourseContentDeletionActivity[];
  blockedActivities: CourseContentDeletionActivity[];
  preservedActivityContentItemIds: string[];
};

export async function getCourseContentItemDeletionImpact(
  user: CurrentUser,
  courseId: string,
  contentItemId: string,
  scope: ContentScope = {}
): Promise<CourseContentItemDeletionImpact> {
  await assertCanManageCourse(user, courseId);
  return resolveCourseContentItemDeletionImpact(courseId, contentItemId, scope);
}

export async function deleteContentItem(user: CurrentUser, courseId: string, contentItemId: string, scope: ContentScope = {}) {
  await assertCanManageCourse(user, courseId);
  const impact = await resolveCourseContentItemDeletionImpact(courseId, contentItemId, scope);
  if (impact.kind === "activity") {
    throw new AppError(
      409,
      "ACTIVITY_CONTENT_DELETE_REQUIRES_ACTIVITY_DELETE",
      "Delete the activity itself instead of deleting only its course-content placement."
    );
  }
  if (impact.blockedActivities.length) {
    throw new AppError(
      409,
      "CONTENT_FOLDER_ACTIVITIES_HAVE_ATTEMPTS",
      "This folder contains activities with recorded attempts and cannot be deleted as a batch.",
      {
        activities: impact.blockedActivities.map((activity) => ({
          activityId: activity.activityId,
          title: activity.title,
          recordedAttemptCount: activity.recordedAttemptCount
        }))
      }
    );
  }

  if (impact.kind === "folder" && (impact.activities.length || impact.preservedActivityContentItemIds.length)) {
    await prisma.$transaction(async (transaction) => {
      if (impact.preservedActivityContentItemIds.length) {
        await transaction.courseContentItem.updateMany({
          where: { id: { in: impact.preservedActivityContentItemIds } },
          data: { parentId: impact.parentId }
        });
      }
      const testItemActivityIds = impact.activities.flatMap((activity) => activity.testItems.map((item) => item.activityId));
      if (testItemActivityIds.length) {
        await transaction.activity.deleteMany({ where: { id: { in: testItemActivityIds } } });
      }
      if (impact.activities.length) {
        await transaction.activity.deleteMany({
          where: { id: { in: impact.activities.map((activity) => activity.activityId) } }
        });
      }
      await transaction.courseContentItem.delete({ where: { id: contentItemId } });
    });
    return { ok: true };
  }

  await prisma.courseContentItem.delete({ where: { id: contentItemId } });
  return { ok: true };
}

async function resolveCourseContentItemDeletionImpact(
  courseId: string,
  contentItemId: string,
  scope: ContentScope
): Promise<CourseContentItemDeletionImpact> {
  const item = await prisma.courseContentItem.findFirst({
    where: { id: contentItemId, courseId, ...scopeWhere(scope) },
    select: { id: true, kind: true, parentId: true }
  });
  if (!item) {
    throw notFound("Course content item");
  }
  if (item.kind !== "folder") {
    return {
      contentItemId: item.id,
      kind: item.kind,
      parentId: item.parentId,
      activities: [],
      blockedActivities: [],
      preservedActivityContentItemIds: []
    };
  }

  const courseItems = await prisma.courseContentItem.findMany({
    where: { courseId },
    select: {
      id: true,
      parentId: true,
      groupId: true,
      activity: {
        select: {
          id: true,
          title: true,
          activityType: { select: { key: true } },
          _count: { select: { activityAttempts: true } },
          testDefinition: {
            select: {
              items: {
                select: {
                  activity: { select: { id: true, activityType: { select: { key: true } } } }
                }
              }
            }
          }
        }
      }
    }
  });
  const childIdsByParent = new Map<string, string[]>();
  for (const courseItem of courseItems) {
    if (!courseItem.parentId) continue;
    childIdsByParent.set(courseItem.parentId, [...(childIdsByParent.get(courseItem.parentId) ?? []), courseItem.id]);
  }
  const descendantIds = new Set<string>();
  const pending = [...(childIdsByParent.get(contentItemId) ?? [])];
  while (pending.length) {
    const descendantId = pending.pop() as string;
    if (descendantIds.has(descendantId)) continue;
    descendantIds.add(descendantId);
    pending.push(...(childIdsByParent.get(descendantId) ?? []));
  }

  const activityPlacementsById = new Map<string, typeof courseItems>();
  for (const courseItem of courseItems) {
    if (!courseItem.activity) continue;
    activityPlacementsById.set(courseItem.activity.id, [
      ...(activityPlacementsById.get(courseItem.activity.id) ?? []),
      courseItem
    ]);
  }
  const activitiesById = new Map<string, CourseContentDeletionActivity>();
  const preservedActivityContentItemIds: string[] = [];
  for (const [activityId, placements] of activityPlacementsById) {
    const descendantPlacements = placements.filter((placement) => descendantIds.has(placement.id));
    if (!descendantPlacements.length) continue;
    const sharedPlacements = placements.filter((placement) => placement.groupId === null);
    const shouldDeleteActivity = sharedPlacements.length
      ? sharedPlacements.some((placement) => descendantIds.has(placement.id))
      : placements.every((placement) => descendantIds.has(placement.id));
    if (!shouldDeleteActivity) {
      preservedActivityContentItemIds.push(...descendantPlacements.map((placement) => placement.id));
      continue;
    }
    const activity = placements[0].activity;
    if (!activity) continue;
    activitiesById.set(activity.id, {
      activityId,
      activityTypeKey: activity.activityType.key,
      isTest: activity.testDefinition !== null,
      title: activity.title,
      recordedAttemptCount: activity._count.activityAttempts,
      testItems: activity.testDefinition?.items.map((testItem) => ({
        activityId: testItem.activity.id,
        activityTypeKey: testItem.activity.activityType.key
      })) ?? []
    });
  }
  const activities = [...activitiesById.values()];
  return {
    contentItemId: item.id,
    kind: item.kind,
    parentId: item.parentId,
    activities,
    blockedActivities: activities.filter((activity) => activity.recordedAttemptCount > 0),
    preservedActivityContentItemIds
  };
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
  const activity = await prisma.activity.findFirst({
    where: { id: activityId, courseId, testItem: null },
    select: { id: true, title: true }
  });
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

function contentResourceMarkdownFields(contentTypeKey: string) {
  return getContentTypePluginForType(contentTypeKey)?.contentTypes?.find((type) => type.key === contentTypeKey)?.markdownFields ?? [];
}

async function reconcileContentResourceMedia(transaction: Prisma.TransactionClient, resource: { id: string; contentTypeKey: string; metadata: unknown }, actorId: string, trustedCopy = false) {
  const fields = contentResourceMarkdownFields(resource.contentTypeKey);
  if (!fields.length) return;
  const metadata = resource.metadata as Record<string, unknown> | null;
  await reconcileMediaAssetReferences(transaction, { contentResourceId: resource.id }, Object.fromEntries(fields.map((field) => [field, metadata?.[field]])), { actorId, trustedCopy });
}

async function runContentTypePersist(handler: ContentTypePersistHandler, transaction: Prisma.TransactionClient, resource: Parameters<typeof toServerResourceRecord>[0]) {
  await handler({
    resource: toServerResourceRecord(resource),
    transaction: {
      query: <T = unknown>(query: TemplateStringsArray, ...values: unknown[]) => transaction.$queryRaw<T>(query, ...values),
      execute: (query, ...values) => transaction.$executeRaw(query, ...values)
    }
  });
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
