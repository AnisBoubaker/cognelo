CREATE TYPE "CourseStatus" AS ENUM ('draft', 'published', 'archived');
CREATE TYPE "CourseMembershipRole" AS ENUM ('owner', 'teacher', 'ta', 'student');
CREATE TYPE "MaterialKind" AS ENUM ('text', 'markdown', 'pdf', 'link', 'github_repo', 'code_example', 'dataset', 'file', 'module');
CREATE TYPE "ActivityLifecycle" AS ENUM ('draft', 'published', 'paused', 'archived');

CREATE TABLE "User" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "name" TEXT,
  "passwordHash" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Role" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "UserRole" (
  "userId" TEXT NOT NULL,
  "roleId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UserRole_pkey" PRIMARY KEY ("userId","roleId")
);

CREATE TABLE "Course" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL DEFAULT '',
  "status" "CourseStatus" NOT NULL DEFAULT 'draft',
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Course_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CourseMembership" (
  "id" TEXT NOT NULL,
  "courseId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "role" "CourseMembershipRole" NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CourseMembership_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CourseMaterial" (
  "id" TEXT NOT NULL,
  "courseId" TEXT NOT NULL,
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

CREATE TABLE "Activity" (
  "id" TEXT NOT NULL,
  "courseId" TEXT NOT NULL,
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

CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE INDEX "User_email_idx" ON "User"("email");
CREATE UNIQUE INDEX "Role_key_key" ON "Role"("key");
CREATE INDEX "UserRole_roleId_idx" ON "UserRole"("roleId");
CREATE INDEX "Course_status_idx" ON "Course"("status");
CREATE INDEX "Course_createdById_idx" ON "Course"("createdById");
CREATE UNIQUE INDEX "CourseMembership_courseId_userId_role_key" ON "CourseMembership"("courseId", "userId", "role");
CREATE INDEX "CourseMembership_courseId_idx" ON "CourseMembership"("courseId");
CREATE INDEX "CourseMembership_userId_idx" ON "CourseMembership"("userId");
CREATE INDEX "CourseMaterial_courseId_position_idx" ON "CourseMaterial"("courseId", "position");
CREATE INDEX "CourseMaterial_kind_idx" ON "CourseMaterial"("kind");
CREATE UNIQUE INDEX "ActivityType_key_key" ON "ActivityType"("key");
CREATE INDEX "Activity_courseId_position_idx" ON "Activity"("courseId", "position");
CREATE INDEX "Activity_activityTypeId_idx" ON "Activity"("activityTypeId");
CREATE INDEX "Activity_lifecycle_idx" ON "Activity"("lifecycle");

ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Course" ADD CONSTRAINT "Course_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CourseMembership" ADD CONSTRAINT "CourseMembership_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CourseMembership" ADD CONSTRAINT "CourseMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CourseMaterial" ADD CONSTRAINT "CourseMaterial_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CourseMaterial" ADD CONSTRAINT "CourseMaterial_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_activityTypeId_fkey" FOREIGN KEY ("activityTypeId") REFERENCES "ActivityType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
