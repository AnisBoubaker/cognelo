ALTER TYPE "MaterialKind" ADD VALUE IF NOT EXISTS 'folder';

ALTER TABLE "CourseMaterial" ADD COLUMN "parentId" TEXT;

CREATE INDEX "CourseMaterial_courseId_parentId_position_idx" ON "CourseMaterial"("courseId", "parentId", "position");

ALTER TABLE "CourseMaterial"
  ADD CONSTRAINT "CourseMaterial_parentId_fkey"
  FOREIGN KEY ("parentId")
  REFERENCES "CourseMaterial"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;
