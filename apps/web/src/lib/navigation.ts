import type { CurrentUser } from "@cognelo/contracts";

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
