CREATE TABLE "StudentGrouping" (
  "id" TEXT NOT NULL,
  "groupId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL DEFAULT '',
  "revision" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StudentGrouping_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "StudentGrouping_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "CourseGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "StudentGrouping_groupId_title_key" ON "StudentGrouping"("groupId", "title");

CREATE TABLE "StudentTeam" (
  "id" TEXT NOT NULL,
  "groupingId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  CONSTRAINT "StudentTeam_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "StudentTeam_groupingId_fkey" FOREIGN KEY ("groupingId") REFERENCES "StudentGrouping"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "StudentTeam_id_groupingId_key" ON "StudentTeam"("id", "groupingId");
CREATE UNIQUE INDEX "StudentTeam_groupingId_title_key" ON "StudentTeam"("groupingId", "title");

CREATE TABLE "StudentTeamMember" (
  "groupingId" TEXT NOT NULL,
  "teamId" TEXT NOT NULL,
  "participantId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StudentTeamMember_pkey" PRIMARY KEY ("groupingId", "participantId"),
  CONSTRAINT "StudentTeamMember_teamId_groupingId_fkey" FOREIGN KEY ("teamId", "groupingId") REFERENCES "StudentTeam"("id", "groupingId") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "StudentTeamMember_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "CourseGroupParticipant"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "StudentTeamMember_teamId_groupingId_idx" ON "StudentTeamMember"("teamId", "groupingId");
CREATE INDEX "StudentTeamMember_participantId_idx" ON "StudentTeamMember"("participantId");
