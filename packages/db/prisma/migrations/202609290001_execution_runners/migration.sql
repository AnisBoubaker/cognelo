-- Runner endpoints and credentials are instance configuration. Multiple rows
-- per type are allowed so selection can become round-robin without reshaping
-- persisted data.
CREATE TYPE "ExecutionRunnerType" AS ENUM ('judge0', 'web_design', 'sagemath');

CREATE TABLE "ExecutionRunner" (
    "id" TEXT NOT NULL,
    "runnerType" "ExecutionRunnerType" NOT NULL,
    "displayName" TEXT NOT NULL,
    "baseUrl" TEXT NOT NULL,
    "authHeader" TEXT,
    "authTokenEncrypted" TEXT,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "position" INTEGER NOT NULL DEFAULT 0,
    "settings" JSONB NOT NULL DEFAULT '{}',
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExecutionRunner_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ExecutionRunner_runnerType_isEnabled_position_idx"
ON "ExecutionRunner"("runnerType", "isEnabled", "position");

CREATE INDEX "ExecutionRunner_updatedById_idx" ON "ExecutionRunner"("updatedById");

ALTER TABLE "ExecutionRunner"
ADD CONSTRAINT "ExecutionRunner_updatedById_fkey"
FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
