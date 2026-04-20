import { prisma } from "@cognelo/db";
import type { CurrentUser } from "@cognelo/contracts";
import { forbidden } from "./errors";

export function isAdmin(user: CurrentUser) {
  return user.roles.includes("admin");
}

export function isTeacher(user: CurrentUser) {
  return user.roles.includes("teacher") || isAdmin(user);
}

export async function getCourseMembership(userId: string, courseId: string) {
  return prisma.courseMembership.findMany({
    where: { userId, courseId }
  });
}

export async function assertCanCreateCourse(user: CurrentUser) {
  if (!isTeacher(user)) {
    throw forbidden();
  }
}

export async function assertCanManageCourse(user: CurrentUser, courseId: string) {
  if (await canManageCourse(user, courseId)) {
    return;
  }
  throw forbidden();
}

export async function canManageCourse(user: CurrentUser, courseId: string) {
  if (isAdmin(user)) {
    return true;
  }
  const memberships = await getCourseMembership(user.id, courseId);
  if (memberships.some((membership) => ["owner", "teacher", "ta"].includes(membership.role))) {
    return true;
  }
  return false;
}

export async function assertCanViewCourse(user: CurrentUser, courseId: string) {
  if (isAdmin(user)) {
    return;
  }
  if (isTeacher(user)) {
    const memberships = await getCourseMembership(user.id, courseId);
    if (memberships.length > 0) {
      return;
    }
  }
  const memberships = await getCourseMembership(user.id, courseId);
  if (memberships.length > 0) {
    return;
  }
  throw forbidden();
}
