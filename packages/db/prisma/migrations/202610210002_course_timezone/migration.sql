ALTER TABLE "ApplicationSettings" ADD COLUMN "allowCourseTimeZone" BOOLEAN NOT NULL DEFAULT false;
-- NULL inherits the administrator's current timezone; no existing instant changes.
ALTER TABLE "Course" ADD COLUMN "timeZone" TEXT;
