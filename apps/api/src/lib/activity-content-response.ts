import type { CurrentUser } from "@cognelo/contracts";
import { getActivityContentAccess } from "@cognelo/core";

/** Recheck after finalization; a successful last submission returns only a receipt signal. */
export async function activityContentResponse(user: CurrentUser, courseId: string, groupId: string, activityId: string, payload: unknown, protectedActivity: boolean) {
  if (protectedActivity && (await getActivityContentAccess(user, courseId, groupId, activityId)).locked) {
    return { activityContentClosed: true };
  }
  return payload;
}
