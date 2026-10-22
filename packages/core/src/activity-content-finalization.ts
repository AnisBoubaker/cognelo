import type { CurrentUser } from "@cognelo/contracts";
import { prisma } from "@cognelo/db";
import { getActivityContentAccess } from "./activity-content-access";
import { finalizeExpiredTimedActivityAttempt } from "./activity-timing";
import { recoverExpiredTestAttempt } from "./test-execution";

/** Preserve server-saved work when a closed page can no longer run its renderer. */
export async function finalizeClosedActivityContent(user: CurrentUser, courseId: string, groupId: string, activityId: string) {
  const access = await getActivityContentAccess(user, courseId, groupId, activityId);
  if (!access.locked || !access.canFinalize) return { access };
  const attempts = await prisma.activityAttempt.findMany({
    where: { courseId, groupId, activityId, participant: { userId: user.id, role: "student" }, lifecycle: "started" },
    select: { id: true, pluginKey: true }
  });
  for (const attempt of attempts) {
    if (attempt.pluginKey === "core:test") {
      await recoverExpiredTestAttempt(attempt.id, { actorUserId: user.id, includeClosingDate: true });
    } else {
      await finalizeExpiredTimedActivityAttempt(user, courseId, groupId, activityId, { includeClosingDate: true, graceMilliseconds: 30_000 });
    }
  }
  return { access: await getActivityContentAccess(user, courseId, groupId, activityId) };
}
