CREATE TYPE "CourseGroupStatus" AS ENUM ('draft', 'published');

ALTER TABLE "CourseGroup"
  ADD COLUMN "status" "CourseGroupStatus" NOT NULL DEFAULT 'draft',
  ADD COLUMN "availableFrom" TIMESTAMP(3),
  ADD COLUMN "availableUntil" TIMESTAMP(3);

CREATE INDEX "CourseGroup_status_availableFrom_availableUntil_idx"
  ON "CourseGroup"("status", "availableFrom", "availableUntil");
