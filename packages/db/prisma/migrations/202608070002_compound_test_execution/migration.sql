CREATE TABLE "TestItemAttempt" (
    "id" TEXT NOT NULL,
    "parentAttemptId" TEXT NOT NULL,
    "testItemId" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "lifecycle" "ActivityAttemptLifecycle" NOT NULL DEFAULT 'started',
    "rawScore" DOUBLE PRECISION,
    "rawMaxScore" DOUBLE PRECISION,
    "normalizedScore" DOUBLE PRECISION,
    "normalizedMaxScore" DOUBLE PRECISION,
    "pluginAttemptRef" TEXT,
    "result" JSONB NOT NULL DEFAULT '{}',
    "feedback" JSONB NOT NULL DEFAULT '{}',
    "activityConfigFingerprint" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submittedAt" TIMESTAMP(3),
    "gradedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TestItemAttempt_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TestItemAttempt_parentAttemptId_testItemId_key" ON "TestItemAttempt"("parentAttemptId", "testItemId");
CREATE INDEX "TestItemAttempt_testItemId_idx" ON "TestItemAttempt"("testItemId");
CREATE INDEX "TestItemAttempt_activityId_idx" ON "TestItemAttempt"("activityId");
CREATE INDEX "TestItemAttempt_lifecycle_idx" ON "TestItemAttempt"("lifecycle");
CREATE INDEX "TestItemAttempt_pluginAttemptRef_idx" ON "TestItemAttempt"("pluginAttemptRef");

ALTER TABLE "TestItemAttempt" ADD CONSTRAINT "TestItemAttempt_parentAttemptId_fkey" FOREIGN KEY ("parentAttemptId") REFERENCES "ActivityAttempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TestItemAttempt" ADD CONSTRAINT "TestItemAttempt_testItemId_fkey" FOREIGN KEY ("testItemId") REFERENCES "TestItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TestItemAttempt" ADD CONSTRAINT "TestItemAttempt_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
