import type { CurrentUser } from "@cognelo/contracts";

export type CourseWorkspaceTab = "content" | "participants" | "gradebook" | "challenges" | "settings";

export function getPrimaryLandingPath(user: Pick<CurrentUser, "roles">) {
  const canManageLearningContent = user.roles.some((role) =>
    role === "admin" || role === "course_manager" || role === "teacher"
  );
  return canManageLearningContent ? "/subjects" : "/courses";
}

export function getAuthenticatedLandingPath(
  user: Pick<CurrentUser, "roles" | "mustChangePassword" | "emailVerified">
) {
  if (user.mustChangePassword) {
    return "/change-password";
  }
  if (user.emailVerified === false) {
    return "/verify-email";
  }
  return getPrimaryLandingPath(user);
}

export function resolveCourseWorkspaceTab(requestedTab: string | null): CourseWorkspaceTab {
  if (requestedTab === "groups") {
    return "participants";
  }
  if (
    requestedTab === "participants" ||
    requestedTab === "gradebook" ||
    requestedTab === "challenges" ||
    requestedTab === "settings"
  ) {
    return requestedTab;
  }
  return "content";
}
