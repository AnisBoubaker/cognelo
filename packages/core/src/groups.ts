import {
  CourseGroupStatus,
  CourseGroupActivityInputSchema,
  CourseGroupActivityUpdateSchema,
  CourseGroupInputSchema,
  CourseGroupMaterialInputSchema,
  CourseGroupMaterialUpdateSchema,
  CourseGroupUpdateSchema
} from "@cognelo/contracts";
import { Prisma, prisma } from "@cognelo/db";
import type { CurrentUser } from "@cognelo/contracts";
import { assertCanManageCourse, assertCanViewCourse, canManageCourse } from "./authorization";
import { AppError, notFound } from "./errors";

const groupInclude = {
  materials: { orderBy: [{ position: "asc" as const }, { createdAt: "asc" as const }] },
  activities: {
    include: {
      activity: {
        include: { activityType: true }
      }
    },
    orderBy: [{ position: "asc" as const }, { createdAt: "asc" as const }]
  }
};

export async function listCourseGroups(user: CurrentUser, courseId: string) {
  await assertCanViewCourse(user, courseId);
  const isManager = await canManageCourse(user, courseId);
  return prisma.courseGroup.findMany({
    where: {
      courseId,
      ...(isManager ? {} : buildVisibleGroupWhere())
    },
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }]
  });
}

export async function getCourseGroup(user: CurrentUser, courseId: string, groupId: string) {
  await assertCanViewCourse(user, courseId);
  const isManager = await canManageCourse(user, courseId);
  const group = await prisma.courseGroup.findFirst({
    where: {
      id: groupId,
      courseId,
      ...(isManager ? {} : buildVisibleGroupWhere())
    },
    include: groupInclude
  });
  if (!group) {
    throw notFound("Course group");
  }
  return group;
}

export async function createCourseGroup(user: CurrentUser, courseId: string, input: unknown) {
  await assertCanManageCourse(user, courseId);
  const data = CourseGroupInputSchema.parse(input);
  return prisma.courseGroup.create({
    data: {
      ...data,
      status: "draft",
      courseId,
      createdById: user.id
    }
  });
}

export async function updateCourseGroup(user: CurrentUser, courseId: string, groupId: string, input: unknown) {
  await assertCanManageCourse(user, courseId);
  const data = CourseGroupUpdateSchema.parse(input);
  await assertGroupBelongsToCourse(courseId, groupId);
  return prisma.courseGroup.update({
    where: { id: groupId },
    data: {
      title: data.title,
      status: data.status,
      availableFrom: data.availableFrom !== undefined ? parseDateInput(data.availableFrom) : undefined,
      availableUntil: data.availableUntil !== undefined ? parseDateInput(data.availableUntil) : undefined
    }
  });
}

export async function deleteCourseGroup(user: CurrentUser, courseId: string, groupId: string) {
  await assertCanManageCourse(user, courseId);
  await assertGroupBelongsToCourse(courseId, groupId);
  await prisma.courseGroup.delete({ where: { id: groupId } });
  return { ok: true };
}

export async function listGroupMaterials(user: CurrentUser, courseId: string, groupId: string) {
  await assertCanViewCourse(user, courseId);
  await assertGroupBelongsToCourse(courseId, groupId);
  return prisma.courseGroupMaterial.findMany({
    where: { groupId },
    orderBy: [{ position: "asc" }, { createdAt: "asc" }]
  });
}

export async function createGroupMaterial(user: CurrentUser, courseId: string, groupId: string, input: unknown) {
  await assertCanManageCourse(user, courseId);
  await assertGroupBelongsToCourse(courseId, groupId);
  const data = CourseGroupMaterialInputSchema.parse(input);
  await assertValidGroupMaterialParent(groupId, data.parentId);
  return prisma.courseGroupMaterial.create({
    data: {
      ...data,
      metadata: data.metadata as Prisma.InputJsonValue,
      groupId,
      createdById: user.id
    }
  });
}

export async function updateGroupMaterial(user: CurrentUser, courseId: string, groupId: string, materialId: string, input: unknown) {
  await assertCanManageCourse(user, courseId);
  await assertGroupBelongsToCourse(courseId, groupId);
  const data = CourseGroupMaterialUpdateSchema.parse(input);
  const material = await prisma.courseGroupMaterial.findFirst({ where: { id: materialId, groupId } });
  if (!material) {
    throw notFound("Group material");
  }
  if (data.parentId === materialId) {
    throw new AppError(400, "INVALID_MATERIAL_PARENT", "A material cannot be moved inside itself.");
  }
  await assertValidGroupMaterialParent(groupId, data.parentId);
  return prisma.courseGroupMaterial.update({
    where: { id: materialId },
    data: {
      ...data,
      metadata: data.metadata as Prisma.InputJsonValue | undefined
    }
  });
}

export async function getGroupMaterialForDownload(user: CurrentUser, courseId: string, groupId: string, materialId: string) {
  await assertCanViewCourse(user, courseId);
  await assertGroupBelongsToCourse(courseId, groupId);
  const material = await prisma.courseGroupMaterial.findFirst({
    where: { id: materialId, groupId, kind: "file" }
  });
  if (!material) {
    throw notFound("Group material");
  }
  return material;
}

export async function deleteGroupMaterial(user: CurrentUser, courseId: string, groupId: string, materialId: string) {
  await assertCanManageCourse(user, courseId);
  await assertGroupBelongsToCourse(courseId, groupId);
  const material = await prisma.courseGroupMaterial.findFirst({ where: { id: materialId, groupId } });
  if (!material) {
    throw notFound("Group material");
  }
  await prisma.courseGroupMaterial.delete({ where: { id: materialId } });
  return { ok: true };
}

export async function listGroupActivityAssignments(user: CurrentUser, courseId: string, groupId: string) {
  await assertCanViewCourse(user, courseId);
  await assertGroupBelongsToCourse(courseId, groupId);
  return prisma.courseGroupActivity.findMany({
    where: { groupId },
    include: {
      activity: {
        include: { activityType: true }
      }
    },
    orderBy: [{ position: "asc" }, { createdAt: "asc" }]
  });
}

export async function assignActivityToGroup(user: CurrentUser, courseId: string, groupId: string, input: unknown) {
  await assertCanManageCourse(user, courseId);
  await assertGroupBelongsToCourse(courseId, groupId);
  const data = CourseGroupActivityInputSchema.parse(input);
  await assertActivityBelongsToCourse(courseId, data.activityId);
  validateAvailability(data.availableFrom, data.availableUntil);

  const existing = await prisma.courseGroupActivity.findFirst({
    where: { groupId, activityId: data.activityId }
  });
  if (existing) {
    throw new AppError(400, "GROUP_ACTIVITY_EXISTS", "This activity is already assigned to the group.");
  }

  return prisma.courseGroupActivity.create({
    data: {
      groupId,
      activityId: data.activityId,
      availableFrom: parseDateInput(data.availableFrom),
      availableUntil: parseDateInput(data.availableUntil),
      config: data.config as Prisma.InputJsonValue,
      metadata: data.metadata as Prisma.InputJsonValue,
      position: data.position
    },
    include: {
      activity: {
        include: { activityType: true }
      }
    }
  });
}

export async function updateGroupActivityAssignment(
  user: CurrentUser,
  courseId: string,
  groupId: string,
  assignmentId: string,
  input: unknown
) {
  await assertCanManageCourse(user, courseId);
  await assertGroupBelongsToCourse(courseId, groupId);
  const data = CourseGroupActivityUpdateSchema.parse(input);
  validateAvailability(data.availableFrom, data.availableUntil);

  const assignment = await prisma.courseGroupActivity.findFirst({
    where: { id: assignmentId, groupId }
  });
  if (!assignment) {
    throw notFound("Group activity assignment");
  }

  return prisma.courseGroupActivity.update({
    where: { id: assignmentId },
    data: {
      availableFrom: data.availableFrom !== undefined ? parseDateInput(data.availableFrom) : undefined,
      availableUntil: data.availableUntil !== undefined ? parseDateInput(data.availableUntil) : undefined,
      config: data.config as Prisma.InputJsonValue | undefined,
      metadata: data.metadata as Prisma.InputJsonValue | undefined,
      position: data.position
    },
    include: {
      activity: {
        include: { activityType: true }
      }
    }
  });
}

export async function deleteGroupActivityAssignment(
  user: CurrentUser,
  courseId: string,
  groupId: string,
  assignmentId: string
) {
  await assertCanManageCourse(user, courseId);
  await assertGroupBelongsToCourse(courseId, groupId);
  const assignment = await prisma.courseGroupActivity.findFirst({
    where: { id: assignmentId, groupId }
  });
  if (!assignment) {
    throw notFound("Group activity assignment");
  }
  await prisma.courseGroupActivity.delete({ where: { id: assignmentId } });
  return { ok: true };
}

async function assertGroupBelongsToCourse(courseId: string, groupId: string) {
  const group = await prisma.courseGroup.findFirst({ where: { id: groupId, courseId } });
  if (!group) {
    throw notFound("Course group");
  }
  return group;
}

async function assertActivityBelongsToCourse(courseId: string, activityId: string) {
  const activity = await prisma.activity.findFirst({ where: { id: activityId, courseId } });
  if (!activity) {
    throw notFound("Course activity");
  }
  return activity;
}

async function assertValidGroupMaterialParent(groupId: string, parentId: string | null | undefined) {
  if (!parentId) {
    return;
  }

  const parent = await prisma.courseGroupMaterial.findFirst({
    where: { id: parentId, groupId, kind: "folder" }
  });
  if (!parent) {
    throw notFound("Parent folder");
  }
}

function parseDateInput(value: string | null | undefined) {
  if (!value) {
    return null;
  }
  return new Date(value);
}

function validateAvailability(availableFrom: string | null | undefined, availableUntil: string | null | undefined) {
  if (!availableFrom || !availableUntil) {
    return;
  }

  if (new Date(availableUntil).getTime() < new Date(availableFrom).getTime()) {
    throw new AppError(400, "INVALID_AVAILABILITY_WINDOW", "The availability end must be after the start.");
  }
}

function buildVisibleGroupWhere(): Prisma.CourseGroupWhereInput {
  const now = new Date();
  return {
    status: "published" satisfies CourseGroupStatus,
    AND: [
      {
        OR: [{ availableFrom: null }, { availableFrom: { lte: now } }]
      },
      {
        OR: [{ availableUntil: null }, { availableUntil: { gte: now } }]
      }
    ]
  };
}
