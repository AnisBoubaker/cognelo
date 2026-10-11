export const mcqDatabaseModule = {
  namespace: "plugin_mcq",
  tables: ["PluginMcqAiEvaluation"],
  migrations: [{
    id: "202609190020_ai_feedback_evaluations",
    statements: [
      `CREATE TABLE IF NOT EXISTS "PluginMcqAiEvaluation" (
        "id" TEXT NOT NULL, "activityId" TEXT NOT NULL, "coreAttemptId" TEXT, "courseId" TEXT NOT NULL,
        "groupId" TEXT NOT NULL, "participantId" TEXT, "userId" TEXT NOT NULL, "createdByUserId" TEXT NOT NULL,
        "assessmentMode" TEXT NOT NULL, "triggerKind" TEXT NOT NULL, "status" TEXT NOT NULL, "version" INTEGER NOT NULL,
        "promptVersion" TEXT NOT NULL, "schemaVersion" TEXT NOT NULL, "provider" TEXT NOT NULL, "model" TEXT NOT NULL,
        "connectionId" TEXT NOT NULL, "requestPayload" JSONB NOT NULL, "rawResponse" TEXT, "parsedResponse" JSONB,
        "sanitizedFeedback" JSONB, "submissionHash" TEXT NOT NULL, "feedbackHash" TEXT, "latencyMs" INTEGER,
        "error" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "PluginMcqAiEvaluation_pkey" PRIMARY KEY ("id")
      )`,
      `CREATE UNIQUE INDEX IF NOT EXISTS "PluginMcqAiEvaluation_activityId_coreAttemptId_version_key" ON "PluginMcqAiEvaluation"("activityId", "coreAttemptId", "version")`,
      `CREATE INDEX IF NOT EXISTS "PluginMcqAiEvaluation_activityId_createdAt_idx" ON "PluginMcqAiEvaluation"("activityId", "createdAt")`,
      `CREATE INDEX IF NOT EXISTS "PluginMcqAiEvaluation_coreAttemptId_createdAt_idx" ON "PluginMcqAiEvaluation"("coreAttemptId", "createdAt")`,
      `CREATE INDEX IF NOT EXISTS "PluginMcqAiEvaluation_courseId_createdAt_idx" ON "PluginMcqAiEvaluation"("courseId", "createdAt")`,
      `CREATE INDEX IF NOT EXISTS "PluginMcqAiEvaluation_participantId_createdAt_idx" ON "PluginMcqAiEvaluation"("participantId", "createdAt")`
    ]
  }],
  notes: ["MCQ keeps deterministic grading in core and stores immutable AI feedback artifacts in a plugin-owned evaluation table."]
} as const;
