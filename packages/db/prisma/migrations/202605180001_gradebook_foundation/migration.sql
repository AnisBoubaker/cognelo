-- CreateEnum
CREATE TYPE "GradebookGradingMode" AS ENUM ('points', 'pass_fail');

-- CreateEnum
CREATE TYPE "GradebookAttemptLimitMode" AS ENUM ('unlimited', 'max_attempts', 'until_due');

-- CreateEnum
CREATE TYPE "GradebookGradeStrategy" AS ENUM ('latest', 'best', 'first', 'weighted_average');

-- CreateEnum
CREATE TYPE "ActivityAttemptLifecycle" AS ENUM ('started', 'submitted', 'graded');

-- CreateEnum
CREATE TYPE "GradeSource" AS ENUM ('auto', 'manual', 'override', 'regrade');

-- CreateEnum
CREATE TYPE "GradeEventType" AS ENUM ('auto_graded', 'manual_graded', 'overridden', 'regraded', 'released', 'hidden');

-- CreateTable
CREATE TABLE "GradebookItem" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "groupActivityId" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "titleSnapshot" TEXT NOT NULL,
    "pointsPossible" DOUBLE PRECISION NOT NULL DEFAULT 100,
    "gradingMode" "GradebookGradingMode" NOT NULL DEFAULT 'points',
    "passThresholdPoints" DOUBLE PRECISION,
    "passThresholdOutOf" DOUBLE PRECISION,
    "attemptLimitMode" "GradebookAttemptLimitMode" NOT NULL DEFAULT 'unlimited',
    "maxAttempts" INTEGER,
    "gradeStrategy" "GradebookGradeStrategy" NOT NULL DEFAULT 'latest',
    "dropLowestAttempt" BOOLEAN NOT NULL DEFAULT false,
    "lateSubmissionsAllowed" BOOLEAN NOT NULL DEFAULT false,
    "latePenaltyPercent" DOUBLE PRECISION,
    "latePenaltyIntervalMinutes" INTEGER,
    "latePenaltyMaxPercent" DOUBLE PRECISION,
    "lateGracePeriodMinutes" INTEGER,
    "gradesReleased" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GradebookItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityAttempt" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "groupActivityId" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "gradebookItemId" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "userId" TEXT,
    "attemptNumber" INTEGER NOT NULL,
    "lifecycle" "ActivityAttemptLifecycle" NOT NULL DEFAULT 'started',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submittedAt" TIMESTAMP(3),
    "gradedAt" TIMESTAMP(3),
    "durationSeconds" INTEGER,
    "isLate" BOOLEAN NOT NULL DEFAULT false,
    "lateBySeconds" INTEGER,
    "activityVersionId" TEXT,
    "activityConfigFingerprint" TEXT,
    "pluginKey" TEXT NOT NULL,
    "pluginVersion" TEXT NOT NULL,
    "pluginAttemptRef" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ActivityAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Grade" (
    "id" TEXT NOT NULL,
    "gradebookItemId" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "userId" TEXT,
    "selectedAttemptId" TEXT,
    "rawScore" DOUBLE PRECISION NOT NULL,
    "rawMaxScore" DOUBLE PRECISION NOT NULL,
    "normalizedScore" DOUBLE PRECISION NOT NULL,
    "normalizedMaxScore" DOUBLE PRECISION NOT NULL,
    "isPass" BOOLEAN,
    "latePenaltyApplied" BOOLEAN NOT NULL DEFAULT false,
    "latePenaltyPercent" DOUBLE PRECISION,
    "gradedByUserId" TEXT,
    "gradedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" "GradeSource" NOT NULL,
    "rawResult" JSONB NOT NULL DEFAULT '{}',
    "normalizedResult" JSONB NOT NULL DEFAULT '{}',
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Grade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GradeEvent" (
    "id" TEXT NOT NULL,
    "gradeId" TEXT,
    "gradebookItemId" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "attemptId" TEXT,
    "actorUserId" TEXT,
    "eventType" "GradeEventType" NOT NULL,
    "previousValue" JSONB,
    "nextValue" JSONB,
    "reason" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GradeEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GradebookItem_groupActivityId_key" ON "GradebookItem"("groupActivityId");

-- CreateIndex
CREATE INDEX "GradebookItem_courseId_groupId_idx" ON "GradebookItem"("courseId", "groupId");

-- CreateIndex
CREATE INDEX "GradebookItem_courseId_activityId_idx" ON "GradebookItem"("courseId", "activityId");

-- CreateIndex
CREATE INDEX "GradebookItem_groupId_activityId_idx" ON "GradebookItem"("groupId", "activityId");

-- CreateIndex
CREATE INDEX "GradebookItem_activityId_idx" ON "GradebookItem"("activityId");

-- CreateIndex
CREATE INDEX "GradebookItem_gradesReleased_idx" ON "GradebookItem"("gradesReleased");

-- CreateIndex
CREATE UNIQUE INDEX "ActivityAttempt_gradebookItemId_participantId_attemptNumber_key" ON "ActivityAttempt"("gradebookItemId", "participantId", "attemptNumber");

-- CreateIndex
CREATE INDEX "ActivityAttempt_courseId_groupId_activityId_idx" ON "ActivityAttempt"("courseId", "groupId", "activityId");

-- CreateIndex
CREATE INDEX "ActivityAttempt_gradebookItemId_participantId_idx" ON "ActivityAttempt"("gradebookItemId", "participantId");

-- CreateIndex
CREATE INDEX "ActivityAttempt_participantId_createdAt_idx" ON "ActivityAttempt"("participantId", "createdAt");

-- CreateIndex
CREATE INDEX "ActivityAttempt_userId_idx" ON "ActivityAttempt"("userId");

-- CreateIndex
CREATE INDEX "ActivityAttempt_lifecycle_idx" ON "ActivityAttempt"("lifecycle");

-- CreateIndex
CREATE INDEX "ActivityAttempt_pluginKey_pluginAttemptRef_idx" ON "ActivityAttempt"("pluginKey", "pluginAttemptRef");

-- CreateIndex
CREATE INDEX "ActivityAttempt_activityVersionId_idx" ON "ActivityAttempt"("activityVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "Grade_gradebookItemId_participantId_key" ON "Grade"("gradebookItemId", "participantId");

-- CreateIndex
CREATE INDEX "Grade_participantId_idx" ON "Grade"("participantId");

-- CreateIndex
CREATE INDEX "Grade_userId_idx" ON "Grade"("userId");

-- CreateIndex
CREATE INDEX "Grade_selectedAttemptId_idx" ON "Grade"("selectedAttemptId");

-- CreateIndex
CREATE INDEX "Grade_gradedByUserId_idx" ON "Grade"("gradedByUserId");

-- CreateIndex
CREATE INDEX "Grade_source_idx" ON "Grade"("source");

-- CreateIndex
CREATE INDEX "Grade_gradedAt_idx" ON "Grade"("gradedAt");

-- CreateIndex
CREATE INDEX "GradeEvent_gradeId_createdAt_idx" ON "GradeEvent"("gradeId", "createdAt");

-- CreateIndex
CREATE INDEX "GradeEvent_gradebookItemId_participantId_createdAt_idx" ON "GradeEvent"("gradebookItemId", "participantId", "createdAt");

-- CreateIndex
CREATE INDEX "GradeEvent_participantId_idx" ON "GradeEvent"("participantId");

-- CreateIndex
CREATE INDEX "GradeEvent_attemptId_idx" ON "GradeEvent"("attemptId");

-- CreateIndex
CREATE INDEX "GradeEvent_actorUserId_idx" ON "GradeEvent"("actorUserId");

-- CreateIndex
CREATE INDEX "GradeEvent_eventType_idx" ON "GradeEvent"("eventType");

-- CreateIndex
CREATE INDEX "GradeEvent_createdAt_idx" ON "GradeEvent"("createdAt");

-- AddForeignKey
ALTER TABLE "GradebookItem" ADD CONSTRAINT "GradebookItem_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GradebookItem" ADD CONSTRAINT "GradebookItem_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "CourseGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GradebookItem" ADD CONSTRAINT "GradebookItem_groupActivityId_fkey" FOREIGN KEY ("groupActivityId") REFERENCES "CourseGroupActivity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GradebookItem" ADD CONSTRAINT "GradebookItem_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityAttempt" ADD CONSTRAINT "ActivityAttempt_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityAttempt" ADD CONSTRAINT "ActivityAttempt_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "CourseGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityAttempt" ADD CONSTRAINT "ActivityAttempt_groupActivityId_fkey" FOREIGN KEY ("groupActivityId") REFERENCES "CourseGroupActivity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityAttempt" ADD CONSTRAINT "ActivityAttempt_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityAttempt" ADD CONSTRAINT "ActivityAttempt_gradebookItemId_fkey" FOREIGN KEY ("gradebookItemId") REFERENCES "GradebookItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityAttempt" ADD CONSTRAINT "ActivityAttempt_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "CourseGroupParticipant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityAttempt" ADD CONSTRAINT "ActivityAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityAttempt" ADD CONSTRAINT "ActivityAttempt_activityVersionId_fkey" FOREIGN KEY ("activityVersionId") REFERENCES "ActivityVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Grade" ADD CONSTRAINT "Grade_gradebookItemId_fkey" FOREIGN KEY ("gradebookItemId") REFERENCES "GradebookItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Grade" ADD CONSTRAINT "Grade_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "CourseGroupParticipant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Grade" ADD CONSTRAINT "Grade_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Grade" ADD CONSTRAINT "Grade_selectedAttemptId_fkey" FOREIGN KEY ("selectedAttemptId") REFERENCES "ActivityAttempt"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Grade" ADD CONSTRAINT "Grade_gradedByUserId_fkey" FOREIGN KEY ("gradedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GradeEvent" ADD CONSTRAINT "GradeEvent_gradeId_fkey" FOREIGN KEY ("gradeId") REFERENCES "Grade"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GradeEvent" ADD CONSTRAINT "GradeEvent_gradebookItemId_fkey" FOREIGN KEY ("gradebookItemId") REFERENCES "GradebookItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GradeEvent" ADD CONSTRAINT "GradeEvent_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "CourseGroupParticipant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GradeEvent" ADD CONSTRAINT "GradeEvent_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "ActivityAttempt"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GradeEvent" ADD CONSTRAINT "GradeEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
