import { Prisma, prisma } from "@cognelo/db";
import type { CurrentUser } from "@cognelo/contracts";
import { assertCanManageCourse, assertCanViewCourse } from "./authorization";
import { AppError, notFound } from "./errors";

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
  "activity" | "courseContentItem" | "courseGroup" | "courseGroupActivity" | "courseMaterial"
>;

export type EffectiveContentVisibility = "visible" | "hidden" | "hidden_by_parent";

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
      kind: "material",
      titleSnapshot: input.titleSnapshot ?? material.title,
      position: await resolvePosition(prisma, courseId, scope.groupId, input.parentId, input.position),
      isVisible: input.isVisible ?? true,
      materialId: material.id,
      metadata: toJson(input.metadata)
    }
  });
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
  const withVisibility = addEffectiveVisibility(items);
  return options.visibleOnly ? withVisibility.filter((item) => item.effectiveVisibility === "visible") : withVisibility;
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

function assertTitle(title: string) {
  const normalized = title.trim();
  if (!normalized) {
    throw new AppError(400, "CONTENT_TITLE_REQUIRED", "Content folders require a title.");
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
