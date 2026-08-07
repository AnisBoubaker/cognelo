-- CreateEnum
CREATE TYPE "ActivityProviderKind" AS ENUM ('core', 'plugin');

-- AlterTable
ALTER TABLE "ActivityType"
ADD COLUMN "providerKind" "ActivityProviderKind" NOT NULL DEFAULT 'plugin',
ADD COLUMN "providerKey" TEXT;

-- Preserve the provider recorded by existing plugin activation/seed metadata.
UPDATE "ActivityType"
SET "providerKey" = NULLIF("metadata"->>'plugin', '')
WHERE "providerKey" IS NULL;

-- CreateTable
CREATE TABLE "Test" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "settings" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Test_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TestItem" (
    "id" TEXT NOT NULL,
    "testId" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "pointsPossible" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TestItem_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "TestItem_position_nonnegative" CHECK ("position" >= 0),
    CONSTRAINT "TestItem_points_positive" CHECK ("pointsPossible" > 0)
);

-- CreateIndex
CREATE INDEX "ActivityType_providerKind_idx" ON "ActivityType"("providerKind");

-- CreateIndex
CREATE INDEX "ActivityType_providerKey_idx" ON "ActivityType"("providerKey");

-- CreateIndex
CREATE UNIQUE INDEX "Test_activityId_key" ON "Test"("activityId");

-- CreateIndex
CREATE INDEX "Test_courseId_idx" ON "Test"("courseId");

-- CreateIndex
CREATE UNIQUE INDEX "TestItem_activityId_key" ON "TestItem"("activityId");

-- CreateIndex
CREATE INDEX "TestItem_testId_position_idx" ON "TestItem"("testId", "position");

-- AddForeignKey
ALTER TABLE "Test" ADD CONSTRAINT "Test_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Test" ADD CONSTRAINT "Test_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestItem" ADD CONSTRAINT "TestItem_testId_fkey" FOREIGN KEY ("testId") REFERENCES "Test"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestItem" ADD CONSTRAINT "TestItem_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
