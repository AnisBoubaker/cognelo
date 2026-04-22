import {
  CourseGroupStatus,
  CourseGroupActivityInputSchema,
  CourseGroupActivityUpdateSchema,
  CourseGroupInputSchema,
  CourseGroupParticipantInputSchema,
  type CourseGroupParticipantRole,
  CourseGroupMaterialInputSchema,
  CourseGroupMaterialUpdateSchema,
  CourseGroupUpdateSchema
} from "@cognelo/contracts";
import { Prisma, prisma } from "@cognelo/db";
import type { CurrentUser } from "@cognelo/contracts";
import { assertCanManageCourse, assertCanViewCourse, canManageCourse, isAdmin } from "./authorization";
import { AppError, notFound } from "./errors";

type StudentAccessDb = Pick<typeof prisma, "role" | "userRole" | "courseMembership">;

const groupInclude = {
  materials: { orderBy: [{ position: "asc" as const }, { createdAt: "asc" as const }] },
  hiddenCourseMaterials: {
    select: {
      courseMaterialId: true
    }
  },
  activities: {
    include: {
      activity: {
        include: { activityType: true }
      }
    },
    orderBy: [{ position: "asc" as const }, { createdAt: "asc" as const }]
  },
  participants: {
    include: {
      user: {
        select: { id: true, email: true, name: true }
      }
    },
    orderBy: [{ createdAt: "asc" as const }]
  }
};

export async function listCourseGroups(user: CurrentUser, courseId: string) {
  await assertCanViewCourse(user, courseId);
  const isManager = await canManageCourse(user, courseId);
  return prisma.courseGroup.findMany({
    where: {
      courseId,
      ...(isManager
        ? {}
        : {
            ...buildVisibleGroupWhere(),
            participants: {
              some: { userId: user.id }
            }
          })
    },
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }]
  });
}

export async function getCourseGroup(user: CurrentUser, courseId: string, groupId: string) {
  const isManager = await canManageCourse(user, courseId);
  await assertCanViewGroup(user, courseId, groupId);
  const group = await prisma.courseGroup.findFirst({
    where: {
      id: groupId,
      courseId
    },
    include: groupInclude
  });
  if (!group) {
    throw notFound("Course group");
  }
  return {
    ...group,
    participants: isManager ? group.participants : group.participants.filter((participant) => participant.userId === user.id),
    hiddenCourseMaterialIds: group.hiddenCourseMaterials.map((entry) => entry.courseMaterialId)
  };
}

export async function createCourseGroup(user: CurrentUser, courseId: string, input: unknown) {
  await assertCanManageCourse(user, courseId);
  const data = CourseGroupInputSchema.parse(input);
  return prisma.courseGroup.create({
    data: {
      ...data,
      status: "draft",
      courseId,
      createdById: user.id,
      participants: {
        create: {
          userId: user.id,
          role: "teacher",
          firstName: firstNameFromName(user.name),
          lastName: lastNameFromName(user.name),
          email: user.email
        }
      }
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
  await assertCanViewGroup(user, courseId, groupId);
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
  await assertCanViewGroup(user, courseId, groupId);
  const material = await prisma.courseGroupMaterial.findFirst({
    where: { id: materialId, groupId, kind: "file" }
  });
  if (!material) {
    throw notFound("Group material");
  }
  return material;
}

export async function getCourseMaterialForGroupDownload(user: CurrentUser, courseId: string, groupId: string, materialId: string) {
  await assertCanViewGroup(user, courseId, groupId);
  await assertCourseMaterialBelongsToCourse(courseId, materialId);

  const hiddenEntries = await prisma.courseGroupHiddenCourseMaterial.findMany({
    where: { groupId },
    select: { courseMaterialId: true }
  });
  const hiddenCourseMaterialIds = new Set(hiddenEntries.map((entry) => entry.courseMaterialId));

  const material = await prisma.courseMaterial.findFirst({
    where: { id: materialId, courseId, kind: "file" }
  });
  if (!material) {
    throw notFound("Course material");
  }

  if (hiddenCourseMaterialIds.has(materialId)) {
    throw new AppError(403, "FORBIDDEN", "You do not have access to this course material in the group workspace.");
  }

  if (material.parentId) {
    const courseMaterials = await prisma.courseMaterial.findMany({
      where: { courseId },
      select: { id: true, parentId: true }
    });
    const parentById = new Map<string, string | null>(courseMaterials.map((entry) => [entry.id, entry.parentId]));
    let parentId: string | null = material.parentId;
    while (parentId) {
      if (hiddenCourseMaterialIds.has(parentId)) {
        throw new AppError(403, "FORBIDDEN", "You do not have access to this course material in the group workspace.");
      }
      parentId = parentById.get(parentId) ?? null;
    }
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

export async function hideCourseMaterialForGroup(user: CurrentUser, courseId: string, groupId: string, materialId: string) {
  await assertCanManageCourse(user, courseId);
  await assertGroupBelongsToCourse(courseId, groupId);
  await assertCourseMaterialBelongsToCourse(courseId, materialId);

  await prisma.courseGroupHiddenCourseMaterial.upsert({
    where: {
      groupId_courseMaterialId: {
        groupId,
        courseMaterialId: materialId
      }
    },
    update: {},
    create: {
      groupId,
      courseMaterialId: materialId
    }
  });

  return { ok: true };
}

export async function unhideCourseMaterialForGroup(user: CurrentUser, courseId: string, groupId: string, materialId: string) {
  await assertCanManageCourse(user, courseId);
  await assertGroupBelongsToCourse(courseId, groupId);
  await assertCourseMaterialBelongsToCourse(courseId, materialId);

  await prisma.courseGroupHiddenCourseMaterial.deleteMany({
    where: {
      groupId,
      courseMaterialId: materialId
    }
  });

  return { ok: true };
}

export async function listGroupActivityAssignments(user: CurrentUser, courseId: string, groupId: string) {
  await assertCanViewGroup(user, courseId, groupId);
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

export async function getGroupAssignedActivity(user: CurrentUser, courseId: string, groupId: string, activityId: string) {
  const group = await assertCanViewGroup(user, courseId, groupId);
  const assignment = await prisma.courseGroupActivity.findFirst({
    where: { groupId, activityId },
    include: {
      activity: {
        include: { activityType: true }
      }
    }
  });

  if (!assignment) {
    throw notFound("Group activity assignment");
  }

  if (!(isAdmin(user) || (await canManageCourse(user, courseId)))) {
    const now = new Date();
    if (
      group.status !== "published" ||
      (assignment.availableFrom && assignment.availableFrom > now) ||
      (assignment.availableUntil && assignment.availableUntil < now)
    ) {
      throw new AppError(403, "GROUP_ACTIVITY_NOT_AVAILABLE", "This activity is not currently available in the group.");
    }
  }

  return assignment.activity;
}

export async function addGroupParticipant(user: CurrentUser, courseId: string, groupId: string, input: unknown) {
  await assertCanManageCourse(user, courseId);
  await assertGroupBelongsToCourse(courseId, groupId);
  const data = CourseGroupParticipantInputSchema.parse(input);
  const normalizedEmail = data.email.toLowerCase();
  const normalizedExternalId = data.externalId?.trim() || null;
  const existingUser = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  const firstName = data.firstName?.trim() || (existingUser ? firstNameFromName(existingUser.name) : "");
  const lastName = data.lastName?.trim() || (existingUser ? lastNameFromName(existingUser.name) : "");

  if (!existingUser && (!firstName || !lastName)) {
    throw new AppError(400, "GROUP_PARTICIPANT_NAME_REQUIRED", "First name and last name are required for a new participant.");
  }

  try {
    const participant = await prisma.$transaction(async (tx) => {
      const createdParticipant = await tx.courseGroupParticipant.create({
        data: {
          groupId,
          userId: existingUser?.id ?? null,
          role: data.role,
          firstName,
          lastName,
          email: normalizedEmail,
          externalId: normalizedExternalId
        },
        include: {
          user: {
            select: { id: true, email: true, name: true }
          }
        }
      });

      if (existingUser) {
        await ensureMembershipsForGroupParticipant(existingUser.id, courseId, data.role, tx);
      }

      return createdParticipant;
    });

    return participant;
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002" &&
      Array.isArray(error.meta?.target) &&
      error.meta.target.includes("groupId") &&
      error.meta.target.includes("email")
    ) {
      throw new AppError(400, "GROUP_PARTICIPANT_EXISTS", "This participant is already part of the group.");
    }
    throw error;
  }
}

export async function lookupGroupParticipantCandidate(user: CurrentUser, courseId: string, email: string) {
  await assertCanManageCourse(user, courseId);
  const normalizedEmail = email.toLowerCase().trim();
  if (!normalizedEmail) {
    return null;
  }

  const existingUser = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    select: { id: true, email: true, name: true }
  });

  if (!existingUser) {
    return null;
  }

  return {
    id: existingUser.id,
    email: existingUser.email,
    firstName: firstNameFromName(existingUser.name),
    lastName: lastNameFromName(existingUser.name),
    name: existingUser.name
  };
}

export async function removeGroupParticipant(user: CurrentUser, courseId: string, groupId: string, participantId: string) {
  await assertCanManageCourse(user, courseId);
  await assertGroupBelongsToCourse(courseId, groupId);
  const participant = await prisma.courseGroupParticipant.findFirst({
    where: { id: participantId, groupId }
  });
  if (!participant) {
    throw notFound("Group participant");
  }
  if (participant.userId === user.id) {
    throw new AppError(400, "GROUP_PARTICIPANT_SELF_REMOVE_FORBIDDEN", "You cannot remove yourself from this group.");
  }
  await prisma.courseGroupParticipant.delete({ where: { id: participantId } });
  return { ok: true };
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

async function assertCanViewGroup(user: CurrentUser, courseId: string, groupId: string) {
  await assertCanViewCourse(user, courseId);
  const group = await assertGroupBelongsToCourse(courseId, groupId);

  if (isAdmin(user) || (await canManageCourse(user, courseId))) {
    return group;
  }

  const participant = await prisma.courseGroupParticipant.findFirst({
    where: { groupId, userId: user.id }
  });

  if (!participant) {
    throw new AppError(403, "FORBIDDEN", "You do not have access to this group.");
  }

  const now = new Date();
  if (
    group.status !== "published" ||
    (group.availableFrom && group.availableFrom > now) ||
    (group.availableUntil && group.availableUntil < now)
  ) {
    throw new AppError(403, "GROUP_NOT_AVAILABLE", "This group is not currently available.");
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

async function assertCourseMaterialBelongsToCourse(courseId: string, materialId: string) {
  const material = await prisma.courseMaterial.findFirst({ where: { id: materialId, courseId } });
  if (!material) {
    throw notFound("Course material");
  }
  return material;
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

async function ensureStudentRole(userId: string, tx: StudentAccessDb = prisma) {
  const role = await tx.role.findUnique({ where: { key: "student" } });
  if (!role) {
    throw new AppError(500, "ROLE_NOT_FOUND", "The student role is not configured.");
  }

  await tx.userRole.upsert({
    where: { userId_roleId: { userId, roleId: role.id } },
    update: {},
    create: { userId, roleId: role.id }
  });
}

async function ensureStudentMembership(userId: string, courseId: string, tx: StudentAccessDb = prisma) {
  await tx.courseMembership.upsert({
    where: {
      courseId_userId_role: {
        courseId,
        userId,
        role: "student"
      }
    },
    update: {},
    create: {
      courseId,
      userId,
      role: "student"
    }
  });
}

async function ensureMembershipsForGroupParticipant(
  userId: string,
  courseId: string,
  role: CourseGroupParticipantRole,
  tx: StudentAccessDb = prisma
) {
  if (role === "student") {
    await ensureStudentRole(userId, tx);
    await ensureStudentMembership(userId, courseId, tx);
    return;
  }

  await tx.courseMembership.upsert({
    where: {
      courseId_userId_role: {
        courseId,
        userId,
        role
      }
    },
    update: {},
    create: {
      courseId,
      userId,
      role
    }
  });
}

function firstNameFromName(name: string | null) {
  const trimmed = name?.trim() ?? "";
  if (!trimmed) {
    return "Teacher";
  }
  return trimmed.split(/\s+/)[0] ?? "Teacher";
}

function lastNameFromName(name: string | null) {
  const trimmed = name?.trim() ?? "";
  if (!trimmed.includes(" ")) {
    return "";
  }
  return trimmed.split(/\s+/).slice(1).join(" ");
}
