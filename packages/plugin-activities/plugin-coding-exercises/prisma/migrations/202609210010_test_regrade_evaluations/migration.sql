CREATE TABLE IF NOT EXISTS "PluginCodingExerciseTestEvaluation" (
  "id" TEXT NOT NULL,
  "activityId" TEXT NOT NULL,
  "executionId" TEXT NOT NULL,
  "actorUserId" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "resultSummary" JSONB NOT NULL DEFAULT '{}',
  "configSnapshot" JSONB NOT NULL DEFAULT '{}',
  "error" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PluginCodingExerciseTestEvaluation_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "PluginCodingExerciseTestEvaluation_executionId_status_createdAt_idx" ON "PluginCodingExerciseTestEvaluation"("executionId", "status", "createdAt");
CREATE INDEX IF NOT EXISTS "PluginCodingExerciseTestEvaluation_activityId_createdAt_idx" ON "PluginCodingExerciseTestEvaluation"("activityId", "createdAt");
