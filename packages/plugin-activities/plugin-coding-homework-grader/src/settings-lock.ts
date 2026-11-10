import type { Prisma } from "./db-client";
export async function lockHomeworkSettings(tx: Pick<Prisma.TransactionClient, "$queryRaw">, activityId: string) {
  await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtextextended(${`homework-settings:${activityId}`}, 0))`;
}
