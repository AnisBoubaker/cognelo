ALTER TYPE "GradeEventType" ADD VALUE IF NOT EXISTS 'assessment_mode_changed';

ALTER TABLE "ActivityAttempt"
  ADD COLUMN "assessmentMode" TEXT NOT NULL DEFAULT 'summative';

ALTER TABLE "Grade"
  ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX "ActivityAttempt_gradebookItemId_participantId_assessmentMode_idx"
  ON "ActivityAttempt"("gradebookItemId", "participantId", "assessmentMode");

CREATE INDEX "ActivityAttempt_groupActivityId_assessmentMode_idx"
  ON "ActivityAttempt"("groupActivityId", "assessmentMode");

CREATE INDEX "Grade_gradebookItemId_isActive_idx"
  ON "Grade"("gradebookItemId", "isActive");
