import { CourseInputSchema, CourseUpdateSchema, EnrollmentInputSchema } from "@cognelo/contracts";
import { prisma } from "@cognelo/db";
import type { CurrentUser } from "@cognelo/contracts";
import { assertCanCreateCourse, assertCanManageCourse, assertCanViewCourse, isAdmin, isCourseManager, isTeacher } from "./authorization";
import { notFound } from "./errors";

const courseInclude = {
  subject: {
    include: {
      materials: { orderBy: [{ position: "asc" as const }, { createdAt: "asc" as const }] }
    }
  },
  memberships: { include: { user: { select: { id: true, email: true, name: true } } } },
  materials: { orderBy: [{ position: "asc" as const }, { createdAt: "asc" as const }] },
  activities: {
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
    where: { memberships: { some: { userId: user.id } } },
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
  return prisma.course.update({
    where: { id: courseId },
    data,
    include: courseInclude
  });
}

export async function archiveCourse(user: CurrentUser, courseId: string) {
  return updateCourse(user, courseId, { status: "archived" });
}

export async function addCourseMembership(user: CurrentUser, courseId: string, input: unknown) {
  await assertCanManageCourse(user, courseId);
  const data = EnrollmentInputSchema.parse(input);
  return prisma.courseMembership.create({
    data: {
      courseId,
      userId: data.userId,
      role: data.role
    },
    include: { user: { select: { id: true, email: true, name: true } } }
  });
}
