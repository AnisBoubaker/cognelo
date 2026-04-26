CREATE TABLE "BankActivity" (
  "id" TEXT NOT NULL,
  "bankId" TEXT NOT NULL,
  "activityTypeId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL DEFAULT '',
  "lifecycle" "ActivityLifecycle" NOT NULL DEFAULT 'draft',
  "config" JSONB NOT NULL DEFAULT '{}',
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "position" INTEGER NOT NULL DEFAULT 0,
  "currentVersionId" TEXT,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BankActivity_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ActivityVersion" (
  "id" TEXT NOT NULL,
  "bankActivityId" TEXT NOT NULL,
  "versionNumber" INTEGER NOT NULL,
  "activityTypeId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL DEFAULT '',
  "lifecycle" "ActivityLifecycle" NOT NULL DEFAULT 'draft',
  "config" JSONB NOT NULL DEFAULT '{}',
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ActivityVersion_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Activity" ADD COLUMN "bankActivityId" TEXT;
ALTER TABLE "Activity" ADD COLUMN "activityVersionId" TEXT;

CREATE INDEX "BankActivity_bankId_position_idx" ON "BankActivity"("bankId", "position");
CREATE INDEX "BankActivity_activityTypeId_idx" ON "BankActivity"("activityTypeId");
CREATE INDEX "BankActivity_currentVersionId_idx" ON "BankActivity"("currentVersionId");
CREATE UNIQUE INDEX "ActivityVersion_bankActivityId_versionNumber_key" ON "ActivityVersion"("bankActivityId", "versionNumber");
CREATE INDEX "ActivityVersion_bankActivityId_createdAt_idx" ON "ActivityVersion"("bankActivityId", "createdAt");
CREATE INDEX "ActivityVersion_activityTypeId_idx" ON "ActivityVersion"("activityTypeId");
CREATE INDEX "Activity_bankActivityId_idx" ON "Activity"("bankActivityId");
CREATE INDEX "Activity_activityVersionId_idx" ON "Activity"("activityVersionId");

ALTER TABLE "BankActivity" ADD CONSTRAINT "BankActivity_bankId_fkey" FOREIGN KEY ("bankId") REFERENCES "ActivityBank"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BankActivity" ADD CONSTRAINT "BankActivity_activityTypeId_fkey" FOREIGN KEY ("activityTypeId") REFERENCES "ActivityType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BankActivity" ADD CONSTRAINT "BankActivity_currentVersionId_fkey" FOREIGN KEY ("currentVersionId") REFERENCES "ActivityVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BankActivity" ADD CONSTRAINT "BankActivity_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ActivityVersion" ADD CONSTRAINT "ActivityVersion_bankActivityId_fkey" FOREIGN KEY ("bankActivityId") REFERENCES "BankActivity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ActivityVersion" ADD CONSTRAINT "ActivityVersion_activityTypeId_fkey" FOREIGN KEY ("activityTypeId") REFERENCES "ActivityType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ActivityVersion" ADD CONSTRAINT "ActivityVersion_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_bankActivityId_fkey" FOREIGN KEY ("bankActivityId") REFERENCES "BankActivity"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_activityVersionId_fkey" FOREIGN KEY ("activityVersionId") REFERENCES "ActivityVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
