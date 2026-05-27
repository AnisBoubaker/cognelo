export const parsonsDatabaseModule = {
  namespace: "plugin_parsons",
  tables: ["PluginParsonsAttempt", "PluginParsonsAttemptEvent"],
  migrations: [
    {
      id: "202605130010_baseline",
      statements: [
        `DO $$ BEGIN
          CREATE TYPE "PluginParsonsAttemptStatus" AS ENUM ('in_progress', 'completed', 'abandoned');
        EXCEPTION
          WHEN duplicate_object THEN null;
        END $$`,
        `CREATE TABLE IF NOT EXISTS "PluginParsonsAttempt" (
          "id" TEXT NOT NULL,
          "activityId" TEXT NOT NULL,
          "userId" TEXT NOT NULL,
          "status" "PluginParsonsAttemptStatus" NOT NULL DEFAULT 'in_progress',
          "latestState" JSONB NOT NULL DEFAULT '{}',
          "resultSummary" JSONB NOT NULL DEFAULT '{}',
          "checkCount" INTEGER NOT NULL DEFAULT 0,
          "resetCount" INTEGER NOT NULL DEFAULT 0,
          "moveCount" INTEGER NOT NULL DEFAULT 0,
          "indentCount" INTEGER NOT NULL DEFAULT 0,
          "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "lastInteractionAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "completedAt" TIMESTAMP(3),
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL,
          CONSTRAINT "PluginParsonsAttempt_pkey" PRIMARY KEY ("id")
        )`,
        `CREATE TABLE IF NOT EXISTS "PluginParsonsAttemptEvent" (
          "id" TEXT NOT NULL,
          "attemptId" TEXT NOT NULL,
          "type" TEXT NOT NULL,
          "payload" JSONB NOT NULL DEFAULT '{}',
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "PluginParsonsAttemptEvent_pkey" PRIMARY KEY ("id")
        )`,
        `CREATE INDEX IF NOT EXISTS "PluginParsonsAttempt_activityId_userId_status_idx" ON "PluginParsonsAttempt"("activityId", "userId", "status")`,
        `CREATE INDEX IF NOT EXISTS "PluginParsonsAttempt_userId_status_idx" ON "PluginParsonsAttempt"("userId", "status")`,
        `CREATE INDEX IF NOT EXISTS "PluginParsonsAttempt_activityId_lastInteractionAt_idx" ON "PluginParsonsAttempt"("activityId", "lastInteractionAt")`,
        `CREATE INDEX IF NOT EXISTS "PluginParsonsAttemptEvent_attemptId_createdAt_idx" ON "PluginParsonsAttemptEvent"("attemptId", "createdAt")`,
        `CREATE INDEX IF NOT EXISTS "PluginParsonsAttemptEvent_type_idx" ON "PluginParsonsAttemptEvent"("type")`,
        `DO $$ BEGIN
          ALTER TABLE "PluginParsonsAttemptEvent"
          ADD CONSTRAINT "PluginParsonsAttemptEvent_attemptId_fkey"
          FOREIGN KEY ("attemptId") REFERENCES "PluginParsonsAttempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;
        EXCEPTION
          WHEN duplicate_object THEN null;
        END $$`
      ]
    }
  ],
  notes: [
    "Parsons owns its attempt persistence under the plugin namespace so behavioral analytics and research instrumentation stay isolated from core activity tables."
  ]
} as const;
