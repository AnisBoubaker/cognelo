CREATE TABLE IF NOT EXISTS "ActivityGradingReview" (
  "id" TEXT NOT NULL,
  "targetKey" TEXT NOT NULL,
  "attemptId" TEXT NOT NULL,
  "testItemAttemptId" TEXT,
  "pluginKey" TEXT NOT NULL,
  "reasonCode" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "evidenceRef" TEXT,
  "status" TEXT NOT NULL DEFAULT 'required' CHECK ("status" IN ('required', 'resolved')),
  "version" INTEGER NOT NULL DEFAULT 1,
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt" TIMESTAMP(3),
  "resolvedByUserId" TEXT,
  CONSTRAINT "ActivityGradingReview_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ActivityGradingReview_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "ActivityAttempt"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ActivityGradingReview_testItemAttemptId_fkey" FOREIGN KEY ("testItemAttemptId") REFERENCES "TestItemAttempt"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "ActivityGradingReview_targetKey_key" ON "ActivityGradingReview"("targetKey");
CREATE UNIQUE INDEX IF NOT EXISTS "ActivityGradingReview_testItemAttemptId_key" ON "ActivityGradingReview"("testItemAttemptId");
CREATE INDEX IF NOT EXISTS "ActivityGradingReview_attemptId_status_idx" ON "ActivityGradingReview"("attemptId", "status");
