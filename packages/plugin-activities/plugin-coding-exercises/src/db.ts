export const codingExercisesDatabaseModule = {
  namespace: "plugin_coding_exercises",
  tables: [
    "PluginCodingExerciseHiddenTest",
    "PluginCodingExerciseReferenceSolution",
    "PluginCodingExerciseExecution",
    "PluginCodingExerciseAiEvaluation",
    "PluginBankCodingExerciseHiddenTest",
    "PluginBankCodingExerciseReferenceSolution"
  ],
  migrations: [
    {
      id: "202605130010_baseline",
      statements: [
        `DO $$ BEGIN
          CREATE TYPE "PluginCodingExerciseExecutionKind" AS ENUM ('run', 'submit');
        EXCEPTION
          WHEN duplicate_object THEN null;
        END $$`,
        `DO $$ BEGIN
          CREATE TYPE "PluginCodingExerciseExecutionStatus" AS ENUM ('pending', 'completed', 'failed');
        EXCEPTION
          WHEN duplicate_object THEN null;
        END $$`,
        `CREATE TABLE IF NOT EXISTS "PluginCodingExerciseHiddenTest" (
          "id" TEXT NOT NULL,
          "activityId" TEXT NOT NULL,
          "name" TEXT NOT NULL,
          "stdin" TEXT NOT NULL DEFAULT '',
          "expectedOutput" TEXT NOT NULL DEFAULT '',
          "orderIndex" INTEGER NOT NULL DEFAULT 0,
          "isEnabled" BOOLEAN NOT NULL DEFAULT true,
          "weight" INTEGER NOT NULL DEFAULT 1,
          "metadata" JSONB NOT NULL DEFAULT '{}',
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL,
          CONSTRAINT "PluginCodingExerciseHiddenTest_pkey" PRIMARY KEY ("id")
        )`,
        `CREATE TABLE IF NOT EXISTS "PluginCodingExerciseReferenceSolution" (
          "id" TEXT NOT NULL,
          "activityId" TEXT NOT NULL,
          "sourceCode" TEXT NOT NULL,
          "privateConfig" JSONB NOT NULL DEFAULT '{}',
          "validationSummary" JSONB NOT NULL DEFAULT '{}',
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL,
          CONSTRAINT "PluginCodingExerciseReferenceSolution_pkey" PRIMARY KEY ("id")
        )`,
        `CREATE TABLE IF NOT EXISTS "PluginCodingExerciseExecution" (
          "id" TEXT NOT NULL,
          "activityId" TEXT NOT NULL,
          "userId" TEXT NOT NULL,
          "kind" "PluginCodingExerciseExecutionKind" NOT NULL DEFAULT 'run',
          "status" "PluginCodingExerciseExecutionStatus" NOT NULL DEFAULT 'pending',
          "languageKey" TEXT NOT NULL,
          "judge0LanguageId" INTEGER NOT NULL,
          "sourceCode" TEXT NOT NULL,
          "stdin" TEXT DEFAULT '',
          "expectedOutput" TEXT DEFAULT '',
          "judge0Token" TEXT,
          "stdout" TEXT,
          "stderr" TEXT,
          "compileOutput" TEXT,
          "message" TEXT,
          "timeSeconds" TEXT,
          "memoryKb" INTEGER,
          "judge0StatusId" INTEGER,
          "judge0StatusLabel" TEXT,
          "resultSummary" JSONB NOT NULL DEFAULT '{}',
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL,
          CONSTRAINT "PluginCodingExerciseExecution_pkey" PRIMARY KEY ("id")
        )`,
        `CREATE TABLE IF NOT EXISTS "PluginBankCodingExerciseHiddenTest" (
          "id" TEXT NOT NULL,
          "bankActivityId" TEXT NOT NULL,
          "name" TEXT NOT NULL,
          "stdin" TEXT NOT NULL DEFAULT '',
          "expectedOutput" TEXT NOT NULL DEFAULT '',
          "orderIndex" INTEGER NOT NULL DEFAULT 0,
          "isEnabled" BOOLEAN NOT NULL DEFAULT true,
          "weight" INTEGER NOT NULL DEFAULT 1,
          "metadata" JSONB NOT NULL DEFAULT '{}',
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL,
          CONSTRAINT "PluginBankCodingExerciseHiddenTest_pkey" PRIMARY KEY ("id")
        )`,
        `CREATE TABLE IF NOT EXISTS "PluginBankCodingExerciseReferenceSolution" (
          "id" TEXT NOT NULL,
          "bankActivityId" TEXT NOT NULL,
          "sourceCode" TEXT NOT NULL,
          "privateConfig" JSONB NOT NULL DEFAULT '{}',
          "validationSummary" JSONB NOT NULL DEFAULT '{}',
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL,
          CONSTRAINT "PluginBankCodingExerciseReferenceSolution_pkey" PRIMARY KEY ("id")
        )`,
        `CREATE INDEX IF NOT EXISTS "PluginCodingExerciseHiddenTest_activityId_orderIndex_idx" ON "PluginCodingExerciseHiddenTest"("activityId", "orderIndex")`,
        `CREATE INDEX IF NOT EXISTS "PluginCodingExerciseHiddenTest_activityId_isEnabled_idx" ON "PluginCodingExerciseHiddenTest"("activityId", "isEnabled")`,
        `CREATE UNIQUE INDEX IF NOT EXISTS "PluginCodingExerciseReferenceSolution_activityId_key" ON "PluginCodingExerciseReferenceSolution"("activityId")`,
        `CREATE INDEX IF NOT EXISTS "PluginCodingExerciseExecution_activityId_userId_createdAt_idx" ON "PluginCodingExerciseExecution"("activityId", "userId", "createdAt")`,
        `CREATE INDEX IF NOT EXISTS "PluginCodingExerciseExecution_userId_createdAt_idx" ON "PluginCodingExerciseExecution"("userId", "createdAt")`,
        `CREATE INDEX IF NOT EXISTS "PluginCodingExerciseExecution_activityId_kind_createdAt_idx" ON "PluginCodingExerciseExecution"("activityId", "kind", "createdAt")`,
        `CREATE INDEX IF NOT EXISTS "PluginCodingExerciseExecution_judge0Token_idx" ON "PluginCodingExerciseExecution"("judge0Token")`,
        `CREATE INDEX IF NOT EXISTS "PluginBankCodingExerciseHiddenTest_bankActivityId_orderInde_idx" ON "PluginBankCodingExerciseHiddenTest"("bankActivityId", "orderIndex")`,
        `CREATE INDEX IF NOT EXISTS "PluginBankCodingExerciseHiddenTest_bankActivityId_isEnabled_idx" ON "PluginBankCodingExerciseHiddenTest"("bankActivityId", "isEnabled")`,
        `CREATE UNIQUE INDEX IF NOT EXISTS "PluginBankCodingExerciseReferenceSolution_bankActivityId_key" ON "PluginBankCodingExerciseReferenceSolution"("bankActivityId")`
      ]
    },
    {
      id: "202609190010_ai_feedback_evaluations",
      statements: [
        `CREATE TABLE IF NOT EXISTS "PluginCodingExerciseAiEvaluation" (
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
        )`,
        `CREATE UNIQUE INDEX IF NOT EXISTS "PluginCodingExerciseAiEvaluation_activityId_executionId_version_key" ON "PluginCodingExerciseAiEvaluation"("activityId", "executionId", "version")`,
        `CREATE INDEX IF NOT EXISTS "PluginCodingExerciseAiEvaluation_activityId_createdAt_idx" ON "PluginCodingExerciseAiEvaluation"("activityId", "createdAt")`,
        `CREATE INDEX IF NOT EXISTS "PluginCodingExerciseAiEvaluation_executionId_createdAt_idx" ON "PluginCodingExerciseAiEvaluation"("executionId", "createdAt")`,
        `CREATE INDEX IF NOT EXISTS "PluginCodingExerciseAiEvaluation_coreAttemptId_createdAt_idx" ON "PluginCodingExerciseAiEvaluation"("coreAttemptId", "createdAt")`,
        `CREATE INDEX IF NOT EXISTS "PluginCodingExerciseAiEvaluation_courseId_createdAt_idx" ON "PluginCodingExerciseAiEvaluation"("courseId", "createdAt")`,
        `CREATE INDEX IF NOT EXISTS "PluginCodingExerciseAiEvaluation_participantId_createdAt_idx" ON "PluginCodingExerciseAiEvaluation"("participantId", "createdAt")`,
        `CREATE INDEX IF NOT EXISTS "PluginCodingExerciseAiEvaluation_status_createdAt_idx" ON "PluginCodingExerciseAiEvaluation"("status", "createdAt")`
      ]
    },
    {
      id: "202609190011_ai_feedback_submission_snapshot",
      statements: [
        `ALTER TABLE "PluginCodingExerciseExecution" ADD COLUMN IF NOT EXISTS "aiFeedbackConfigSnapshot" JSONB`
      ]
    },
    {
      id: "202609190012_remove_rubric_versions",
      statements: [
        `UPDATE "PluginCodingExerciseReferenceSolution"
         SET "privateConfig" = jsonb_set("privateConfig", '{aiFeedback}', ("privateConfig"->'aiFeedback') - 'rubricVersion')
         WHERE jsonb_typeof("privateConfig"->'aiFeedback') = 'object' AND ("privateConfig"->'aiFeedback') ? 'rubricVersion'`,
        `UPDATE "PluginBankCodingExerciseReferenceSolution"
         SET "privateConfig" = jsonb_set("privateConfig", '{aiFeedback}', ("privateConfig"->'aiFeedback') - 'rubricVersion')
         WHERE jsonb_typeof("privateConfig"->'aiFeedback') = 'object' AND ("privateConfig"->'aiFeedback') ? 'rubricVersion'`,
        `UPDATE "PluginCodingExerciseExecution"
         SET "aiFeedbackConfigSnapshot" = "aiFeedbackConfigSnapshot" - 'rubricVersion'
         WHERE jsonb_typeof("aiFeedbackConfigSnapshot") = 'object' AND "aiFeedbackConfigSnapshot" ? 'rubricVersion'`,
        `UPDATE "PluginCodingExerciseAiEvaluation"
         SET "rubricSnapshot" = "rubricSnapshot" - 'version',
             "requestPayload" = CASE
               WHEN jsonb_typeof("requestPayload"->'rubric') = 'object'
               THEN jsonb_set("requestPayload", '{rubric}', ("requestPayload"->'rubric') - 'version')
               ELSE "requestPayload"
             END
         WHERE "rubricSnapshot" ? 'version' OR jsonb_typeof("requestPayload"->'rubric') = 'object'`
      ]
    }
  ],
  notes: [
    "Only student-visible authoring fields live in the shared activity config.",
    "Hidden tests, teacher-only reference solutions, private execution templates/support code, and execution history live in plugin-owned tables so they never need to be exposed in the browser payload.",
    "Activity-bank coding exercises own parallel private tables; these records are copied into course-owned plugin tables when a bank version is assigned."
  ]
} as const;
