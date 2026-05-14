-- CreateEnum
CREATE TYPE "CourseStatus" AS ENUM ('draft', 'published', 'archived');

-- CreateEnum
CREATE TYPE "CourseMembershipRole" AS ENUM ('owner', 'teacher', 'ta', 'student');

-- CreateEnum
CREATE TYPE "MaterialKind" AS ENUM ('folder', 'text', 'markdown', 'pdf', 'link', 'github_repo', 'code_example', 'dataset', 'file', 'module');

-- CreateEnum
CREATE TYPE "ActivityLifecycle" AS ENUM ('draft', 'published', 'paused', 'archived');

-- CreateEnum
CREATE TYPE "CourseGroupStatus" AS ENUM ('draft', 'published');

-- CreateEnum
CREATE TYPE "CourseGroupParticipantRole" AS ENUM ('teacher', 'ta', 'student');

-- CreateEnum
CREATE TYPE "AiAgentProvider" AS ENUM ('ollama', 'openai', 'codex', 'claude');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "firstName" TEXT,
    "lastName" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "passwordHash" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiAgentConnection" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT,
    "provider" "AiAgentProvider" NOT NULL,
    "displayName" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "baseUrl" TEXT,
    "apiKey" TEXT,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiAgentConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Role" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserRole" (
    "userId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserRole_pkey" PRIMARY KEY ("userId","roleId")
);

-- CreateTable
CREATE TABLE "Course" (
    "id" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "status" "CourseStatus" NOT NULL DEFAULT 'draft',
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Course_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subject" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubjectMaterial" (
    "id" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "parentId" TEXT,
    "title" TEXT NOT NULL,
    "kind" "MaterialKind" NOT NULL,
    "body" TEXT,
    "url" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubjectMaterial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityBank" (
    "id" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "ownerId" TEXT NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ActivityBank_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourseMembership" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "CourseMembershipRole" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CourseMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourseMaterial" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "parentId" TEXT,
    "title" TEXT NOT NULL,
    "kind" "MaterialKind" NOT NULL,
    "body" TEXT,
    "url" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CourseMaterial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourseGroup" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "status" "CourseGroupStatus" NOT NULL DEFAULT 'draft',
    "availableFrom" TIMESTAMP(3),
    "availableUntil" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CourseGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourseGroupParticipant" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "userId" TEXT,
    "role" "CourseGroupParticipantRole" NOT NULL DEFAULT 'student',
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "externalId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CourseGroupParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourseGroupMaterial" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "parentId" TEXT,
    "title" TEXT NOT NULL,
    "kind" "MaterialKind" NOT NULL,
    "body" TEXT,
    "url" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CourseGroupMaterial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourseGroupActivity" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "availableFrom" TIMESTAMP(3),
    "availableUntil" TIMESTAMP(3),
    "config" JSONB NOT NULL DEFAULT '{}',
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CourseGroupActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourseGroupHiddenCourseMaterial" (
    "groupId" TEXT NOT NULL,
    "courseMaterialId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CourseGroupHiddenCourseMaterial_pkey" PRIMARY KEY ("groupId","courseMaterialId")
);

-- CreateTable
CREATE TABLE "ActivityType" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "version" TEXT NOT NULL DEFAULT '0.1.0',
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ActivityType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityPluginInstallation" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "packageName" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "version" TEXT NOT NULL DEFAULT '0.1.0',
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "isActivated" BOOLEAN NOT NULL DEFAULT false,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "activatedAt" TIMESTAMP(3),
    "deactivatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ActivityPluginInstallation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityPluginTableBackup" (
    "id" TEXT NOT NULL,
    "pluginKey" TEXT NOT NULL,
    "pluginVersion" TEXT NOT NULL,
    "sourceTables" JSONB NOT NULL DEFAULT '[]',
    "backupTables" JSONB NOT NULL DEFAULT '[]',
    "restoredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityPluginTableBackup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BankActivity" (
    "id" TEXT NOT NULL,
    "bankId" TEXT NOT NULL,
    "activityTypeId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "lifecycle" "ActivityLifecycle" NOT NULL DEFAULT 'draft',
    "config" JSONB NOT NULL DEFAULT '{}',
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "position" INTEGER NOT NULL DEFAULT 0,
    "currentVersionId" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BankActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityVersion" (
    "id" TEXT NOT NULL,
    "bankActivityId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "activityTypeId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "lifecycle" "ActivityLifecycle" NOT NULL DEFAULT 'draft',
    "config" JSONB NOT NULL DEFAULT '{}',
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Activity" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "bankActivityId" TEXT,
    "activityVersionId" TEXT,
    "activityTypeId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "lifecycle" "ActivityLifecycle" NOT NULL DEFAULT 'draft',
    "config" JSONB NOT NULL DEFAULT '{}',
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Activity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE INDEX "AiAgentConnection_ownerId_idx" ON "AiAgentConnection"("ownerId");

-- CreateIndex
CREATE INDEX "AiAgentConnection_provider_idx" ON "AiAgentConnection"("provider");

-- CreateIndex
CREATE INDEX "AiAgentConnection_isEnabled_idx" ON "AiAgentConnection"("isEnabled");

-- CreateIndex
CREATE UNIQUE INDEX "Role_key_key" ON "Role"("key");

-- CreateIndex
CREATE INDEX "UserRole_roleId_idx" ON "UserRole"("roleId");

-- CreateIndex
CREATE INDEX "Course_subjectId_idx" ON "Course"("subjectId");

-- CreateIndex
CREATE INDEX "Course_status_idx" ON "Course"("status");

-- CreateIndex
CREATE INDEX "Course_createdById_idx" ON "Course"("createdById");

-- CreateIndex
CREATE INDEX "Subject_createdById_idx" ON "Subject"("createdById");

-- CreateIndex
CREATE INDEX "Subject_updatedAt_idx" ON "Subject"("updatedAt");

-- CreateIndex
CREATE INDEX "SubjectMaterial_subjectId_position_idx" ON "SubjectMaterial"("subjectId", "position");

-- CreateIndex
CREATE INDEX "SubjectMaterial_subjectId_parentId_position_idx" ON "SubjectMaterial"("subjectId", "parentId", "position");

-- CreateIndex
CREATE INDEX "SubjectMaterial_kind_idx" ON "SubjectMaterial"("kind");

-- CreateIndex
CREATE INDEX "ActivityBank_subjectId_updatedAt_idx" ON "ActivityBank"("subjectId", "updatedAt");

-- CreateIndex
CREATE INDEX "ActivityBank_ownerId_idx" ON "ActivityBank"("ownerId");

-- CreateIndex
CREATE INDEX "CourseMembership_courseId_idx" ON "CourseMembership"("courseId");

-- CreateIndex
CREATE INDEX "CourseMembership_userId_idx" ON "CourseMembership"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "CourseMembership_courseId_userId_role_key" ON "CourseMembership"("courseId", "userId", "role");

-- CreateIndex
CREATE INDEX "CourseMaterial_courseId_position_idx" ON "CourseMaterial"("courseId", "position");

-- CreateIndex
CREATE INDEX "CourseMaterial_courseId_parentId_position_idx" ON "CourseMaterial"("courseId", "parentId", "position");

-- CreateIndex
CREATE INDEX "CourseMaterial_kind_idx" ON "CourseMaterial"("kind");

-- CreateIndex
CREATE INDEX "CourseGroup_courseId_updatedAt_idx" ON "CourseGroup"("courseId", "updatedAt");

-- CreateIndex
CREATE INDEX "CourseGroup_status_availableFrom_availableUntil_idx" ON "CourseGroup"("status", "availableFrom", "availableUntil");

-- CreateIndex
CREATE INDEX "CourseGroup_createdById_idx" ON "CourseGroup"("createdById");

-- CreateIndex
CREATE INDEX "CourseGroupParticipant_groupId_createdAt_idx" ON "CourseGroupParticipant"("groupId", "createdAt");

-- CreateIndex
CREATE INDEX "CourseGroupParticipant_email_idx" ON "CourseGroupParticipant"("email");

-- CreateIndex
CREATE INDEX "CourseGroupParticipant_userId_idx" ON "CourseGroupParticipant"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "CourseGroupParticipant_groupId_email_key" ON "CourseGroupParticipant"("groupId", "email");

-- CreateIndex
CREATE INDEX "CourseGroupMaterial_groupId_position_idx" ON "CourseGroupMaterial"("groupId", "position");

-- CreateIndex
CREATE INDEX "CourseGroupMaterial_groupId_parentId_position_idx" ON "CourseGroupMaterial"("groupId", "parentId", "position");

-- CreateIndex
CREATE INDEX "CourseGroupMaterial_kind_idx" ON "CourseGroupMaterial"("kind");

-- CreateIndex
CREATE INDEX "CourseGroupActivity_groupId_position_idx" ON "CourseGroupActivity"("groupId", "position");

-- CreateIndex
CREATE INDEX "CourseGroupActivity_activityId_idx" ON "CourseGroupActivity"("activityId");

-- CreateIndex
CREATE UNIQUE INDEX "CourseGroupActivity_groupId_activityId_key" ON "CourseGroupActivity"("groupId", "activityId");

-- CreateIndex
CREATE INDEX "CourseGroupHiddenCourseMaterial_courseMaterialId_idx" ON "CourseGroupHiddenCourseMaterial"("courseMaterialId");

-- CreateIndex
CREATE UNIQUE INDEX "ActivityType_key_key" ON "ActivityType"("key");

-- CreateIndex
CREATE UNIQUE INDEX "ActivityPluginInstallation_key_key" ON "ActivityPluginInstallation"("key");

-- CreateIndex
CREATE INDEX "ActivityPluginInstallation_isActivated_idx" ON "ActivityPluginInstallation"("isActivated");

-- CreateIndex
CREATE INDEX "ActivityPluginInstallation_isEnabled_idx" ON "ActivityPluginInstallation"("isEnabled");

-- CreateIndex
CREATE INDEX "ActivityPluginTableBackup_pluginKey_pluginVersion_idx" ON "ActivityPluginTableBackup"("pluginKey", "pluginVersion");

-- CreateIndex
CREATE INDEX "ActivityPluginTableBackup_restoredAt_idx" ON "ActivityPluginTableBackup"("restoredAt");

-- CreateIndex
CREATE INDEX "BankActivity_bankId_position_idx" ON "BankActivity"("bankId", "position");

-- CreateIndex
CREATE INDEX "BankActivity_activityTypeId_idx" ON "BankActivity"("activityTypeId");

-- CreateIndex
CREATE INDEX "BankActivity_currentVersionId_idx" ON "BankActivity"("currentVersionId");

-- CreateIndex
CREATE INDEX "ActivityVersion_bankActivityId_createdAt_idx" ON "ActivityVersion"("bankActivityId", "createdAt");

-- CreateIndex
CREATE INDEX "ActivityVersion_activityTypeId_idx" ON "ActivityVersion"("activityTypeId");

-- CreateIndex
CREATE UNIQUE INDEX "ActivityVersion_bankActivityId_versionNumber_key" ON "ActivityVersion"("bankActivityId", "versionNumber");

-- CreateIndex
CREATE INDEX "Activity_courseId_position_idx" ON "Activity"("courseId", "position");

-- CreateIndex
CREATE INDEX "Activity_bankActivityId_idx" ON "Activity"("bankActivityId");

-- CreateIndex
CREATE INDEX "Activity_activityVersionId_idx" ON "Activity"("activityVersionId");

-- CreateIndex
CREATE INDEX "Activity_activityTypeId_idx" ON "Activity"("activityTypeId");

-- CreateIndex
CREATE INDEX "Activity_lifecycle_idx" ON "Activity"("lifecycle");

-- AddForeignKey
ALTER TABLE "AiAgentConnection" ADD CONSTRAINT "AiAgentConnection_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Course" ADD CONSTRAINT "Course_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Course" ADD CONSTRAINT "Course_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subject" ADD CONSTRAINT "Subject_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubjectMaterial" ADD CONSTRAINT "SubjectMaterial_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubjectMaterial" ADD CONSTRAINT "SubjectMaterial_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubjectMaterial" ADD CONSTRAINT "SubjectMaterial_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "SubjectMaterial"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityBank" ADD CONSTRAINT "ActivityBank_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityBank" ADD CONSTRAINT "ActivityBank_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseMembership" ADD CONSTRAINT "CourseMembership_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseMembership" ADD CONSTRAINT "CourseMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseMaterial" ADD CONSTRAINT "CourseMaterial_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseMaterial" ADD CONSTRAINT "CourseMaterial_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseMaterial" ADD CONSTRAINT "CourseMaterial_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "CourseMaterial"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseGroup" ADD CONSTRAINT "CourseGroup_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseGroup" ADD CONSTRAINT "CourseGroup_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseGroupParticipant" ADD CONSTRAINT "CourseGroupParticipant_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "CourseGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseGroupParticipant" ADD CONSTRAINT "CourseGroupParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseGroupMaterial" ADD CONSTRAINT "CourseGroupMaterial_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "CourseGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseGroupMaterial" ADD CONSTRAINT "CourseGroupMaterial_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseGroupMaterial" ADD CONSTRAINT "CourseGroupMaterial_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "CourseGroupMaterial"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseGroupActivity" ADD CONSTRAINT "CourseGroupActivity_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "CourseGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseGroupActivity" ADD CONSTRAINT "CourseGroupActivity_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseGroupHiddenCourseMaterial" ADD CONSTRAINT "CourseGroupHiddenCourseMaterial_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "CourseGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseGroupHiddenCourseMaterial" ADD CONSTRAINT "CourseGroupHiddenCourseMaterial_courseMaterialId_fkey" FOREIGN KEY ("courseMaterialId") REFERENCES "CourseMaterial"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityPluginTableBackup" ADD CONSTRAINT "ActivityPluginTableBackup_pluginKey_fkey" FOREIGN KEY ("pluginKey") REFERENCES "ActivityPluginInstallation"("key") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankActivity" ADD CONSTRAINT "BankActivity_bankId_fkey" FOREIGN KEY ("bankId") REFERENCES "ActivityBank"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankActivity" ADD CONSTRAINT "BankActivity_activityTypeId_fkey" FOREIGN KEY ("activityTypeId") REFERENCES "ActivityType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankActivity" ADD CONSTRAINT "BankActivity_currentVersionId_fkey" FOREIGN KEY ("currentVersionId") REFERENCES "ActivityVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankActivity" ADD CONSTRAINT "BankActivity_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityVersion" ADD CONSTRAINT "ActivityVersion_bankActivityId_fkey" FOREIGN KEY ("bankActivityId") REFERENCES "BankActivity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityVersion" ADD CONSTRAINT "ActivityVersion_activityTypeId_fkey" FOREIGN KEY ("activityTypeId") REFERENCES "ActivityType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityVersion" ADD CONSTRAINT "ActivityVersion_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_bankActivityId_fkey" FOREIGN KEY ("bankActivityId") REFERENCES "BankActivity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_activityVersionId_fkey" FOREIGN KEY ("activityVersionId") REFERENCES "ActivityVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_activityTypeId_fkey" FOREIGN KEY ("activityTypeId") REFERENCES "ActivityType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

