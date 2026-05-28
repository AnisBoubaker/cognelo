CREATE TYPE "PluginCodingHomeworkAttachmentOwnerKind" AS ENUM ('course_activity', 'bank_activity', 'submission');
CREATE TYPE "PluginCodingHomeworkAttachmentKind" AS ENUM ('assignment_pdf', 'requirements_upload', 'submission_zip', 'extracted_source', 'extracted_non_source');
CREATE TYPE "PluginCodingHomeworkSnapshotStatus" AS ENUM ('pending', 'ready', 'failed');
CREATE TYPE "PluginCodingHomeworkSubmissionKind" AS ENUM ('preflight', 'final');
CREATE TYPE "PluginCodingHomeworkSubmissionStatus" AS ENUM ('uploaded', 'validating', 'invalid_structure', 'structure_valid', 'processing', 'challenge_ready', 'answered', 'ready_for_grading', 'graded', 'failed');

CREATE TABLE "PluginCodingHomeworkAssignment" (
  "id" TEXT NOT NULL,
  "activityId" TEXT NOT NULL,
  "promptMarkdown" TEXT NOT NULL DEFAULT '',
  "promptPdfAttachmentId" TEXT,
  "languageKey" TEXT NOT NULL DEFAULT 'c',
  "candidateLimit" INTEGER NOT NULL DEFAULT 5,
  "retrievedExampleCount" INTEGER NOT NULL DEFAULT 3,
  "questionCount" INTEGER NOT NULL DEFAULT 3,
  "generationInstructions" TEXT NOT NULL DEFAULT '',
  "settings" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PluginCodingHomeworkAssignment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PluginBankCodingHomeworkAssignment" (
  "id" TEXT NOT NULL,
  "bankActivityId" TEXT NOT NULL,
  "promptMarkdown" TEXT NOT NULL DEFAULT '',
  "promptPdfAttachmentId" TEXT,
  "languageKey" TEXT NOT NULL DEFAULT 'c',
  "candidateLimit" INTEGER NOT NULL DEFAULT 5,
  "retrievedExampleCount" INTEGER NOT NULL DEFAULT 3,
  "questionCount" INTEGER NOT NULL DEFAULT 3,
  "generationInstructions" TEXT NOT NULL DEFAULT '',
  "settings" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PluginBankCodingHomeworkAssignment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PluginCodingHomeworkSubmissionRequirementSet" (
  "id" TEXT NOT NULL,
  "activityId" TEXT NOT NULL,
  "languageKey" TEXT NOT NULL DEFAULT 'c',
  "requirements" JSONB NOT NULL DEFAULT '{}',
  "sourceAttachmentId" TEXT,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PluginCodingHomeworkSubmissionRequirementSet_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PluginBankCodingHomeworkSubmissionRequirementSet" (
  "id" TEXT NOT NULL,
  "bankActivityId" TEXT NOT NULL,
  "languageKey" TEXT NOT NULL DEFAULT 'c',
  "requirements" JSONB NOT NULL DEFAULT '{}',
  "sourceAttachmentId" TEXT,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PluginBankCodingHomeworkSubmissionRequirementSet_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PluginCodingHomeworkAttachment" (
  "id" TEXT NOT NULL,
  "ownerKind" "PluginCodingHomeworkAttachmentOwnerKind" NOT NULL,
  "ownerId" TEXT NOT NULL,
  "kind" "PluginCodingHomeworkAttachmentKind" NOT NULL,
  "originalName" TEXT NOT NULL,
  "storedName" TEXT NOT NULL,
  "mimeType" TEXT,
  "sizeBytes" BIGINT NOT NULL,
  "sha256" TEXT NOT NULL,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PluginCodingHomeworkAttachment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PluginCodingHomeworkDocumentationSnapshot" (
  "id" TEXT NOT NULL,
  "activityId" TEXT NOT NULL,
  "courseId" TEXT NOT NULL,
  "groupId" TEXT,
  "contentTreeAnchorItemId" TEXT,
  "contentTreeFingerprint" TEXT NOT NULL DEFAULT '',
  "status" "PluginCodingHomeworkSnapshotStatus" NOT NULL DEFAULT 'pending',
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PluginCodingHomeworkDocumentationSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PluginCodingHomeworkReferenceFunction" (
  "id" TEXT NOT NULL,
  "snapshotId" TEXT NOT NULL,
  "contentResourceId" TEXT,
  "sourceTitle" TEXT NOT NULL,
  "sourceKind" TEXT NOT NULL,
  "languageKey" TEXT NOT NULL,
  "functionName" TEXT NOT NULL,
  "functionCode" TEXT NOT NULL,
  "astText" TEXT NOT NULL,
  "embedding" JSONB NOT NULL DEFAULT '[]',
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PluginCodingHomeworkReferenceFunction_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PluginCodingHomeworkSubmission" (
  "id" TEXT NOT NULL,
  "activityId" TEXT NOT NULL,
  "groupId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "coreAttemptId" TEXT,
  "documentationSnapshotId" TEXT,
  "zipAttachmentId" TEXT,
  "kind" "PluginCodingHomeworkSubmissionKind" NOT NULL DEFAULT 'final',
  "status" "PluginCodingHomeworkSubmissionStatus" NOT NULL DEFAULT 'uploaded',
  "structureValidationSummary" JSONB NOT NULL DEFAULT '{}',
  "processingError" TEXT,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PluginCodingHomeworkSubmission_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PluginCodingHomeworkSubmissionFile" (
  "id" TEXT NOT NULL,
  "submissionId" TEXT NOT NULL,
  "path" TEXT NOT NULL,
  "languageKey" TEXT,
  "sizeBytes" BIGINT NOT NULL,
  "sha256" TEXT NOT NULL,
  "storedName" TEXT NOT NULL,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PluginCodingHomeworkSubmissionFile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PluginCodingHomeworkSubmissionFunction" (
  "id" TEXT NOT NULL,
  "submissionId" TEXT NOT NULL,
  "fileId" TEXT NOT NULL,
  "functionName" TEXT NOT NULL,
  "functionCode" TEXT NOT NULL,
  "astText" TEXT NOT NULL,
  "embedding" JSONB NOT NULL DEFAULT '[]',
  "nearestExamples" JSONB NOT NULL DEFAULT '[]',
  "divergenceScore" DOUBLE PRECISION,
  "selectedForQuestion" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PluginCodingHomeworkSubmissionFunction_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PluginCodingHomeworkChallengeQuestion" (
  "id" TEXT NOT NULL,
  "submissionId" TEXT NOT NULL,
  "submissionFunctionId" TEXT,
  "orderIndex" INTEGER NOT NULL,
  "questionText" TEXT NOT NULL,
  "studentAnswer" TEXT,
  "answerSubmittedAt" TIMESTAMP(3),
  "generationModel" TEXT NOT NULL,
  "generationPromptVersion" TEXT NOT NULL,
  "nearestExamples" JSONB NOT NULL DEFAULT '[]',
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PluginCodingHomeworkChallengeQuestion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PluginCodingHomeworkReview" (
  "id" TEXT NOT NULL,
  "submissionId" TEXT NOT NULL,
  "reviewerUserId" TEXT NOT NULL,
  "score" DOUBLE PRECISION,
  "maxScore" DOUBLE PRECISION,
  "feedback" TEXT NOT NULL DEFAULT '',
  "rubric" JSONB NOT NULL DEFAULT '{}',
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PluginCodingHomeworkReview_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PluginCodingHomeworkAssignment_activityId_key" ON "PluginCodingHomeworkAssignment"("activityId");
CREATE UNIQUE INDEX "PluginBankCodingHomeworkAssignment_bankActivityId_key" ON "PluginBankCodingHomeworkAssignment"("bankActivityId");
CREATE UNIQUE INDEX "PluginCodingHomeworkReqSet_activityId_key" ON "PluginCodingHomeworkSubmissionRequirementSet"("activityId");
CREATE UNIQUE INDEX "PluginBankCodingHomeworkReqSet_bankActivityId_key" ON "PluginBankCodingHomeworkSubmissionRequirementSet"("bankActivityId");
CREATE INDEX "PluginCodingHomeworkAttachment_owner_idx" ON "PluginCodingHomeworkAttachment"("ownerKind", "ownerId", "kind");
CREATE INDEX "PluginCodingHomeworkAttachment_sha256_idx" ON "PluginCodingHomeworkAttachment"("sha256");
CREATE INDEX "PluginCodingHomeworkSnapshot_activity_status_idx" ON "PluginCodingHomeworkDocumentationSnapshot"("activityId", "status", "createdAt");
CREATE INDEX "PluginCodingHomeworkSnapshot_course_group_idx" ON "PluginCodingHomeworkDocumentationSnapshot"("courseId", "groupId", "createdAt");
CREATE INDEX "PluginCodingHomeworkReferenceFunction_snapshot_idx" ON "PluginCodingHomeworkReferenceFunction"("snapshotId", "languageKey");
CREATE INDEX "PluginCodingHomeworkReferenceFunction_resource_idx" ON "PluginCodingHomeworkReferenceFunction"("contentResourceId");
CREATE INDEX "PluginCodingHomeworkReferenceFunction_name_idx" ON "PluginCodingHomeworkReferenceFunction"("functionName");
CREATE INDEX "PluginCodingHomeworkSubmission_activity_user_idx" ON "PluginCodingHomeworkSubmission"("activityId", "groupId", "userId", "createdAt");
CREATE INDEX "PluginCodingHomeworkSubmission_status_idx" ON "PluginCodingHomeworkSubmission"("activityId", "status", "createdAt");
CREATE INDEX "PluginCodingHomeworkSubmission_coreAttempt_idx" ON "PluginCodingHomeworkSubmission"("coreAttemptId");
CREATE UNIQUE INDEX "PluginCodingHomeworkSubmissionFile_submission_path_key" ON "PluginCodingHomeworkSubmissionFile"("submissionId", "path");
CREATE INDEX "PluginCodingHomeworkSubmissionFile_sha256_idx" ON "PluginCodingHomeworkSubmissionFile"("sha256");
CREATE INDEX "PluginCodingHomeworkSubmissionFunction_selected_idx" ON "PluginCodingHomeworkSubmissionFunction"("submissionId", "selectedForQuestion");
CREATE INDEX "PluginCodingHomeworkSubmissionFunction_file_idx" ON "PluginCodingHomeworkSubmissionFunction"("fileId", "functionName");
CREATE UNIQUE INDEX "PluginCodingHomeworkQuestion_submission_order_key" ON "PluginCodingHomeworkChallengeQuestion"("submissionId", "orderIndex");
CREATE INDEX "PluginCodingHomeworkQuestion_function_idx" ON "PluginCodingHomeworkChallengeQuestion"("submissionFunctionId");
CREATE INDEX "PluginCodingHomeworkReview_submission_idx" ON "PluginCodingHomeworkReview"("submissionId");
CREATE INDEX "PluginCodingHomeworkReview_reviewer_idx" ON "PluginCodingHomeworkReview"("reviewerUserId", "createdAt");

ALTER TABLE "PluginCodingHomeworkReferenceFunction"
  ADD CONSTRAINT "PluginCodingHomeworkReferenceFunction_snapshotId_fkey"
  FOREIGN KEY ("snapshotId") REFERENCES "PluginCodingHomeworkDocumentationSnapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PluginCodingHomeworkSubmission"
  ADD CONSTRAINT "PluginCodingHomeworkSubmission_snapshotId_fkey"
  FOREIGN KEY ("documentationSnapshotId") REFERENCES "PluginCodingHomeworkDocumentationSnapshot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PluginCodingHomeworkSubmissionFile"
  ADD CONSTRAINT "PluginCodingHomeworkSubmissionFile_submissionId_fkey"
  FOREIGN KEY ("submissionId") REFERENCES "PluginCodingHomeworkSubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PluginCodingHomeworkSubmissionFunction"
  ADD CONSTRAINT "PluginCodingHomeworkSubmissionFunction_submissionId_fkey"
  FOREIGN KEY ("submissionId") REFERENCES "PluginCodingHomeworkSubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PluginCodingHomeworkSubmissionFunction"
  ADD CONSTRAINT "PluginCodingHomeworkSubmissionFunction_fileId_fkey"
  FOREIGN KEY ("fileId") REFERENCES "PluginCodingHomeworkSubmissionFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PluginCodingHomeworkChallengeQuestion"
  ADD CONSTRAINT "PluginCodingHomeworkChallengeQuestion_submissionId_fkey"
  FOREIGN KEY ("submissionId") REFERENCES "PluginCodingHomeworkSubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PluginCodingHomeworkChallengeQuestion"
  ADD CONSTRAINT "PluginCodingHomeworkQuestion_submissionFunctionId_fkey"
  FOREIGN KEY ("submissionFunctionId") REFERENCES "PluginCodingHomeworkSubmissionFunction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PluginCodingHomeworkReview"
  ADD CONSTRAINT "PluginCodingHomeworkReview_submissionId_fkey"
  FOREIGN KEY ("submissionId") REFERENCES "PluginCodingHomeworkSubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
