CREATE TYPE "PluginWebDesignExerciseTestKind" AS ENUM ('sample', 'hidden');
CREATE TYPE "PluginWebDesignExerciseSubmissionKind" AS ENUM ('run', 'submit');
CREATE TYPE "PluginWebDesignExerciseSubmissionStatus" AS ENUM ('pending', 'completed', 'failed');

CREATE TABLE "PluginWebDesignExerciseReferenceBundle" (
  "id" TEXT NOT NULL,
  "activityId" TEXT NOT NULL,
  "files" JSONB NOT NULL DEFAULT '[]',
  "validationSummary" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PluginWebDesignExerciseReferenceBundle_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PluginWebDesignExerciseTest" (
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
);

CREATE TABLE "PluginWebDesignExerciseSubmission" (
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
);

CREATE TABLE "PluginWebDesignExerciseTestResult" (
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
);

CREATE UNIQUE INDEX "PluginWebDesignExerciseReferenceBundle_activityId_key"
  ON "PluginWebDesignExerciseReferenceBundle"("activityId");

CREATE INDEX "PluginWebDesignExerciseTest_activityId_kind_orderIndex_idx"
  ON "PluginWebDesignExerciseTest"("activityId", "kind", "orderIndex");
CREATE INDEX "PluginWebDesignExerciseTest_activityId_isEnabled_idx"
  ON "PluginWebDesignExerciseTest"("activityId", "isEnabled");

CREATE INDEX "PluginWebDesignExerciseSubmission_activityId_userId_createdAt_idx"
  ON "PluginWebDesignExerciseSubmission"("activityId", "userId", "createdAt");
CREATE INDEX "PluginWebDesignExerciseSubmission_userId_createdAt_idx"
  ON "PluginWebDesignExerciseSubmission"("userId", "createdAt");
CREATE INDEX "PluginWebDesignExerciseSubmission_activityId_kind_createdAt_idx"
  ON "PluginWebDesignExerciseSubmission"("activityId", "kind", "createdAt");
CREATE INDEX "PluginWebDesignExerciseSubmission_activityId_status_createdAt_idx"
  ON "PluginWebDesignExerciseSubmission"("activityId", "status", "createdAt");

CREATE INDEX "PluginWebDesignExerciseTestResult_submissionId_idx"
  ON "PluginWebDesignExerciseTestResult"("submissionId");
CREATE INDEX "PluginWebDesignExerciseTestResult_testId_idx"
  ON "PluginWebDesignExerciseTestResult"("testId");
CREATE INDEX "PluginWebDesignExerciseTestResult_status_idx"
  ON "PluginWebDesignExerciseTestResult"("status");

ALTER TABLE "PluginWebDesignExerciseReferenceBundle"
  ADD CONSTRAINT "PluginWebDesignExerciseReferenceBundle_activityId_fkey"
  FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PluginWebDesignExerciseTest"
  ADD CONSTRAINT "PluginWebDesignExerciseTest_activityId_fkey"
  FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PluginWebDesignExerciseSubmission"
  ADD CONSTRAINT "PluginWebDesignExerciseSubmission_activityId_fkey"
  FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PluginWebDesignExerciseSubmission"
  ADD CONSTRAINT "PluginWebDesignExerciseSubmission_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PluginWebDesignExerciseTestResult"
  ADD CONSTRAINT "PluginWebDesignExerciseTestResult_submissionId_fkey"
  FOREIGN KEY ("submissionId") REFERENCES "PluginWebDesignExerciseSubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PluginWebDesignExerciseTestResult"
  ADD CONSTRAINT "PluginWebDesignExerciseTestResult_testId_fkey"
  FOREIGN KEY ("testId") REFERENCES "PluginWebDesignExerciseTest"("id") ON DELETE SET NULL ON UPDATE CASCADE;
