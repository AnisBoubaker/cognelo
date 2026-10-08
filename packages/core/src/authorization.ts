import { prisma } from "@cognelo/db";
import type { CurrentUser } from "@cognelo/contracts";
import { forbidden } from "./errors";

export type SectionStaffRole = "teacher" | "ta";

export type CourseCapabilities = {
  canViewCourse: boolean;
  canManageCourse: boolean;
  canManageCourseStaff: boolean;
  canViewGradebook: boolean;
  canGrade: boolean;
  canReleaseGrades: boolean;
  canExportGrades: boolean;
  canViewChallenges: boolean;
  canRespondChallenges: boolean;
  gradingGroupIds: string[] | null;
  sectionRoles: Array<{ groupId: string; role: SectionStaffRole }>;
};

export function isAdmin(user: CurrentUser) {
  return user.roles.includes("admin");
}

export function isTeacher(user: CurrentUser) {
  return user.roles.includes("teacher") || isAdmin(user);
}

export function isCourseManager(user: CurrentUser) {
  return user.roles.includes("course_manager") || isAdmin(user);
}

export async function getCourseMembership(userId: string, courseId: string) {
  return prisma.courseMembership.findMany({
    where: { userId, courseId }
  });
}

export async function getCourseCapabilities(user: CurrentUser, courseId: string): Promise<CourseCapabilities> {
  if (isAdmin(user)) {
    return {
      canViewCourse: true,
      canManageCourse: true,
      canManageCourseStaff: true,
      canViewGradebook: true,
      canGrade: true,
      canReleaseGrades: true,
      canExportGrades: true,
      canViewChallenges: true,
      canRespondChallenges: true,
      gradingGroupIds: null,
      sectionRoles: []
    };
  }

  const [memberships, participants] = await Promise.all([
    getCourseMembership(user.id, courseId),
    prisma.courseGroupParticipant.findMany({
      where: {
        userId: user.id,
        group: { courseId }
      },
      select: { groupId: true, role: true }
    })
  ]);
  const explicitCourseRoles = new Set(
    memberships
      .filter((membership) => membership.source === "explicit")
      .map((membership) => membership.role)
  );
  const canManageCourse = explicitCourseRoles.has("owner") || explicitCourseRoles.has("teacher");
  const canGradeCourse = explicitCourseRoles.has("teacher") || (explicitCourseRoles.has("owner") && isTeacher(user));
  const sectionRoles = participants
    .filter((participant) => participant.role === "teacher" || participant.role === "ta")
    .map((participant) => ({
      groupId: participant.groupId,
      role: participant.role as SectionStaffRole
    }));
  const sectionGroupIds = [...new Set(sectionRoles.map((participant) => participant.groupId))];
  const gradingGroupIds: string[] | null = canGradeCourse ? null : sectionGroupIds;
  const canGrade = canGradeCourse || sectionGroupIds.length > 0;

  return {
    canViewCourse: explicitCourseRoles.has("owner") || explicitCourseRoles.has("teacher") || participants.length > 0,
    canManageCourse,
    canManageCourseStaff: canManageCourse,
    canViewGradebook: canGrade,
    canGrade,
    canReleaseGrades: canGradeCourse,
    canExportGrades: canGrade,
    canViewChallenges: canGrade,
    canRespondChallenges: canGrade,
    gradingGroupIds,
    sectionRoles
  };
}

export async function assertCanCreateCourse(user: CurrentUser) {
  if (!isCourseManager(user)) {
    throw forbidden();
  }
}

export async function assertCanManageCourse(user: CurrentUser, courseId: string) {
  if (await canManageCourse(user, courseId)) {
    return;
  }
  throw forbidden();
}

export async function assertCanManageCourseStaff(user: CurrentUser, courseId: string) {
  const capabilities = await getCourseCapabilities(user, courseId);
  if (!capabilities.canManageCourseStaff) {
    throw forbidden();
  }
}

export async function canManageCourse(user: CurrentUser, courseId: string) {
  if (isAdmin(user)) {
    return true;
  }
  const memberships = await getCourseMembership(user.id, courseId);
  return memberships.some(
    (membership) => membership.source === "explicit" && (membership.role === "owner" || membership.role === "teacher")
  );
}

export async function canGradeCourse(user: CurrentUser, courseId: string) {
  const capabilities = await getCourseCapabilities(user, courseId);
  return capabilities.gradingGroupIds === null && capabilities.canGrade;
}

export async function canGradeGroup(user: CurrentUser, courseId: string, groupId: string) {
  const capabilities = await getCourseCapabilities(user, courseId);
  return capabilities.canGrade && (
    capabilities.gradingGroupIds === null || capabilities.gradingGroupIds.includes(groupId)
  );
}

export async function assertCanViewCourseGradebook(user: CurrentUser, courseId: string) {
  const capabilities = await getCourseCapabilities(user, courseId);
  if (!capabilities.canViewGradebook) {
    throw forbidden();
  }
  return capabilities;
}

export async function assertCanManageCourseOrViewGradebook(user: CurrentUser, courseId: string) {
  if (await canManageCourse(user, courseId)) {
    return;
  }
  await assertCanViewCourseGradebook(user, courseId);
}

export async function assertCanGradeGroup(user: CurrentUser, courseId: string, groupId: string) {
  if (!(await canGradeGroup(user, courseId, groupId))) {
    throw forbidden();
  }
}

export async function assertCanManageGroupRoster(user: CurrentUser, courseId: string, groupId: string) {
  if (await canManageCourse(user, courseId)) {
    return;
  }
  const participant = await prisma.courseGroupParticipant.findFirst({
    where: { userId: user.id, groupId, role: "teacher", group: { courseId } },
    select: { id: true }
  });
  if (!participant) {
    throw forbidden();
  }
}

/**
 * Authorizes the non-recording student projection for a specific group.
 *
 * Course managers and administrators may preview every group. A section
 * teacher may preview only the group they teach. Teaching assistants are
 * intentionally excluded: previewing an assessment as a learner is a
 * teaching capability, not a grading capability.
 */
export async function assertCanPreviewGroupAsStudent(user: CurrentUser, courseId: string, groupId: string) {
  if (await canManageCourse(user, courseId)) {
    return;
  }
  const participant = await prisma.courseGroupParticipant.findFirst({
    where: { userId: user.id, groupId, role: "teacher", group: { courseId } },
    select: { id: true }
  });
  if (!participant) {
    throw forbidden();
  }
}

export async function assertCanReleaseCourseGrades(user: CurrentUser, courseId: string) {
  const capabilities = await getCourseCapabilities(user, courseId);
  if (!capabilities.canReleaseGrades) {
    throw forbidden();
  }
}

export async function assertCanViewCourse(user: CurrentUser, courseId: string) {
  if (isAdmin(user)) {
    return;
  }
  const [memberships, participant] = await Promise.all([
    getCourseMembership(user.id, courseId),
    prisma.courseGroupParticipant.findFirst({
      where: {
        userId: user.id,
        group: { courseId }
      },
      select: { id: true }
    })
  ]);
  const hasExplicitStaffMembership = memberships.some(
    (membership) => membership.source === "explicit" && (membership.role === "owner" || membership.role === "teacher")
  );
  if (hasExplicitStaffMembership || participant) {
    return;
  }
  throw forbidden();
}
