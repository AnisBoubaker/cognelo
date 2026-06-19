CREATE TYPE "BackgroundJobStatus" AS ENUM ('queued', 'running', 'succeeded', 'failed', 'cancelled');

CREATE TABLE "BackgroundJob" (
    "id" TEXT NOT NULL,
    "queue" TEXT NOT NULL DEFAULT 'default',
    "handlerKey" TEXT NOT NULL,
    "status" "BackgroundJobStatus" NOT NULL DEFAULT 'queued',
    "priority" INTEGER NOT NULL DEFAULT 0,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "result" JSONB,
    "error" JSONB,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "idempotencyKey" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "runAfter" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedAt" TIMESTAMP(3),
    "lockedBy" TEXT,
    "completedAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BackgroundJob_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BackgroundJob_queue_idempotencyKey_key" ON "BackgroundJob"("queue", "idempotencyKey");
CREATE INDEX "BackgroundJob_status_runAfter_priority_idx" ON "BackgroundJob"("status", "runAfter", "priority");
CREATE INDEX "BackgroundJob_queue_status_runAfter_idx" ON "BackgroundJob"("queue", "status", "runAfter");
CREATE INDEX "BackgroundJob_handlerKey_idx" ON "BackgroundJob"("handlerKey");
