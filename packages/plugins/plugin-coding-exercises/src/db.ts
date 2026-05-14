export const codingExercisesDatabaseModule = {
  namespace: "plugin_coding_exercises",
  tables: [
    "PluginCodingExerciseHiddenTest",
    "PluginCodingExerciseReferenceSolution",
    "PluginCodingExerciseExecution",
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
    }
  ],
  notes: [
    "Only student-visible authoring fields live in the shared activity config.",
    "Hidden tests, teacher-only reference solutions, private execution templates/support code, and execution history live in plugin-owned tables so they never need to be exposed in the browser payload.",
    "Activity-bank coding exercises own parallel private tables; these records are copied into course-owned plugin tables when a bank version is assigned."
  ]
} as const;
