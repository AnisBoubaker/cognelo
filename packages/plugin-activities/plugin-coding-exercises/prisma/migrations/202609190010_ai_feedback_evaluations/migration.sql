CREATE TABLE "PluginCodingExerciseAiEvaluation" (
  "id" TEXT NOT NULL,
  "activityId" TEXT NOT NULL,
  "executionId" TEXT NOT NULL,
  "coreAttemptId" TEXT,
  "courseId" TEXT NOT NULL,
  "groupId" TEXT,
  "participantId" TEXT,
  "userId" TEXT NOT NULL,
  "createdByUserId" TEXT NOT NULL,
  "assessmentMode" TEXT NOT NULL,
  "triggerKind" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "rubricSnapshot" JSONB NOT NULL,
  "promptVersion" TEXT NOT NULL,
  "schemaVersion" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "model" TEXT NOT NULL,
  "connectionId" TEXT NOT NULL,
  "requestPayload" JSONB NOT NULL,
  "rawResponse" TEXT,
  "parsedResponse" JSONB,
  "sanitizedFeedback" JSONB,
  "criterionScores" JSONB,
  "deterministicScore" DOUBLE PRECISION NOT NULL,
  "aiScore" DOUBLE PRECISION,
  "combinedScore" DOUBLE PRECISION,
  "testWeightPercent" INTEGER NOT NULL,
  "aiWeightPercent" INTEGER NOT NULL,
  "submissionHash" TEXT NOT NULL,
  "feedbackHash" TEXT,
  "latencyMs" INTEGER,
  "tokenUsage" JSONB,
  "error" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PluginCodingExerciseAiEvaluation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PluginCodingExerciseAiEvaluation_activityId_executionId_version_key" ON "PluginCodingExerciseAiEvaluation"("activityId", "executionId", "version");
CREATE INDEX "PluginCodingExerciseAiEvaluation_activityId_createdAt_idx" ON "PluginCodingExerciseAiEvaluation"("activityId", "createdAt");
CREATE INDEX "PluginCodingExerciseAiEvaluation_executionId_createdAt_idx" ON "PluginCodingExerciseAiEvaluation"("executionId", "createdAt");
CREATE INDEX "PluginCodingExerciseAiEvaluation_coreAttemptId_createdAt_idx" ON "PluginCodingExerciseAiEvaluation"("coreAttemptId", "createdAt");
CREATE INDEX "PluginCodingExerciseAiEvaluation_courseId_createdAt_idx" ON "PluginCodingExerciseAiEvaluation"("courseId", "createdAt");
CREATE INDEX "PluginCodingExerciseAiEvaluation_participantId_createdAt_idx" ON "PluginCodingExerciseAiEvaluation"("participantId", "createdAt");
CREATE INDEX "PluginCodingExerciseAiEvaluation_status_createdAt_idx" ON "PluginCodingExerciseAiEvaluation"("status", "createdAt");
