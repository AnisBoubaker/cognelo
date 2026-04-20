CREATE TABLE "CourseGroup" (
  "id" TEXT NOT NULL,
  "courseId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL DEFAULT '',
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CourseGroup_pkey" PRIMARY KEY ("id")
);

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

CREATE UNIQUE INDEX "CourseGroupActivity_groupId_activityId_key" ON "CourseGroupActivity"("groupId", "activityId");
CREATE INDEX "CourseGroup_courseId_updatedAt_idx" ON "CourseGroup"("courseId", "updatedAt");
CREATE INDEX "CourseGroup_createdById_idx" ON "CourseGroup"("createdById");
CREATE INDEX "CourseGroupMaterial_groupId_position_idx" ON "CourseGroupMaterial"("groupId", "position");
CREATE INDEX "CourseGroupMaterial_groupId_parentId_position_idx" ON "CourseGroupMaterial"("groupId", "parentId", "position");
CREATE INDEX "CourseGroupMaterial_kind_idx" ON "CourseGroupMaterial"("kind");
CREATE INDEX "CourseGroupActivity_groupId_position_idx" ON "CourseGroupActivity"("groupId", "position");
CREATE INDEX "CourseGroupActivity_activityId_idx" ON "CourseGroupActivity"("activityId");

ALTER TABLE "CourseGroup"
  ADD CONSTRAINT "CourseGroup_courseId_fkey"
  FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CourseGroup"
  ADD CONSTRAINT "CourseGroup_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CourseGroupMaterial"
  ADD CONSTRAINT "CourseGroupMaterial_groupId_fkey"
  FOREIGN KEY ("groupId") REFERENCES "CourseGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CourseGroupMaterial"
  ADD CONSTRAINT "CourseGroupMaterial_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CourseGroupMaterial"
  ADD CONSTRAINT "CourseGroupMaterial_parentId_fkey"
  FOREIGN KEY ("parentId") REFERENCES "CourseGroupMaterial"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CourseGroupActivity"
  ADD CONSTRAINT "CourseGroupActivity_groupId_fkey"
  FOREIGN KEY ("groupId") REFERENCES "CourseGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CourseGroupActivity"
  ADD CONSTRAINT "CourseGroupActivity_activityId_fkey"
  FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
