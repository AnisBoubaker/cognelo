import { prisma, type Prisma } from "@cognelo/db";
import { recoverExpiredTestAttempt } from "./test-execution";

/** Called only after gradebook authorization, with the same course/section scope. */
export async function recoverExpiredTestAttempts(scope: Prisma.ActivityAttemptWhereInput, actorUserId: string) {
  let recovered = 0;
  let afterId: string | undefined;
  do {
    const attempts = await prisma.activityAttempt.findMany({
      where: { AND: [scope, { pluginKey: "core:test", lifecycle: "started" }, ...(afterId ? [{ id: { gt: afterId } }] : [])] },
      select: { id: true }, orderBy: { id: "asc" }, take: 100
    });
    for (const attempt of attempts) {
      try {
        if (await recoverExpiredTestAttempt(attempt.id, { actorUserId })) recovered++;
      } catch (error) {
        // A serialization conflict/settings edit is retried on the next read.
        console.error("test_timeout_recovery_failed", { attemptId: attempt.id, error });
      }
    }
    afterId = attempts.length === 100 ? attempts[99].id : undefined;
  } while (afterId);
  return recovered;
}
