CREATE TABLE "TestRevision" (
  "id" TEXT NOT NULL,
  "testId" TEXT NOT NULL,
  "revisionNumber" INTEGER NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "settings" JSONB NOT NULL DEFAULT '{}',
  "fingerprint" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TestRevision_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TestRevisionItem" (
  "id" TEXT NOT NULL,
  "testRevisionId" TEXT NOT NULL,
  "sourceTestItemId" TEXT NOT NULL,
  "sourceActivityId" TEXT NOT NULL,
  "activityTypeKey" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "config" JSONB NOT NULL DEFAULT '{}',
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "position" INTEGER NOT NULL,
  "pointsPossible" DOUBLE PRECISION NOT NULL,
  "isRequired" BOOLEAN NOT NULL,
  "activityFingerprint" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TestRevisionItem_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "ActivityAttempt" ADD COLUMN "testRevisionId" TEXT;

ALTER TABLE "TestRevision" ADD CONSTRAINT "TestRevision_number_positive" CHECK ("revisionNumber" > 0);
ALTER TABLE "TestRevisionItem" ADD CONSTRAINT "TestRevisionItem_position_nonnegative" CHECK ("position" >= 0);
ALTER TABLE "TestRevisionItem" ADD CONSTRAINT "TestRevisionItem_points_positive" CHECK ("pointsPossible" > 0);

CREATE TABLE "TestSubmissionClaim" (
  "parentAttemptId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'processing',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TestSubmissionClaim_pkey" PRIMARY KEY ("parentAttemptId")
);

CREATE UNIQUE INDEX "TestRevision_testId_revisionNumber_key" ON "TestRevision"("testId", "revisionNumber");
CREATE UNIQUE INDEX "TestRevision_testId_fingerprint_key" ON "TestRevision"("testId", "fingerprint");
CREATE INDEX "TestRevision_testId_createdAt_idx" ON "TestRevision"("testId", "createdAt");
CREATE UNIQUE INDEX "TestRevisionItem_testRevisionId_sourceTestItemId_key" ON "TestRevisionItem"("testRevisionId", "sourceTestItemId");
CREATE INDEX "TestRevisionItem_testRevisionId_position_idx" ON "TestRevisionItem"("testRevisionId", "position");
CREATE INDEX "TestRevisionItem_sourceActivityId_idx" ON "TestRevisionItem"("sourceActivityId");
CREATE INDEX "TestRevisionItem_activityTypeKey_idx" ON "TestRevisionItem"("activityTypeKey");
CREATE INDEX "ActivityAttempt_testRevisionId_idx" ON "ActivityAttempt"("testRevisionId");
CREATE INDEX "TestSubmissionClaim_status_updatedAt_idx" ON "TestSubmissionClaim"("status", "updatedAt");

ALTER TABLE "TestRevision" ADD CONSTRAINT "TestRevision_testId_fkey" FOREIGN KEY ("testId") REFERENCES "Test"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TestRevisionItem" ADD CONSTRAINT "TestRevisionItem_testRevisionId_fkey" FOREIGN KEY ("testRevisionId") REFERENCES "TestRevision"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ActivityAttempt" ADD CONSTRAINT "ActivityAttempt_testRevisionId_fkey" FOREIGN KEY ("testRevisionId") REFERENCES "TestRevision"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TestSubmissionClaim" ADD CONSTRAINT "TestSubmissionClaim_parentAttemptId_fkey" FOREIGN KEY ("parentAttemptId") REFERENCES "ActivityAttempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;
