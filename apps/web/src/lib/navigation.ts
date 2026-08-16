import type { CurrentUser } from "@cognelo/contracts";

export function getPrimaryLandingPath(user: Pick<CurrentUser, "roles">) {
  const canManageLearningContent = user.roles.some((role) =>
    role === "admin" || role === "course_manager" || role === "teacher"
  );
  return canManageLearningContent ? "/subjects" : "/courses";
}
