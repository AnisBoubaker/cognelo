CREATE TABLE "ActivityResponseDraft" (
  "id" TEXT NOT NULL,
  "groupActivityId" TEXT NOT NULL,
  "participantId" TEXT NOT NULL,
  "state" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ActivityResponseDraft_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ActivityResponseDraft_groupActivityId_participantId_key"
ON "ActivityResponseDraft"("groupActivityId", "participantId");

CREATE INDEX "ActivityResponseDraft_participantId_updatedAt_idx"
ON "ActivityResponseDraft"("participantId", "updatedAt");

ALTER TABLE "ActivityResponseDraft"
ADD CONSTRAINT "ActivityResponseDraft_groupActivityId_fkey"
FOREIGN KEY ("groupActivityId") REFERENCES "CourseGroupActivity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ActivityResponseDraft"
ADD CONSTRAINT "ActivityResponseDraft_participantId_fkey"
FOREIGN KEY ("participantId") REFERENCES "CourseGroupParticipant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
