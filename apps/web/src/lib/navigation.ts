import type { CurrentUser } from "@cognelo/contracts";

export type CourseWorkspaceTab = "content" | "groupings" | "participants" | "gradebook" | "challenges" | "settings";

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
    requestedTab === "groupings" ||
    requestedTab === "participants" ||
    requestedTab === "gradebook" ||
    requestedTab === "challenges" ||
    requestedTab === "settings"
  ) {
    return requestedTab;
  }
  return "content";
}

export function safeLoginReturnPath(value: string | null, origin: string) {
  if (!value?.startsWith("/")) return null;
  try {
    const target = new URL(value, origin);
    const decodedPath = decodeURIComponent(target.pathname);
    if (target.origin !== new URL(origin).origin || decodedPath.startsWith("//") || /[\\\u0000-\u001f\u007f]/.test(decodedPath)) return null;
    return target.pathname + target.search + target.hash;
  } catch { return null; }
}
