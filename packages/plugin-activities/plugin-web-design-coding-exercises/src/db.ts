export const webDesignCodingExercisesDatabaseModule = {
  namespace: "plugin_web_design_coding_exercises",
  tables: [
    "PluginWebDesignExerciseReferenceBundle",
    "PluginWebDesignExerciseTest",
    "PluginWebDesignExerciseSubmission",
    "PluginWebDesignExerciseTestResult",
    "PluginBankWebDesignExerciseReferenceBundle",
    "PluginBankWebDesignExerciseTest"
  ],
  migrations: [
    {
      id: "202605130010_baseline",
      statements: [
        `DO $$ BEGIN
          CREATE TYPE "PluginWebDesignExerciseTestKind" AS ENUM ('sample', 'hidden');
        EXCEPTION
          WHEN duplicate_object THEN null;
        END $$`,
        `DO $$ BEGIN
          CREATE TYPE "PluginWebDesignExerciseSubmissionKind" AS ENUM ('run', 'submit');
        EXCEPTION
          WHEN duplicate_object THEN null;
        END $$`,
        `DO $$ BEGIN
          CREATE TYPE "PluginWebDesignExerciseSubmissionStatus" AS ENUM ('pending', 'completed', 'failed');
        EXCEPTION
          WHEN duplicate_object THEN null;
        END $$`,
        `CREATE TABLE IF NOT EXISTS "PluginWebDesignExerciseReferenceBundle" (
          "id" TEXT NOT NULL,
          "activityId" TEXT NOT NULL,
          "files" JSONB NOT NULL DEFAULT '[]',
          "validationSummary" JSONB NOT NULL DEFAULT '{}',
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL,
          CONSTRAINT "PluginWebDesignExerciseReferenceBundle_pkey" PRIMARY KEY ("id")
        )`,
        `CREATE TABLE IF NOT EXISTS "PluginWebDesignExerciseTest" (
          "id" TEXT NOT NULL,
          "activityId" TEXT NOT NULL,
          "name" TEXT NOT NULL,
          "kind" "PluginWebDesignExerciseTestKind" NOT NULL DEFAULT 'hidden',
          "testCode" TEXT NOT NULL,
          "orderIndex" INTEGER NOT NULL DEFAULT 0,
          "isEnabled" BOOLEAN NOT NULL DEFAULT true,
          "weight" INTEGER NOT NULL DEFAULT 1,
          "metadata" JSONB NOT NULL DEFAULT '{}',
          "validationSummary" JSONB NOT NULL DEFAULT '{}',
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL,
          CONSTRAINT "PluginWebDesignExerciseTest_pkey" PRIMARY KEY ("id")
        )`,
        `CREATE TABLE IF NOT EXISTS "PluginWebDesignExerciseSubmission" (
          "id" TEXT NOT NULL,
          "activityId" TEXT NOT NULL,
          "userId" TEXT NOT NULL,
          "kind" "PluginWebDesignExerciseSubmissionKind" NOT NULL DEFAULT 'run',
          "status" "PluginWebDesignExerciseSubmissionStatus" NOT NULL DEFAULT 'pending',
          "files" JSONB NOT NULL DEFAULT '[]',
          "resultSummary" JSONB NOT NULL DEFAULT '{}',
          "score" DOUBLE PRECISION,
          "maxScore" DOUBLE PRECISION,
          "message" TEXT,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL,
          CONSTRAINT "PluginWebDesignExerciseSubmission_pkey" PRIMARY KEY ("id")
        )`,
        `CREATE TABLE IF NOT EXISTS "PluginWebDesignExerciseTestResult" (
          "id" TEXT NOT NULL,
          "submissionId" TEXT NOT NULL,
          "testId" TEXT,
          "name" TEXT NOT NULL,
          "status" "PluginWebDesignExerciseSubmissionStatus" NOT NULL,
          "weight" INTEGER NOT NULL DEFAULT 1,
          "score" DOUBLE PRECISION,
          "message" TEXT,
          "durationMs" INTEGER,
          "details" JSONB NOT NULL DEFAULT '{}',
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "PluginWebDesignExerciseTestResult_pkey" PRIMARY KEY ("id")
        )`,
        `CREATE TABLE IF NOT EXISTS "PluginBankWebDesignExerciseReferenceBundle" (
          "id" TEXT NOT NULL,
          "bankActivityId" TEXT NOT NULL,
          "files" JSONB NOT NULL DEFAULT '[]',
          "validationSummary" JSONB NOT NULL DEFAULT '{}',
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL,
          CONSTRAINT "PluginBankWebDesignExerciseReferenceBundle_pkey" PRIMARY KEY ("id")
        )`,
        `CREATE TABLE IF NOT EXISTS "PluginBankWebDesignExerciseTest" (
          "id" TEXT NOT NULL,
          "bankActivityId" TEXT NOT NULL,
          "name" TEXT NOT NULL,
          "kind" "PluginWebDesignExerciseTestKind" NOT NULL DEFAULT 'hidden',
          "testCode" TEXT NOT NULL,
          "orderIndex" INTEGER NOT NULL DEFAULT 0,
          "isEnabled" BOOLEAN NOT NULL DEFAULT true,
          "weight" INTEGER NOT NULL DEFAULT 1,
          "metadata" JSONB NOT NULL DEFAULT '{}',
          "validationSummary" JSONB NOT NULL DEFAULT '{}',
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL,
          CONSTRAINT "PluginBankWebDesignExerciseTest_pkey" PRIMARY KEY ("id")
        )`,
        `CREATE UNIQUE INDEX IF NOT EXISTS "PluginWebDesignExerciseReferenceBundle_activityId_key" ON "PluginWebDesignExerciseReferenceBundle"("activityId")`,
        `CREATE INDEX IF NOT EXISTS "PluginWebDesignExerciseTest_activityId_kind_orderIndex_idx" ON "PluginWebDesignExerciseTest"("activityId", "kind", "orderIndex")`,
        `CREATE INDEX IF NOT EXISTS "PluginWebDesignExerciseTest_activityId_isEnabled_idx" ON "PluginWebDesignExerciseTest"("activityId", "isEnabled")`,
        `CREATE INDEX IF NOT EXISTS "PluginWebDesignExerciseSubmission_activityId_userId_createdAt_idx" ON "PluginWebDesignExerciseSubmission"("activityId", "userId", "createdAt")`,
        `CREATE INDEX IF NOT EXISTS "PluginWebDesignExerciseSubmission_userId_createdAt_idx" ON "PluginWebDesignExerciseSubmission"("userId", "createdAt")`,
        `CREATE INDEX IF NOT EXISTS "PluginWebDesignExerciseSubmission_activityId_kind_createdAt_idx" ON "PluginWebDesignExerciseSubmission"("activityId", "kind", "createdAt")`,
        `CREATE INDEX IF NOT EXISTS "PluginWebDesignExerciseSubmission_activityId_status_createdAt_idx" ON "PluginWebDesignExerciseSubmission"("activityId", "status", "createdAt")`,
        `CREATE INDEX IF NOT EXISTS "PluginWebDesignExerciseTestResult_submissionId_idx" ON "PluginWebDesignExerciseTestResult"("submissionId")`,
        `CREATE INDEX IF NOT EXISTS "PluginWebDesignExerciseTestResult_testId_idx" ON "PluginWebDesignExerciseTestResult"("testId")`,
        `CREATE INDEX IF NOT EXISTS "PluginWebDesignExerciseTestResult_status_idx" ON "PluginWebDesignExerciseTestResult"("status")`,
        `CREATE UNIQUE INDEX IF NOT EXISTS "PluginBankWebDesignExerciseReferenceBundle_bankActivityId_key" ON "PluginBankWebDesignExerciseReferenceBundle"("bankActivityId")`,
        `CREATE INDEX IF NOT EXISTS "PluginBankWebDesignExerciseTest_bankActivityId_kind_orderIn_idx" ON "PluginBankWebDesignExerciseTest"("bankActivityId", "kind", "orderIndex")`,
        `CREATE INDEX IF NOT EXISTS "PluginBankWebDesignExerciseTest_bankActivityId_isEnabled_idx" ON "PluginBankWebDesignExerciseTest"("bankActivityId", "isEnabled")`,
        `DO $$ BEGIN
          ALTER TABLE "PluginWebDesignExerciseTestResult"
          ADD CONSTRAINT "PluginWebDesignExerciseTestResult_submissionId_fkey"
          FOREIGN KEY ("submissionId") REFERENCES "PluginWebDesignExerciseSubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
        EXCEPTION
          WHEN duplicate_object THEN null;
        END $$`,
        `DO $$ BEGIN
          ALTER TABLE "PluginWebDesignExerciseTestResult"
          ADD CONSTRAINT "PluginWebDesignExerciseTestResult_testId_fkey"
          FOREIGN KEY ("testId") REFERENCES "PluginWebDesignExerciseTest"("id") ON DELETE SET NULL ON UPDATE CASCADE;
        EXCEPTION
          WHEN duplicate_object THEN null;
        END $$`
      ]
    }
  ],
  notes: [
    "Student-visible starter files live in shared activity config.",
    "Private teacher solution/reference file bundles, Playwright tests, student submissions, and per-test results live in plugin-owned tables so hidden grading internals are never exposed in the student browser payload."
  ]
} as const;
