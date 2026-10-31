CREATE TABLE IF NOT EXISTS "AiGradingRun" (
  "id" TEXT PRIMARY KEY, "courseId" TEXT NOT NULL, "activityId" TEXT NOT NULL,
  "actorUserId" TEXT NOT NULL, "activeKey" TEXT, "status" TEXT NOT NULL DEFAULT 'running',
  "stopReason" TEXT, "entries" JSONB NOT NULL, "guidance" JSONB NOT NULL,
  "heartbeatAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE,
  FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE CASCADE,
  FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "AiGradingRun_activeKey_key" ON "AiGradingRun"("activeKey");
CREATE INDEX IF NOT EXISTS "AiGradingRun_courseId_activityId_actorUserId_createdAt_idx" ON "AiGradingRun"("courseId", "activityId", "actorUserId", "createdAt");
