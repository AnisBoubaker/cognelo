import { CourseInputSchema, CourseSettingsInputSchema, CourseUpdateSchema, EnrollmentInputSchema } from "@cognelo/contracts";
import { Prisma, prisma } from "@cognelo/db";
import type { CurrentUser } from "@cognelo/contracts";
import { assertCanCreateCourse, assertCanManageCourse, assertCanViewCourse, isAdmin, isCourseManager, isTeacher } from "./authorization";
import { AppError, notFound } from "./errors";

const courseInclude = {
  subject: {
    include: {
      materials: { orderBy: [{ position: "asc" as const }, { createdAt: "asc" as const }] }
    }
  },
  memberships: { include: { user: { select: { id: true, email: true, name: true } } } },
  materials: { orderBy: [{ position: "asc" as const }, { createdAt: "asc" as const }] },
  activities: {
    where: { testItem: null },
    include: { activityType: true, bankActivity: true, activityVersion: true },
    orderBy: [{ position: "asc" as const }, { createdAt: "asc" as const }]
  },
  groups: {
    orderBy: [{ updatedAt: "desc" as const }, { createdAt: "desc" as const }]
  }
};

function buildVisibleStudentGroupWhere(userId: string) {
  const now = new Date();
  return {
    participants: {
      some: { userId }
    },
    status: "published" as const,
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

function buildCourseIncludeForStudent(userId: string) {
  return {
    ...courseInclude,
    groups: {
      where: buildVisibleStudentGroupWhere(userId),
      orderBy: [{ updatedAt: "desc" as const }, { createdAt: "desc" as const }]
    }
  };
}

export async function listCourses(user: CurrentUser) {
  if (isAdmin(user)) {
    return prisma.course.findMany({ include: courseInclude, orderBy: { updatedAt: "desc" } });
  }

  if (isTeacher(user) || isCourseManager(user)) {
    return prisma.course.findMany({
      where: {
        OR: [{ createdById: user.id }, { memberships: { some: { userId: user.id } } }]
      },
      include: courseInclude,
      orderBy: { updatedAt: "desc" }
    });
  }

  return prisma.course.findMany({
    where: {
      memberships: { some: { userId: user.id, role: "student" } },
      groups: { some: buildVisibleStudentGroupWhere(user.id) }
    },
    include: buildCourseIncludeForStudent(user.id),
    orderBy: { updatedAt: "desc" }
  });
}

export async function getCourse(user: CurrentUser, courseId: string) {
  await assertCanViewCourse(user, courseId);
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    include: isAdmin(user) || isTeacher(user) || isCourseManager(user) ? courseInclude : buildCourseIncludeForStudent(user.id)
  });
  if (!course) {
    throw notFound("Course");
  }
  return course;
}

export async function createCourse(user: CurrentUser, input: unknown) {
  await assertCanCreateCourse(user);
  const data = CourseInputSchema.parse(input);
  return prisma.course.create({
    data: {
      subjectId: data.subjectId,
      title: data.title,
      description: data.description,
      status: data.status,
      createdById: user.id,
      memberships: {
        create: {
          userId: user.id,
          role: "owner"
        }
      }
    },
    include: courseInclude
  });
}

export async function updateCourse(user: CurrentUser, courseId: string, input: unknown) {
  await assertCanManageCourse(user, courseId);
  const data = CourseUpdateSchema.parse(input);
  const { studentContentLayout, ...courseData } = data;
  let metadata: Prisma.InputJsonValue | undefined;

  if (studentContentLayout !== undefined) {
    const course = await prisma.course.findUnique({ where: { id: courseId }, select: { metadata: true } });
    if (!course) {
      throw notFound("Course");
    }
    metadata = {
      ...asMetadataRecord(course.metadata),
      studentContentLayout
    } as Prisma.InputJsonValue;
  }

  const updateData: Prisma.CourseUncheckedUpdateInput = {
    ...courseData,
    ...(metadata ? { metadata } : {})
  };

  return prisma.course.update({
    where: { id: courseId },
    data: updateData,
    include: courseInclude
  });
}

export async function updateCourseSettings(user: CurrentUser, courseId: string, input: unknown) {
  await assertCanManageCourse(user, courseId);
  const data = CourseSettingsInputSchema.parse(input);
  await assertAiAgentConnectionCanBeSelected(user, data.studentSupportAiAgentConnectionId);

  const course = await prisma.course.findUnique({ where: { id: courseId }, select: { metadata: true } });
  if (!course) {
    throw notFound("Course");
  }

  const metadata = asMetadataRecord(course.metadata);
  const aiSettings = asMetadataRecord(metadata.aiSettings);
  const nextAiSettings = {
    ...aiSettings,
    studentSupportAiAgentConnectionId: data.studentSupportAiAgentConnectionId ?? null
  };

  return prisma.course.update({
    where: { id: courseId },
    data: {
      metadata: {
        ...metadata,
        aiSettings: nextAiSettings
      }
    },
    include: courseInclude
  });
}

export async function archiveCourse(user: CurrentUser, courseId: string) {
  return updateCourse(user, courseId, { status: "archived" });
}

export async function addCourseMembership(user: CurrentUser, courseId: string, input: unknown) {
  await assertCanManageCourse(user, courseId);
  const data = EnrollmentInputSchema.parse(input);
  if (data.role === "student") {
    if (!data.groupId) {
      throw new AppError(400, "STUDENT_GROUP_REQUIRED", "Student enrollment requires a course group.");
    }
    const groupId = data.groupId;

    const [group, student] = await Promise.all([
      prisma.courseGroup.findFirst({ where: { id: groupId, courseId }, select: { id: true } }),
      prisma.user.findUnique({
        where: { id: data.userId },
        select: { id: true, email: true, name: true, firstName: true, lastName: true }
      })
    ]);
    if (!group) {
      throw notFound("Course group");
    }
    if (!student) {
      throw notFound("User");
    }

    return prisma.$transaction(async (tx) => {
      const membership = await tx.courseMembership.upsert({
        where: {
          courseId_userId_role: {
            courseId,
            userId: data.userId,
            role: "student"
          }
        },
        update: {},
        create: {
          courseId,
          userId: data.userId,
          role: "student"
        },
        include: { user: { select: { id: true, email: true, name: true } } }
      });

      await tx.courseGroupParticipant.upsert({
        where: {
          groupId_email: {
            groupId,
            email: student.email.toLowerCase()
          }
        },
        update: {
          userId: student.id,
          role: "student"
        },
        create: {
          groupId,
          userId: student.id,
          role: "student",
          firstName: student.firstName?.trim() || firstNameFromName(student.name) || student.email,
          lastName: student.lastName?.trim() || lastNameFromName(student.name),
          email: student.email.toLowerCase()
        }
      });

      return membership;
    });
  }

  return prisma.courseMembership.create({
    data: {
      courseId,
      userId: data.userId,
      role: data.role
    },
    include: { user: { select: { id: true, email: true, name: true } } }
  });
}

function firstNameFromName(name: string | null) {
  return name?.trim().split(/\s+/)[0] ?? "";
}

function lastNameFromName(name: string | null) {
  const parts = name?.trim().split(/\s+/) ?? [];
  return parts.length > 1 ? parts.slice(1).join(" ") : "";
}

async function assertAiAgentConnectionCanBeSelected(user: CurrentUser, connectionId: string | null | undefined) {
  if (!connectionId) {
    return;
  }
  const connection = await prisma.aiAgentConnection.findFirst({
    where: {
      id: connectionId,
      isEnabled: true,
      OR: [{ ownerId: user.id }, { ownerId: null }]
    }
  });
  if (!connection) {
    throw notFound("AI agent connection");
  }
}

function asMetadataRecord(value: Prisma.JsonValue | undefined): Record<string, Prisma.JsonValue> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, Prisma.JsonValue>;
}
