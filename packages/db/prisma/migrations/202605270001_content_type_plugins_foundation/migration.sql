-- Content type plugin persistence foundation.

ALTER TYPE "CourseContentItemKind" RENAME TO "_CourseContentItemKind_old";

CREATE TYPE "CourseContentItemKind" AS ENUM ('folder', 'content', 'activity');

ALTER TABLE "CourseContentItem"
  ALTER COLUMN "kind" TYPE "CourseContentItemKind"
  USING (
    CASE
      WHEN "kind"::text = 'material' THEN 'content'
      ELSE "kind"::text
    END
  )::"CourseContentItemKind";

DROP TYPE "_CourseContentItemKind_old";

CREATE TABLE "ContentTypePluginInstallation" (
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

    CONSTRAINT "ContentTypePluginInstallation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ContentTypePluginTableBackup" (
    "id" TEXT NOT NULL,
    "pluginKey" TEXT NOT NULL,
    "pluginVersion" TEXT NOT NULL,
    "sourceTables" JSONB NOT NULL DEFAULT '[]',
    "backupTables" JSONB NOT NULL DEFAULT '[]',
    "restoredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContentTypePluginTableBackup_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CourseContentResource" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "groupId" TEXT,
    "contentTypeKey" TEXT NOT NULL,
    "pluginKey" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CourseContentResource_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "CourseContentItem" ADD COLUMN "contentResourceId" TEXT;

CREATE UNIQUE INDEX "ContentTypePluginInstallation_key_key" ON "ContentTypePluginInstallation"("key");
CREATE INDEX "ContentTypePluginInstallation_isActivated_idx" ON "ContentTypePluginInstallation"("isActivated");
CREATE INDEX "ContentTypePluginInstallation_isEnabled_idx" ON "ContentTypePluginInstallation"("isEnabled");

CREATE INDEX "ContentTypePluginTableBackup_pluginKey_pluginVersion_idx" ON "ContentTypePluginTableBackup"("pluginKey", "pluginVersion");
CREATE INDEX "ContentTypePluginTableBackup_restoredAt_idx" ON "ContentTypePluginTableBackup"("restoredAt");

CREATE INDEX "CourseContentResource_courseId_groupId_idx" ON "CourseContentResource"("courseId", "groupId");
CREATE INDEX "CourseContentResource_contentTypeKey_idx" ON "CourseContentResource"("contentTypeKey");
CREATE INDEX "CourseContentResource_pluginKey_idx" ON "CourseContentResource"("pluginKey");

CREATE INDEX "CourseContentItem_contentResourceId_idx" ON "CourseContentItem"("contentResourceId");

ALTER TABLE "CourseContentResource" ADD CONSTRAINT "CourseContentResource_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CourseContentResource" ADD CONSTRAINT "CourseContentResource_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "CourseGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ContentTypePluginTableBackup" ADD CONSTRAINT "ContentTypePluginTableBackup_pluginKey_fkey" FOREIGN KEY ("pluginKey") REFERENCES "ContentTypePluginInstallation"("key") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CourseContentItem" ADD CONSTRAINT "CourseContentItem_contentResourceId_fkey" FOREIGN KEY ("contentResourceId") REFERENCES "CourseContentResource"("id") ON DELETE CASCADE ON UPDATE CASCADE;
