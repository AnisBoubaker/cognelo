export const codingHomeworkGraderTables = [
  "PluginCodingHomeworkAssignment",
  "PluginBankCodingHomeworkAssignment",
  "PluginCodingHomeworkSubmissionRequirementSet",
  "PluginBankCodingHomeworkSubmissionRequirementSet",
  "PluginCodingHomeworkAttachment",
  "PluginCodingHomeworkDocumentationSnapshot",
  "PluginCodingHomeworkReferenceFunction",
  "PluginCodingHomeworkWorkspace",
  "PluginCodingHomeworkWorkspaceMember",
  "PluginCodingHomeworkWorkspaceEvent",
  "PluginCodingHomeworkSubmission",
  "PluginCodingHomeworkSubmissionFile",
  "PluginCodingHomeworkSubmissionFunction",
  "PluginCodingHomeworkChallengeQuestion",
  "PluginCodingHomeworkReview",
  "PluginCodingHomeworkDraft",
  "PluginCodingHomeworkTeacherSolution"
] as const;

export const codingHomeworkGraderDatabaseModule = {
  namespace: "plugin_coding_homework_grader",
  tables: codingHomeworkGraderTables,
  migrations: [
    {
      id: "202605280010_baseline",
      statements: [
        `DO $$ BEGIN
          CREATE TYPE "PluginCodingHomeworkAttachmentOwnerKind" AS ENUM ('course_activity', 'bank_activity', 'submission');
        EXCEPTION
          WHEN duplicate_object THEN null;
        END $$`,
        `DO $$ BEGIN
          CREATE TYPE "PluginCodingHomeworkAttachmentKind" AS ENUM ('assignment_pdf', 'requirements_upload', 'submission_zip', 'extracted_source', 'extracted_non_source');
        EXCEPTION
          WHEN duplicate_object THEN null;
        END $$`,
        `DO $$ BEGIN
          CREATE TYPE "PluginCodingHomeworkSnapshotStatus" AS ENUM ('pending', 'ready', 'failed');
        EXCEPTION
          WHEN duplicate_object THEN null;
        END $$`,
        `DO $$ BEGIN
          CREATE TYPE "PluginCodingHomeworkSubmissionKind" AS ENUM ('preflight', 'final');
        EXCEPTION
          WHEN duplicate_object THEN null;
        END $$`,
        `DO $$ BEGIN
          CREATE TYPE "PluginCodingHomeworkSubmissionStatus" AS ENUM ('uploaded', 'validating', 'invalid_structure', 'structure_valid', 'processing', 'challenge_ready', 'answered', 'ready_for_grading', 'graded', 'failed');
        EXCEPTION
          WHEN duplicate_object THEN null;
        END $$`,
        `CREATE TABLE IF NOT EXISTS "PluginCodingHomeworkAssignment" (
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
        )`,
        `CREATE TABLE IF NOT EXISTS "PluginBankCodingHomeworkAssignment" (
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
        )`,
        `CREATE TABLE IF NOT EXISTS "PluginCodingHomeworkSubmissionRequirementSet" (
          "id" TEXT NOT NULL,
          "activityId" TEXT NOT NULL,
          "languageKey" TEXT NOT NULL DEFAULT 'c',
          "requirements" JSONB NOT NULL DEFAULT '{}',
          "sourceAttachmentId" TEXT,
          "metadata" JSONB NOT NULL DEFAULT '{}',
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL,
          CONSTRAINT "PluginCodingHomeworkSubmissionRequirementSet_pkey" PRIMARY KEY ("id")
        )`,
        `CREATE TABLE IF NOT EXISTS "PluginBankCodingHomeworkSubmissionRequirementSet" (
          "id" TEXT NOT NULL,
          "bankActivityId" TEXT NOT NULL,
          "languageKey" TEXT NOT NULL DEFAULT 'c',
          "requirements" JSONB NOT NULL DEFAULT '{}',
          "sourceAttachmentId" TEXT,
          "metadata" JSONB NOT NULL DEFAULT '{}',
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL,
          CONSTRAINT "PluginBankCodingHomeworkSubmissionRequirementSet_pkey" PRIMARY KEY ("id")
        )`,
        `CREATE TABLE IF NOT EXISTS "PluginCodingHomeworkAttachment" (
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
        )`,
        `CREATE TABLE IF NOT EXISTS "PluginCodingHomeworkDocumentationSnapshot" (
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
        )`,
        `CREATE TABLE IF NOT EXISTS "PluginCodingHomeworkReferenceFunction" (
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
        )`,
        `CREATE TABLE IF NOT EXISTS "PluginCodingHomeworkSubmission" (
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
        )`,
        `CREATE TABLE IF NOT EXISTS "PluginCodingHomeworkSubmissionFile" (
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
        )`,
        `CREATE TABLE IF NOT EXISTS "PluginCodingHomeworkSubmissionFunction" (
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
        )`,
        `CREATE TABLE IF NOT EXISTS "PluginCodingHomeworkChallengeQuestion" (
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
        )`,
        `CREATE TABLE IF NOT EXISTS "PluginCodingHomeworkReview" (
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
        )`,
        `CREATE UNIQUE INDEX IF NOT EXISTS "PluginCodingHomeworkAssignment_activityId_key" ON "PluginCodingHomeworkAssignment"("activityId")`,
        `CREATE UNIQUE INDEX IF NOT EXISTS "PluginBankCodingHomeworkAssignment_bankActivityId_key" ON "PluginBankCodingHomeworkAssignment"("bankActivityId")`,
        `CREATE UNIQUE INDEX IF NOT EXISTS "PluginCodingHomeworkReqSet_activityId_key" ON "PluginCodingHomeworkSubmissionRequirementSet"("activityId")`,
        `CREATE UNIQUE INDEX IF NOT EXISTS "PluginBankCodingHomeworkReqSet_bankActivityId_key" ON "PluginBankCodingHomeworkSubmissionRequirementSet"("bankActivityId")`,
        `CREATE INDEX IF NOT EXISTS "PluginCodingHomeworkAttachment_owner_idx" ON "PluginCodingHomeworkAttachment"("ownerKind", "ownerId", "kind")`,
        `CREATE INDEX IF NOT EXISTS "PluginCodingHomeworkAttachment_sha256_idx" ON "PluginCodingHomeworkAttachment"("sha256")`,
        `CREATE INDEX IF NOT EXISTS "PluginCodingHomeworkSnapshot_activity_status_idx" ON "PluginCodingHomeworkDocumentationSnapshot"("activityId", "status", "createdAt")`,
        `CREATE INDEX IF NOT EXISTS "PluginCodingHomeworkSnapshot_course_group_idx" ON "PluginCodingHomeworkDocumentationSnapshot"("courseId", "groupId", "createdAt")`,
        `CREATE INDEX IF NOT EXISTS "PluginCodingHomeworkReferenceFunction_snapshot_idx" ON "PluginCodingHomeworkReferenceFunction"("snapshotId", "languageKey")`,
        `CREATE INDEX IF NOT EXISTS "PluginCodingHomeworkReferenceFunction_resource_idx" ON "PluginCodingHomeworkReferenceFunction"("contentResourceId")`,
        `CREATE INDEX IF NOT EXISTS "PluginCodingHomeworkReferenceFunction_name_idx" ON "PluginCodingHomeworkReferenceFunction"("functionName")`,
        `CREATE INDEX IF NOT EXISTS "PluginCodingHomeworkSubmission_activity_user_idx" ON "PluginCodingHomeworkSubmission"("activityId", "groupId", "userId", "createdAt")`,
        `CREATE INDEX IF NOT EXISTS "PluginCodingHomeworkSubmission_status_idx" ON "PluginCodingHomeworkSubmission"("activityId", "status", "createdAt")`,
        `CREATE INDEX IF NOT EXISTS "PluginCodingHomeworkSubmission_coreAttempt_idx" ON "PluginCodingHomeworkSubmission"("coreAttemptId")`,
        `CREATE UNIQUE INDEX IF NOT EXISTS "PluginCodingHomeworkSubmissionFile_submission_path_key" ON "PluginCodingHomeworkSubmissionFile"("submissionId", "path")`,
        `CREATE INDEX IF NOT EXISTS "PluginCodingHomeworkSubmissionFile_sha256_idx" ON "PluginCodingHomeworkSubmissionFile"("sha256")`,
        `CREATE INDEX IF NOT EXISTS "PluginCodingHomeworkSubmissionFunction_selected_idx" ON "PluginCodingHomeworkSubmissionFunction"("submissionId", "selectedForQuestion")`,
        `CREATE INDEX IF NOT EXISTS "PluginCodingHomeworkSubmissionFunction_file_idx" ON "PluginCodingHomeworkSubmissionFunction"("fileId", "functionName")`,
        `CREATE UNIQUE INDEX IF NOT EXISTS "PluginCodingHomeworkQuestion_submission_order_key" ON "PluginCodingHomeworkChallengeQuestion"("submissionId", "orderIndex")`,
        `CREATE INDEX IF NOT EXISTS "PluginCodingHomeworkQuestion_function_idx" ON "PluginCodingHomeworkChallengeQuestion"("submissionFunctionId")`,
        `CREATE INDEX IF NOT EXISTS "PluginCodingHomeworkReview_submission_idx" ON "PluginCodingHomeworkReview"("submissionId")`,
        `CREATE INDEX IF NOT EXISTS "PluginCodingHomeworkReview_reviewer_idx" ON "PluginCodingHomeworkReview"("reviewerUserId", "createdAt")`,
        `DO $$ BEGIN
          ALTER TABLE "PluginCodingHomeworkReferenceFunction"
          ADD CONSTRAINT "PluginCodingHomeworkReferenceFunction_snapshotId_fkey"
          FOREIGN KEY ("snapshotId") REFERENCES "PluginCodingHomeworkDocumentationSnapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE;
        EXCEPTION
          WHEN duplicate_object THEN null;
        END $$`,
        `DO $$ BEGIN
          ALTER TABLE "PluginCodingHomeworkSubmission"
          ADD CONSTRAINT "PluginCodingHomeworkSubmission_snapshotId_fkey"
          FOREIGN KEY ("documentationSnapshotId") REFERENCES "PluginCodingHomeworkDocumentationSnapshot"("id") ON DELETE SET NULL ON UPDATE CASCADE;
        EXCEPTION
          WHEN duplicate_object THEN null;
        END $$`,
        `DO $$ BEGIN
          ALTER TABLE "PluginCodingHomeworkSubmissionFile"
          ADD CONSTRAINT "PluginCodingHomeworkSubmissionFile_submissionId_fkey"
          FOREIGN KEY ("submissionId") REFERENCES "PluginCodingHomeworkSubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
        EXCEPTION
          WHEN duplicate_object THEN null;
        END $$`,
        `DO $$ BEGIN
          ALTER TABLE "PluginCodingHomeworkSubmissionFunction"
          ADD CONSTRAINT "PluginCodingHomeworkSubmissionFunction_submissionId_fkey"
          FOREIGN KEY ("submissionId") REFERENCES "PluginCodingHomeworkSubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
        EXCEPTION
          WHEN duplicate_object THEN null;
        END $$`,
        `DO $$ BEGIN
          ALTER TABLE "PluginCodingHomeworkSubmissionFunction"
          ADD CONSTRAINT "PluginCodingHomeworkSubmissionFunction_fileId_fkey"
          FOREIGN KEY ("fileId") REFERENCES "PluginCodingHomeworkSubmissionFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
        EXCEPTION
          WHEN duplicate_object THEN null;
        END $$`,
        `DO $$ BEGIN
          ALTER TABLE "PluginCodingHomeworkChallengeQuestion"
          ADD CONSTRAINT "PluginCodingHomeworkChallengeQuestion_submissionId_fkey"
          FOREIGN KEY ("submissionId") REFERENCES "PluginCodingHomeworkSubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
        EXCEPTION
          WHEN duplicate_object THEN null;
        END $$`,
        `DO $$ BEGIN
          ALTER TABLE "PluginCodingHomeworkChallengeQuestion"
          ADD CONSTRAINT "PluginCodingHomeworkQuestion_submissionFunctionId_fkey"
          FOREIGN KEY ("submissionFunctionId") REFERENCES "PluginCodingHomeworkSubmissionFunction"("id") ON DELETE SET NULL ON UPDATE CASCADE;
        EXCEPTION
          WHEN duplicate_object THEN null;
        END $$`,
        `DO $$ BEGIN
          ALTER TABLE "PluginCodingHomeworkReview"
          ADD CONSTRAINT "PluginCodingHomeworkReview_submissionId_fkey"
          FOREIGN KEY ("submissionId") REFERENCES "PluginCodingHomeworkSubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
        EXCEPTION
          WHEN duplicate_object THEN null;
        END $$`
      ]
    },
    {
      id: "202607140010_provided_activity_files",
      statements: [
        `ALTER TYPE "PluginCodingHomeworkAttachmentKind" ADD VALUE IF NOT EXISTS 'provided_file'`
      ]
    },
    {
      id: "202610250010_bounded_upload_requirements",
      statements: [
        `UPDATE "PluginCodingHomeworkSubmissionRequirementSet" SET requirements = jsonb_set(
  jsonb_set(requirements, '{maxArchiveBytes}', to_jsonb(LEAST(COALESCE((requirements->>'maxArchiveBytes')::bigint, 26214400), 26214400))),
  '{maxFileCount}', to_jsonb(LEAST(COALESCE((requirements->>'maxFileCount')::int, 200), 1000))), "updatedAt" = NOW()
WHERE (requirements->>'maxArchiveBytes')::bigint > 26214400 OR (requirements->>'maxFileCount')::int > 1000`,
        `UPDATE "PluginBankCodingHomeworkSubmissionRequirementSet" SET requirements = jsonb_set(
  jsonb_set(requirements, '{maxArchiveBytes}', to_jsonb(LEAST(COALESCE((requirements->>'maxArchiveBytes')::bigint, 26214400), 26214400))),
  '{maxFileCount}', to_jsonb(LEAST(COALESCE((requirements->>'maxFileCount')::int, 200), 1000))), "updatedAt" = NOW()
WHERE (requirements->>'maxArchiveBytes')::bigint > 26214400 OR (requirements->>'maxFileCount')::int > 1000`
      ]
    }
,
    {
      id: "202611010010_homework_preparation",
      statements: [
        `ALTER TYPE "PluginCodingHomeworkSubmissionStatus" ADD VALUE IF NOT EXISTS 'cancelled'`,
        `CREATE TABLE IF NOT EXISTS "PluginCodingHomeworkDraft" (
          id TEXT PRIMARY KEY, "activityId" TEXT NOT NULL REFERENCES "Activity"(id) ON DELETE CASCADE,
          "groupId" TEXT NOT NULL REFERENCES "CourseGroup"(id) ON DELETE CASCADE,
          "userId" TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
          revision INTEGER NOT NULL DEFAULT 0, files JSONB NOT NULL DEFAULT '[]', folders JSONB NOT NULL DEFAULT '[]',
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
        `CREATE UNIQUE INDEX IF NOT EXISTS "PluginCodingHomeworkDraft_activityId_groupId_userId_key" ON "PluginCodingHomeworkDraft"("activityId", "groupId", "userId")`,
        `CREATE TABLE IF NOT EXISTS "PluginCodingHomeworkTeacherSolution" (
          id TEXT PRIMARY KEY, "ownerKind" TEXT NOT NULL, "ownerId" TEXT NOT NULL,
          files JSONB NOT NULL DEFAULT '[]', functions JSONB NOT NULL DEFAULT '[]',
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
        `CREATE UNIQUE INDEX IF NOT EXISTS "PluginCodingHomeworkTeacherSolution_ownerKind_ownerId_key" ON "PluginCodingHomeworkTeacherSolution"("ownerKind", "ownerId")`
      ]
    }
    ,{
      id: "202611050010_team_workspaces",
      statements: [
        `ALTER TYPE "PluginCodingHomeworkSubmissionKind" ADD VALUE IF NOT EXISTS 'team_source'`,
        `CREATE TABLE IF NOT EXISTS "PluginCodingHomeworkWorkspace" (
          id TEXT PRIMARY KEY, "courseId" TEXT NOT NULL REFERENCES "Course"(id) ON DELETE CASCADE,
          "activityId" TEXT NOT NULL REFERENCES "Activity"(id) ON DELETE CASCADE, "groupId" TEXT NOT NULL REFERENCES "CourseGroup"(id) ON DELETE CASCADE,
          "groupingId" TEXT NOT NULL, "teamId" TEXT, "ownerParticipantId" TEXT, "ownerKey" TEXT NOT NULL,
          revision INTEGER NOT NULL DEFAULT 0, files JSONB NOT NULL DEFAULT '[]', folders JSONB NOT NULL DEFAULT '[]', "currentSubmissionId" TEXT,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
        `CREATE UNIQUE INDEX IF NOT EXISTS "PluginCodingHomeworkWorkspace_activityId_groupId_ownerKey_key" ON "PluginCodingHomeworkWorkspace"("activityId", "groupId", "ownerKey")`,
        `CREATE INDEX IF NOT EXISTS "PluginCodingHomeworkWorkspace_activity_group_grouping_team_idx" ON "PluginCodingHomeworkWorkspace"("activityId", "groupId", "groupingId", "teamId")`,
        `CREATE TABLE IF NOT EXISTS "PluginCodingHomeworkWorkspaceMember" (
          id TEXT PRIMARY KEY, "workspaceId" TEXT NOT NULL REFERENCES "PluginCodingHomeworkWorkspace"(id) ON DELETE CASCADE,
          "activityId" TEXT NOT NULL REFERENCES "Activity"(id) ON DELETE CASCADE, "groupId" TEXT NOT NULL REFERENCES "CourseGroup"(id) ON DELETE CASCADE,
          "participantId" TEXT NOT NULL, "userId" TEXT, "currentSubmissionId" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
        `CREATE UNIQUE INDEX IF NOT EXISTS "PluginCodingHomeworkWorkspaceMember_activity_group_participant_" ON "PluginCodingHomeworkWorkspaceMember"("activityId", "groupId", "participantId")`,
        `ALTER TABLE "PluginCodingHomeworkWorkspaceMember" ADD COLUMN IF NOT EXISTS "membershipToken" TEXT NOT NULL DEFAULT 'initial'`,
        `CREATE INDEX IF NOT EXISTS "PluginCodingHomeworkWorkspaceMember_workspace_idx" ON "PluginCodingHomeworkWorkspaceMember"("workspaceId")`,
        `CREATE TABLE IF NOT EXISTS "PluginCodingHomeworkWorkspaceEvent" (
          id TEXT PRIMARY KEY, "courseId" TEXT NOT NULL REFERENCES "Course"(id) ON DELETE CASCADE, "activityId" TEXT NOT NULL REFERENCES "Activity"(id) ON DELETE CASCADE,
          "groupId" TEXT NOT NULL, "workspaceId" TEXT REFERENCES "PluginCodingHomeworkWorkspace"(id) ON DELETE SET NULL, "teamId" TEXT,
          "actorUserId" TEXT, "actorName" TEXT NOT NULL, operation TEXT NOT NULL, "filePath" TEXT, "previousHash" TEXT, "nextHash" TEXT,
          metadata JSONB NOT NULL DEFAULT '{}', "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
        `CREATE INDEX IF NOT EXISTS "PluginCodingHomeworkWorkspaceEvent_activity_group_created_idx" ON "PluginCodingHomeworkWorkspaceEvent"("activityId", "groupId", "createdAt")`,
        `CREATE INDEX IF NOT EXISTS "PluginCodingHomeworkWorkspaceEvent_workspace_created_idx" ON "PluginCodingHomeworkWorkspaceEvent"("workspaceId", "createdAt")`,
        `ALTER TABLE "PluginCodingHomeworkSubmission" ADD COLUMN IF NOT EXISTS "workspaceId" TEXT REFERENCES "PluginCodingHomeworkWorkspace"(id) ON DELETE CASCADE`,
        `ALTER TABLE "PluginCodingHomeworkSubmission" ADD COLUMN IF NOT EXISTS "workspaceMemberId" TEXT REFERENCES "PluginCodingHomeworkWorkspaceMember"(id) ON DELETE SET NULL`,
        `ALTER TABLE "PluginCodingHomeworkSubmission" ADD COLUMN IF NOT EXISTS "sharedSourceId" TEXT`,
        `CREATE INDEX IF NOT EXISTS "PluginCodingHomeworkSubmission_workspace_kind_created_idx" ON "PluginCodingHomeworkSubmission"("workspaceId", kind, "createdAt")`,
        `CREATE INDEX IF NOT EXISTS "PluginCodingHomeworkSubmission_member_kind_created_idx" ON "PluginCodingHomeworkSubmission"("workspaceMemberId", kind, "createdAt")`,
        `CREATE INDEX IF NOT EXISTS "PluginCodingHomeworkSubmission_shared_source_idx" ON "PluginCodingHomeworkSubmission"("sharedSourceId")`
      ]
    }
    ,{
      id: "202611080010_programming_homework_display_name",
      statements: [
        `UPDATE "ActivityType" SET name='Programming Homework' WHERE key='coding-homework-grader' AND name IS DISTINCT FROM 'Programming Homework'`,
        `UPDATE "ActivityPluginInstallation" SET name='Programming Homework' WHERE key='coding-homework-grader' AND name IS DISTINCT FROM 'Programming Homework'`
      ]
    }
,{
      id: "202611090020_submission_stage_clocks", statements: [
        `ALTER TABLE "PluginCodingHomeworkDraft" ADD COLUMN IF NOT EXISTS "preparationStartedAt" TIMESTAMP(3)`,
        `ALTER TABLE "PluginCodingHomeworkWorkspace" ADD COLUMN IF NOT EXISTS "preparationStartedAt" TIMESTAMP(3)`,
        `UPDATE "PluginCodingHomeworkDraft" d SET "preparationStartedAt"=d."createdAt" FROM "Activity" a WHERE a.id=d."activityId" AND d."preparationStartedAt" IS NULL AND jsonb_array_length(d.files)>0 AND NOT (COALESCE(a.metadata #> '{allGroupsAssignment,submissionStages,files}','{}'::jsonb) ? 'enabled')`,
        `UPDATE "PluginCodingHomeworkWorkspace" w SET "preparationStartedAt"=COALESCE((SELECT MIN(e."createdAt") FROM "PluginCodingHomeworkWorkspaceEvent" e WHERE e."workspaceId"=w.id AND e.operation IN ('file_added','file_replaced','zip_replaced')),w."updatedAt") FROM "Activity" a WHERE a.id=w."activityId" AND w."preparationStartedAt" IS NULL AND jsonb_array_length(w.files)>0 AND NOT (COALESCE(a.metadata #> '{allGroupsAssignment,submissionStages,files}','{}'::jsonb) ? 'enabled')`
      ]
    }
  ],
  notes: [
    "Programming Homework owns assignment prompts, uploaded artifacts, documentation snapshots, extracted reference functions, submissions, challenge questions, and teacher review records in plugin tables.",
    "Core gradebook tables only store generic attempt and grade metadata; plugin-specific submission files, generated questions, answers, and review payloads stay in this namespace.",
    "C is the first planned parser target, but language keys and JSON requirement payloads keep the schema open for later language adapters."
  ]
} as const;
