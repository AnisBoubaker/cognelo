import { prisma } from "@cognelo/db";
import { codingHomeworkGraderDatabaseModule } from "../../../packages/plugin-activities/plugin-coding-homework-grader/src/db";

/** Replay the real upgrade backfill, restricted to this disposable activity's rows. */
export async function replayHomeworkClockBackfill(activityId: string, team = false) {
  const table = team ? "PluginCodingHomeworkWorkspace" : "PluginCodingHomeworkDraft", alias = team ? "w" : "d";
  const migration = codingHomeworkGraderDatabaseModule.migrations.find(value => value.id === "202611090020_submission_stage_clocks")!;
  const statement = migration.statements.find(value => value.startsWith(`UPDATE "${table}"`))!;
  await prisma.$executeRawUnsafe(`${statement} AND ${alias}."activityId"=$1`, activityId);
  return prisma.$queryRawUnsafe<Array<{ preparationStartedAt: Date | null }>>(`SELECT "preparationStartedAt" FROM "${table}" WHERE "activityId"=$1`, activityId);
}
