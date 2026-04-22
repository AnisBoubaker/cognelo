CREATE TYPE "PluginCodingExerciseExecutionKind" AS ENUM ('run', 'submit');
CREATE TYPE "PluginCodingExerciseExecutionStatus" AS ENUM ('pending', 'completed', 'failed');

CREATE TABLE "PluginCodingExerciseHiddenTest" (
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
);

CREATE TABLE "PluginCodingExerciseExecution" (
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
);

CREATE INDEX "PluginCodingExerciseHiddenTest_activityId_orderIndex_idx"
  ON "PluginCodingExerciseHiddenTest"("activityId", "orderIndex");
CREATE INDEX "PluginCodingExerciseHiddenTest_activityId_isEnabled_idx"
  ON "PluginCodingExerciseHiddenTest"("activityId", "isEnabled");
CREATE INDEX "PluginCodingExerciseExecution_activityId_userId_createdAt_idx"
  ON "PluginCodingExerciseExecution"("activityId", "userId", "createdAt");
CREATE INDEX "PluginCodingExerciseExecution_userId_createdAt_idx"
  ON "PluginCodingExerciseExecution"("userId", "createdAt");
CREATE INDEX "PluginCodingExerciseExecution_activityId_kind_createdAt_idx"
  ON "PluginCodingExerciseExecution"("activityId", "kind", "createdAt");
CREATE INDEX "PluginCodingExerciseExecution_judge0Token_idx"
  ON "PluginCodingExerciseExecution"("judge0Token");

ALTER TABLE "PluginCodingExerciseHiddenTest"
  ADD CONSTRAINT "PluginCodingExerciseHiddenTest_activityId_fkey"
  FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PluginCodingExerciseExecution"
  ADD CONSTRAINT "PluginCodingExerciseExecution_activityId_fkey"
  FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PluginCodingExerciseExecution"
  ADD CONSTRAINT "PluginCodingExerciseExecution_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
