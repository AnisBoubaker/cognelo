ALTER TYPE "GradeEventType" ADD VALUE IF NOT EXISTS 'ai_feedback_recorded';

CREATE TABLE "AiFeedbackResearchEvent" (
  "id" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "courseId" TEXT NOT NULL,
  "groupId" TEXT,
  "activityId" TEXT NOT NULL,
  "groupActivityId" TEXT,
  "gradebookItemId" TEXT,
  "participantId" TEXT,
  "userId" TEXT,
  "attemptId" TEXT,
  "actorUserId" TEXT,
  "pluginKey" TEXT NOT NULL,
  "feedbackRef" TEXT,
  "feedbackVersion" INTEGER,
  "assessmentMode" TEXT NOT NULL,
  "triggerKind" TEXT NOT NULL,
  "provider" TEXT,
  "model" TEXT,
  "rubricVersion" TEXT,
  "promptVersion" TEXT,
  "schemaVersion" TEXT,
  "submissionHash" TEXT,
  "feedbackHash" TEXT,
  "aiContribution" DOUBLE PRECISION,
  "outcome" TEXT,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AiFeedbackResearchEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GradeChallenge" (
  "id" TEXT NOT NULL,
  "courseId" TEXT NOT NULL,
  "groupId" TEXT NOT NULL,
  "activityId" TEXT NOT NULL,
  "groupActivityId" TEXT,
  "gradebookItemId" TEXT NOT NULL,
  "participantId" TEXT NOT NULL,
  "userId" TEXT,
  "attemptId" TEXT NOT NULL,
  "gradeId" TEXT,
  "gradeEventId" TEXT,
  "pluginKey" TEXT NOT NULL,
  "feedbackRef" TEXT NOT NULL,
  "feedbackVersion" INTEGER NOT NULL,
  "feedbackHash" TEXT,
  "releasedGradeSnapshot" JSONB NOT NULL,
  "explanation" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'open',
  "teacherResponse" TEXT,
  "resolvedByUserId" TEXT,
  "resolvedAt" TIMESTAMP(3),
  "resultingGradeSnapshot" JSONB,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "GradeChallenge_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AiFeedbackResearchEvent_courseId_createdAt_idx" ON "AiFeedbackResearchEvent"("courseId", "createdAt");
CREATE INDEX "AiFeedbackResearchEvent_activityId_createdAt_idx" ON "AiFeedbackResearchEvent"("activityId", "createdAt");
CREATE INDEX "AiFeedbackResearchEvent_attemptId_createdAt_idx" ON "AiFeedbackResearchEvent"("attemptId", "createdAt");
CREATE INDEX "AiFeedbackResearchEvent_participantId_createdAt_idx" ON "AiFeedbackResearchEvent"("participantId", "createdAt");
CREATE INDEX "AiFeedbackResearchEvent_feedbackRef_feedbackVersion_idx" ON "AiFeedbackResearchEvent"("feedbackRef", "feedbackVersion");
CREATE INDEX "AiFeedbackResearchEvent_eventType_createdAt_idx" ON "AiFeedbackResearchEvent"("eventType", "createdAt");

CREATE UNIQUE INDEX "GradeChallenge_feedbackRef_feedbackVersion_participantId_key" ON "GradeChallenge"("feedbackRef", "feedbackVersion", "participantId");
CREATE INDEX "GradeChallenge_courseId_status_createdAt_idx" ON "GradeChallenge"("courseId", "status", "createdAt");
CREATE INDEX "GradeChallenge_activityId_createdAt_idx" ON "GradeChallenge"("activityId", "createdAt");
CREATE INDEX "GradeChallenge_attemptId_idx" ON "GradeChallenge"("attemptId");
CREATE INDEX "GradeChallenge_participantId_createdAt_idx" ON "GradeChallenge"("participantId", "createdAt");
CREATE INDEX "GradeChallenge_resolvedByUserId_idx" ON "GradeChallenge"("resolvedByUserId");

CREATE TABLE "PluginMcqAiEvaluation" (
  "id" TEXT NOT NULL,
  "activityId" TEXT NOT NULL,
  "coreAttemptId" TEXT,
  "courseId" TEXT NOT NULL,
  "groupId" TEXT NOT NULL,
  "participantId" TEXT,
  "userId" TEXT NOT NULL,
  "createdByUserId" TEXT NOT NULL,
  "assessmentMode" TEXT NOT NULL,
  "triggerKind" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "promptVersion" TEXT NOT NULL,
  "schemaVersion" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "model" TEXT NOT NULL,
  "connectionId" TEXT NOT NULL,
  "requestPayload" JSONB NOT NULL,
  "rawResponse" TEXT,
  "parsedResponse" JSONB,
  "sanitizedFeedback" JSONB,
  "submissionHash" TEXT NOT NULL,
  "feedbackHash" TEXT,
  "latencyMs" INTEGER,
  "error" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PluginMcqAiEvaluation_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PluginMcqAiEvaluation_activityId_coreAttemptId_version_key" ON "PluginMcqAiEvaluation"("activityId", "coreAttemptId", "version");
CREATE INDEX "PluginMcqAiEvaluation_activityId_createdAt_idx" ON "PluginMcqAiEvaluation"("activityId", "createdAt");
CREATE INDEX "PluginMcqAiEvaluation_coreAttemptId_createdAt_idx" ON "PluginMcqAiEvaluation"("coreAttemptId", "createdAt");
CREATE INDEX "PluginMcqAiEvaluation_courseId_createdAt_idx" ON "PluginMcqAiEvaluation"("courseId", "createdAt");
CREATE INDEX "PluginMcqAiEvaluation_participantId_createdAt_idx" ON "PluginMcqAiEvaluation"("participantId", "createdAt");
