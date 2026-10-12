CREATE TYPE "StudentGroupingAssignmentMethod" AS ENUM ('manual', 'random', 'student_choice');
ALTER TABLE "StudentGrouping"
  ADD COLUMN "visibleToStudents" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "assignmentMethod" "StudentGroupingAssignmentMethod" NOT NULL DEFAULT 'manual';
-- Randomization was previously a draft operation with no persisted method marker.
-- Preserve known student-choice policies; do not guess historical random assignments.
UPDATE "StudentGrouping" SET "assignmentMethod" = 'student_choice' WHERE "studentChoiceEnabled";
ALTER TABLE "StudentGrouping" ADD CONSTRAINT "StudentGrouping_assignment_method_check"
  CHECK ("studentChoiceEnabled" = ("assignmentMethod" = 'student_choice'));
