CREATE TYPE "PluginParsonsAttemptStatus" AS ENUM ('in_progress', 'completed', 'abandoned');

CREATE TABLE "PluginParsonsAttempt" (
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
);

CREATE TABLE "PluginParsonsAttemptEvent" (
  "id" TEXT NOT NULL,
  "attemptId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "payload" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "PluginParsonsAttemptEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PluginParsonsAttempt_activityId_userId_status_idx" ON "PluginParsonsAttempt"("activityId", "userId", "status");
CREATE INDEX "PluginParsonsAttempt_userId_status_idx" ON "PluginParsonsAttempt"("userId", "status");
CREATE INDEX "PluginParsonsAttempt_activityId_lastInteractionAt_idx" ON "PluginParsonsAttempt"("activityId", "lastInteractionAt");
CREATE INDEX "PluginParsonsAttemptEvent_attemptId_createdAt_idx" ON "PluginParsonsAttemptEvent"("attemptId", "createdAt");
CREATE INDEX "PluginParsonsAttemptEvent_type_idx" ON "PluginParsonsAttemptEvent"("type");

ALTER TABLE "PluginParsonsAttempt"
  ADD CONSTRAINT "PluginParsonsAttempt_activityId_fkey"
  FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PluginParsonsAttempt"
  ADD CONSTRAINT "PluginParsonsAttempt_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PluginParsonsAttemptEvent"
  ADD CONSTRAINT "PluginParsonsAttemptEvent_attemptId_fkey"
  FOREIGN KEY ("attemptId") REFERENCES "PluginParsonsAttempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;
