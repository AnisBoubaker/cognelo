CREATE TABLE "CourseGroupParticipant" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "userId" TEXT,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "externalId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CourseGroupParticipant_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CourseGroupParticipant_groupId_email_key" ON "CourseGroupParticipant"("groupId", "email");
CREATE INDEX "CourseGroupParticipant_groupId_createdAt_idx" ON "CourseGroupParticipant"("groupId", "createdAt");
CREATE INDEX "CourseGroupParticipant_email_idx" ON "CourseGroupParticipant"("email");
CREATE INDEX "CourseGroupParticipant_userId_idx" ON "CourseGroupParticipant"("userId");

ALTER TABLE "CourseGroupParticipant"
ADD CONSTRAINT "CourseGroupParticipant_groupId_fkey"
FOREIGN KEY ("groupId") REFERENCES "CourseGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CourseGroupParticipant"
ADD CONSTRAINT "CourseGroupParticipant_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
