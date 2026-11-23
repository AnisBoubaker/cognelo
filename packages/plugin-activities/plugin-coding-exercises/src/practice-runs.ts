import type { PluginRouteContext } from "@cognelo/activity-sdk/server";
import { AppError, getActivityAttemptAvailability } from "@cognelo/core";
import { prisma as corePrisma } from "@cognelo/db";
import { prisma, type Prisma } from "./db-client";
import { codingExerciseConfigSchema, getCodingExerciseMaxTestRuns, type CodingPracticeRunAllowance } from "./coding-exercises";

const practicePolicySchema = codingExerciseConfigSchema.pick({ responseMode: true, maxTestRuns: true, testsEnabled: true });

export async function resolveCodingPracticeScope(context: Pick<PluginRouteContext, "activity" | "user" | "groupId" | "courseId">): Promise<string | undefined> {
  if (!context.groupId || !context.activity.assignment?.id) return undefined;
  const participant = await corePrisma.courseGroupParticipant.findFirst({
    where: { groupId: context.groupId, userId: context.user.id, role: "student" }, select: { id: true }
  });
  if (!participant) return undefined;
  const latest = await corePrisma.activityAttempt.findFirst({
    where: { groupActivityId: context.activity.assignment.id, participantId: participant.id },
    orderBy: { attemptNumber: "desc" }, select: { attemptNumber: true, lifecycle: true }
  });
  const number = latest?.lifecycle === "started" ? latest.attemptNumber : (latest?.attemptNumber ?? 0) + 1;
  const limit = getCodingExerciseMaxTestRuns(practicePolicySchema.parse(context.activity.config ?? {}));
  if (limit !== null && limit > 0 && latest?.lifecycle !== "started" && context.courseId) {
    const availability = await getActivityAttemptAvailability(context.user, { courseId: context.courseId, groupId: context.groupId, activityId: context.activity.id });
    if (!availability.canStart) throw new AppError(409, "CODING_EXERCISE_ATTEMPT_UNAVAILABLE", "No new attempt is available for test runs.");
  }
  return JSON.stringify(["coding-practice", context.activity.assignment.id, participant.id, number]);
}

export function codingTestPracticeScope(parentAttemptId: string, testItemId: string) {
  return JSON.stringify(["coding-practice", parentAttemptId, testItemId]);
}

export async function getCodingPracticeRunAllowance(input: { activityId: string; userId: string; activityConfig: unknown; scope?: string }): Promise<CodingPracticeRunAllowance> {
  const config = practicePolicySchema.parse(input.activityConfig ?? {});
  const limit = getCodingExerciseMaxTestRuns(config);
  if (limit === null || limit === 0) return { limit, used: 0, remaining: limit };
  if (!input.scope) throw new AppError(409, "CODING_EXERCISE_RUN_CONTEXT_REQUIRED", "Open the assigned exercise before running tests.");
  const used = await countCodingPracticeRuns(prisma, input.activityId, input.userId, input.scope);
  return { limit, used, remaining: Math.max(0, limit - used) };
}

export function assertCodingPracticeRunsEnabled(activityConfig: unknown) {
  if (getCodingExerciseMaxTestRuns(practicePolicySchema.parse(activityConfig ?? {})) === 0) {
    throw new AppError(403, "CODING_EXERCISE_RUN_DISABLED", "Test runs are disabled for this exercise.");
  }
}

/** Reserve the pending execution under a lock so concurrent tabs cannot overspend. */
export async function createCodingPracticeRun(data: Prisma.PluginCodingExerciseExecutionCreateInput, limit: number | null, scope?: string) {
  if (limit === 0) throw new AppError(403, "CODING_EXERCISE_RUN_DISABLED", "Test runs are disabled for this exercise.");
  if (limit === null) return prisma.pluginCodingExerciseExecution.create({ data });
  if (!scope) throw new AppError(409, "CODING_EXERCISE_RUN_CONTEXT_REQUIRED", "Open the assigned exercise before running tests.");
  return prisma.$transaction(async transaction => {
    await transaction.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtextextended(${scope}, 0))`;
    const used = await countCodingPracticeRuns(transaction, data.activityId, data.userId, scope);
    if (used >= limit) throw new AppError(409, "CODING_EXERCISE_RUN_LIMIT_REACHED", "No test runs remain for this attempt.", { limit, used, remaining: 0 });
    return transaction.pluginCodingExerciseExecution.create({ data });
  }, { isolationLevel: "ReadCommitted" });
}

async function countCodingPracticeRuns(client: Pick<Prisma.TransactionClient, "$queryRaw">, activityId: string, userId: string, scope: string) {
  const [row] = await client.$queryRaw<Array<{ used: number }>>`SELECT COUNT(*)::int AS used FROM "PluginCodingExerciseExecution"
    WHERE "activityId"=${activityId} AND "userId"=${userId} AND kind='run'
      AND "resultSummary"->>'practiceRunScope'=${scope}
      AND COALESCE("resultSummary"->>'phase','pending')<>'failed-before-result'`;
  return row?.used ?? 0;
}
