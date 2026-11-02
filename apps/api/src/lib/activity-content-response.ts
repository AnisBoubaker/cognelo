import type { CurrentUser } from "@cognelo/contracts";
import { getActivityContentAccess } from "@cognelo/core";

/** Recheck after finalization; a successful last submission returns only a receipt signal. */
export async function activityContentResponse(user: CurrentUser, courseId: string, groupId: string, activityId: string, payload: unknown, protectedActivity: boolean) {
  if (protectedActivity && (await getActivityContentAccess(user, courseId, groupId, activityId)).locked) {
    if (payload instanceof Response && payload.body) await payload.body.cancel().catch(() => {});
    return { activityContentClosed: true };
  }
  return payload;
}
