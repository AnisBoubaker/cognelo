ALTER TABLE "ApplicationSettings"
  ADD COLUMN IF NOT EXISTS "exportUsageRights" TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "allowCourseExportUsageRights" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Course"
  ADD COLUMN IF NOT EXISTS "studentCourseExportUsageRights" TEXT,
  ADD COLUMN IF NOT EXISTS "studentCourseExportConfidential" BOOLEAN NOT NULL DEFAULT false;
