ALTER TABLE "StudentGrouping"
  ADD COLUMN "studentChoiceEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "choiceOpensAt" TIMESTAMP(3),
  ADD COLUMN "choiceClosesAt" TIMESTAMP(3),
  ADD COLUMN "allowChoiceChanges" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "StudentTeam" ADD COLUMN "capacity" INTEGER NOT NULL DEFAULT 4;
-- Preserve existing compositions when introducing capacities.
UPDATE "StudentTeam" AS team SET "capacity" = GREATEST(4, (
  SELECT COUNT(*)::INTEGER FROM "StudentTeamMember" AS member WHERE member."teamId" = team."id"
));
ALTER TABLE "StudentTeam" ADD CONSTRAINT "StudentTeam_capacity_check" CHECK ("capacity" >= 0);
ALTER TABLE "StudentGrouping" ADD CONSTRAINT "StudentGrouping_choice_window_check"
  CHECK ("choiceOpensAt" IS NULL OR "choiceClosesAt" IS NULL OR "choiceClosesAt" > "choiceOpensAt");
