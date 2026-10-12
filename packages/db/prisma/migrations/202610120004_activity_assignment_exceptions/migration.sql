CREATE TABLE "ActivityAssignmentException" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "groupActivityId" TEXT NOT NULL,
  "teamId" TEXT,
  "participantId" TEXT,
  "priority" INTEGER NOT NULL DEFAULT 0,
  "settings" JSONB NOT NULL DEFAULT '{}',
  CONSTRAINT "ActivityAssignmentException_one_target" CHECK (("teamId" IS NULL) <> ("participantId" IS NULL)),
  CONSTRAINT "ActivityAssignmentException_priority_check" CHECK ("priority" >= 0),
  CONSTRAINT "ActivityAssignmentException_assignment_fkey" FOREIGN KEY ("groupActivityId") REFERENCES "CourseGroupActivity"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ActivityAssignmentException_team_fkey" FOREIGN KEY ("teamId") REFERENCES "StudentTeam"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ActivityAssignmentException_participant_fkey" FOREIGN KEY ("participantId") REFERENCES "CourseGroupParticipant"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ActivityAssignmentException_groupActivityId_teamId_key" ON "ActivityAssignmentException"("groupActivityId", "teamId");
CREATE UNIQUE INDEX "ActivityAssignmentException_groupActivityId_participantId_key" ON "ActivityAssignmentException"("groupActivityId", "participantId");
CREATE INDEX "ActivityAssignmentException_teamId_idx" ON "ActivityAssignmentException"("teamId");
CREATE INDEX "ActivityAssignmentException_participantId_idx" ON "ActivityAssignmentException"("participantId");
