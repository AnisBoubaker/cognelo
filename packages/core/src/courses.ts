import { CourseInputSchema, CourseSettingsInputSchema, CourseUpdateSchema, EnrollmentInputSchema } from "@cognelo/contracts";
import { Prisma, prisma } from "@cognelo/db";
import type { CurrentUser } from "@cognelo/contracts";
import {
  assertCanCreateCourse,
  assertCanManageCourse,
  assertCanManageCourseStaff,
  assertCanViewCourse,
  getCourseCapabilities,
  isAdmin
} from "./authorization";
import { AppError, notFound } from "./errors";

const courseInclude = {
  subject: {
    include: {
      materials: { orderBy: [{ position: "asc" as const }, { createdAt: "asc" as const }] },
      knowledgeConcepts: {
        where: { active: true },
        include: {
          skillRecords: { where: { active: true }, orderBy: [{ position: "asc" as const }] },
          misconceptionRecords: { where: { active: true }, orderBy: [{ position: "asc" as const }] }
        },
        orderBy: [{ createdAt: "asc" as const }]
      },
      knowledgePrerequisites: { orderBy: [{ createdAt: "asc" as const }] }
    }
  },
  memberships: { include: { user: { select: { id: true, email: true, name: true } } } },
  materials: { orderBy: [{ position: "asc" as const }, { createdAt: "asc" as const }] },
  activities: {
    where: { testItem: null },
    include: { activityType: true, bankActivity: true, activityVersion: true, knowledgeConcepts: { include: { concept: true } } },
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
    memberships: {
      where: { userId },
      include: { user: { select: { id: true, email: true, name: true } } }
    },
    activities: {
      where: { testItem: null },
      select: {
        id: true,
        bankActivityId: true,
        activityVersionId: true,
        title: true,
        description: true,
        lifecycle: true,
        position: true,
        activityType: true
      },
      orderBy: [{ position: "asc" as const }, { createdAt: "asc" as const }]
    },
    groups: {
      where: buildVisibleStudentGroupWhere(userId),
      orderBy: [{ updatedAt: "desc" as const }, { createdAt: "desc" as const }]
    }
  };
}

function buildCourseIncludeForSectionStaff(userId: string) {
  return {
    ...buildCourseIncludeForStudent(userId),
    groups: {
      where: { participants: { some: { userId, role: { in: ["teacher" as const, "ta" as const] } } } },
      orderBy: [{ updatedAt: "desc" as const }, { createdAt: "desc" as const }]
    }
  };
}

export async function listCourses(user: CurrentUser) {
  if (isAdmin(user)) {
    return prisma.course.findMany({ include: courseInclude, orderBy: { updatedAt: "desc" } });
  }

  const fullCourses = await prisma.course.findMany({
    where: {
      memberships: {
        some: {
          userId: user.id,
          source: "explicit",
          role: { in: ["owner", "teacher"] }
        }
      }
    },
    include: courseInclude,
    orderBy: { updatedAt: "desc" }
  });
  const fullCourseIds = fullCourses.map((course) => course.id);
  const sectionCourses = await prisma.course.findMany({
    where: {
      ...(fullCourseIds.length ? { id: { notIn: fullCourseIds } } : {}),
      groups: {
        some: {
          participants: {
            some: { userId: user.id, role: { in: ["teacher", "ta"] } }
          }
        }
      }
    },
    include: buildCourseIncludeForSectionStaff(user.id),
    orderBy: { updatedAt: "desc" }
  });
  const staffCourseIds = [...fullCourseIds, ...sectionCourses.map((course) => course.id)];
  const learnerCourses = await prisma.course.findMany({
    where: {
      ...(staffCourseIds.length ? { id: { notIn: staffCourseIds } } : {}),
      memberships: { some: { userId: user.id, role: "student" } },
      groups: { some: buildVisibleStudentGroupWhere(user.id) }
    },
    include: buildCourseIncludeForStudent(user.id),
    orderBy: { updatedAt: "desc" }
  });
  return [
    ...fullCourses,
    ...sectionCourses.map(stripStudentCourseActivityContent),
    ...learnerCourses.map(stripStudentCourseActivityContent)
  ].sort((left, right) => right.updatedAt.getTime() - left.updatedAt.getTime());
}

export async function getCourse(user: CurrentUser, courseId: string) {
  await assertCanViewCourse(user, courseId);
  const capabilities = await getCourseCapabilities(user, courseId);
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    include: capabilities.canManageCourse
      ? courseInclude
      : capabilities.canViewGradebook
        ? buildCourseIncludeForSectionStaff(user.id)
        : buildCourseIncludeForStudent(user.id)
  });
  if (!course) {
    throw notFound("Course");
  }
  return {
    ...(capabilities.canManageCourse ? course : stripStudentCourseActivityContent(course)),
    permissions: capabilities
  };
}

function stripStudentCourseActivityContent<T extends { activities: Array<{ description: string }> }>(course: T) {
  return {
    ...course,
    activities: course.activities.map((activity) => ({ ...activity, description: "" }))
  };
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
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: { title: true, description: true, status: true, metadata: true }
  });
  if (!course) {
    throw notFound("Course");
  }

  if (studentContentLayout !== undefined) {
    metadata = {
      ...asMetadataRecord(course.metadata),
      studentContentLayout
    } as Prisma.InputJsonValue;
  }

  const updateData: Prisma.CourseUncheckedUpdateInput = {
    ...courseData,
    ...(metadata ? { metadata } : {})
  };

  return prisma.$transaction(async (tx) => {
    const updatedCourse = await tx.course.update({
      where: { id: courseId },
      data: updateData,
      include: courseInclude
    });
    await tx.courseAuditEvent.create({
      data: {
        courseId,
        actorUserId: user.id,
        eventType: "course_updated",
        targetType: "course",
        targetId: courseId,
        previousValue: {
          title: course.title,
          description: course.description,
          status: course.status,
          studentContentLayout: asMetadataRecord(course.metadata).studentContentLayout ?? null
        },
        nextValue: {
          title: updatedCourse.title,
          description: updatedCourse.description,
          status: updatedCourse.status,
          studentContentLayout: asMetadataRecord(updatedCourse.metadata).studentContentLayout ?? null
        }
      }
    });
    return updatedCourse;
  });
}

export async function updateCourseSettings(user: CurrentUser, courseId: string, input: unknown) {
  await assertCanManageCourse(user, courseId);
  const data = CourseSettingsInputSchema.parse(input);
  const [, assessmentConnection] = await Promise.all([
    assertAiAgentConnectionCanBeSelected(user, data.studentSupportAiAgentConnectionId),
    assertAiAgentConnectionCanBeSelected(user, data.assessmentFeedbackAiAgentConnectionId)
  ]);
  if (data.automaticFeedbackEnabled && assessmentConnection && !assessmentConnection.apiKey && assessmentConnection.provider !== "ollama") {
    throw new AppError(400, "AI_AGENT_KEY_MISSING", "The selected assessment-feedback AI agent connection does not have an API key.");
  }

  const course = await prisma.course.findUnique({ where: { id: courseId }, select: { metadata: true } });
  if (!course) {
    throw notFound("Course");
  }

  const metadata = asMetadataRecord(course.metadata);
  const aiSettings = asMetadataRecord(metadata.aiSettings);
  const nextAiSettings = {
    ...aiSettings,
    studentSupportAiAgentConnectionId: data.studentSupportAiAgentConnectionId ?? null,
    automaticFeedbackEnabled: data.automaticFeedbackEnabled,
    assessmentFeedbackAiAgentConnectionId: data.assessmentFeedbackAiAgentConnectionId ?? null
  };

  return prisma.$transaction(async (tx) => {
    const updatedCourse = await tx.course.update({
      where: { id: courseId },
      data: {
        metadata: {
          ...metadata,
          aiSettings: nextAiSettings
        }
      },
      include: courseInclude
    });
    await tx.courseAuditEvent.create({
      data: {
        courseId,
        actorUserId: user.id,
        eventType: "course_ai_settings_updated",
        targetType: "course",
        targetId: courseId,
        previousValue: aiSettings as Prisma.InputJsonValue,
        nextValue: nextAiSettings as Prisma.InputJsonValue
      }
    });
    return updatedCourse;
  });
}

export async function archiveCourse(user: CurrentUser, courseId: string) {
  return updateCourse(user, courseId, { status: "archived" });
}

export async function addCourseMembership(user: CurrentUser, courseId: string, input: unknown) {
  await assertCanManageCourseStaff(user, courseId);
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

  if (data.role === "ta") {
    throw new AppError(400, "COURSE_TA_NOT_SUPPORTED", "Teaching assistants must be assigned to specific course sections.");
  }

  const target = await prisma.user.findUnique({
    where: { id: data.userId },
    select: {
      id: true,
      roles: { select: { role: { select: { key: true } } } }
    }
  });
  if (!target) {
    throw notFound("User");
  }
  const targetRoles = new Set(target.roles.map((entry) => entry.role.key));
  if (data.role === "teacher" && !targetRoles.has("teacher") && !targetRoles.has("admin")) {
    throw new AppError(400, "COURSE_TEACHER_ROLE_REQUIRED", "A course teacher must have the global teacher role.");
  }
  if (
    data.role === "owner" &&
    !targetRoles.has("teacher") &&
    !targetRoles.has("course_manager") &&
    !targetRoles.has("admin")
  ) {
    throw new AppError(400, "COURSE_OWNER_ROLE_REQUIRED", "A course owner must be a teacher, course designer, or administrator.");
  }

  return prisma.$transaction(async (tx) => {
    const previousMembership = await tx.courseMembership.findUnique({
      where: { courseId_userId_role: { courseId, userId: data.userId, role: data.role } }
    });
    const membership = await tx.courseMembership.upsert({
      where: {
        courseId_userId_role: {
          courseId,
          userId: data.userId,
          role: data.role
        }
      },
      update: { source: "explicit" },
      create: {
        courseId,
        userId: data.userId,
        role: data.role,
        source: "explicit"
      },
      include: { user: { select: { id: true, email: true, name: true } } }
    });
    if (!previousMembership || previousMembership.source !== "explicit") {
      await tx.courseAuditEvent.create({
        data: {
          courseId,
          actorUserId: user.id,
          eventType: "course_membership_added",
          targetType: "course_membership",
          targetId: membership.id,
          previousValue: previousMembership ? {
            userId: previousMembership.userId,
            role: previousMembership.role,
            source: previousMembership.source
          } : undefined,
          nextValue: { userId: membership.userId, role: membership.role, source: membership.source }
        }
      });
    }
    return membership;
  });
}

export async function removeCourseMembership(user: CurrentUser, courseId: string, membershipId: string) {
  await assertCanManageCourseStaff(user, courseId);
  try {
    await prisma.$transaction(async (tx) => {
      const membership = await tx.courseMembership.findFirst({
        where: { id: membershipId, courseId },
        select: { id: true, userId: true, role: true, source: true }
      });
      if (!membership) {
        throw notFound("Course membership");
      }
      if (membership.source === "section_derived") {
        throw new AppError(
          409,
          "SECTION_MEMBERSHIP_REMOVE_REQUIRED",
          "Remove this staff member from their course sections instead."
        );
      }
      if (membership.role === "owner") {
        const ownerCount = await tx.courseMembership.count({
          where: { courseId, role: "owner", source: "explicit" }
        });
        if (ownerCount <= 1) {
          throw new AppError(409, "LAST_COURSE_OWNER_REQUIRED", "Assign another course owner before removing the final owner.");
        }
      }
      await tx.courseAuditEvent.create({
        data: {
          courseId,
          actorUserId: user.id,
          eventType: "course_membership_removed",
          targetType: "course_membership",
          targetId: membership.id,
          previousValue: {
            userId: membership.userId,
            role: membership.role,
            source: membership.source
          }
        }
      });
      await tx.courseMembership.delete({ where: { id: membership.id } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") {
      throw new AppError(
        409,
        "COURSE_MEMBERSHIP_CONFLICT",
        "Course staff changed while this membership was being removed. Reload the staff list and try again."
      );
    }
    throw error;
  }
  return { ok: true as const };
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
    return null;
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
  return connection;
}

function asMetadataRecord(value: Prisma.JsonValue | undefined): Record<string, Prisma.JsonValue> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, Prisma.JsonValue>;
}
