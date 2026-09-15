CREATE TYPE "MediaAssetStatus" AS ENUM ('staged', 'active');

CREATE TABLE "MediaBlob" (
    "id" TEXT NOT NULL,
    "sha256" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "byteSize" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MediaBlob_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MediaAsset" (
    "id" TEXT NOT NULL,
    "blobId" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "status" "MediaAssetStatus" NOT NULL DEFAULT 'staged',
    "createdById" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "unreferencedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MediaAsset_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MediaAssetReference" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "fieldKey" TEXT NOT NULL,
    "subjectId" TEXT,
    "bankActivityId" TEXT,
    "activityVersionId" TEXT,
    "activityId" TEXT,
    "testRevisionId" TEXT,
    "testRevisionItemId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MediaAssetReference_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "MediaAssetReference_one_owner_check" CHECK (
      num_nonnulls(
        "subjectId",
        "bankActivityId",
        "activityVersionId",
        "activityId",
        "testRevisionId",
        "testRevisionItemId"
      ) = 1
    )
);

CREATE UNIQUE INDEX "MediaBlob_sha256_key" ON "MediaBlob"("sha256");
CREATE UNIQUE INDEX "MediaBlob_storageKey_key" ON "MediaBlob"("storageKey");
CREATE INDEX "MediaBlob_createdAt_idx" ON "MediaBlob"("createdAt");

CREATE INDEX "MediaAsset_blobId_idx" ON "MediaAsset"("blobId");
CREATE INDEX "MediaAsset_createdById_status_idx" ON "MediaAsset"("createdById", "status");
CREATE INDEX "MediaAsset_status_expiresAt_idx" ON "MediaAsset"("status", "expiresAt");
CREATE INDEX "MediaAsset_status_unreferencedAt_idx" ON "MediaAsset"("status", "unreferencedAt");

CREATE UNIQUE INDEX "MediaAssetReference_subjectId_fieldKey_assetId_key" ON "MediaAssetReference"("subjectId", "fieldKey", "assetId");
CREATE UNIQUE INDEX "MediaAssetReference_bankActivityId_fieldKey_assetId_key" ON "MediaAssetReference"("bankActivityId", "fieldKey", "assetId");
CREATE UNIQUE INDEX "MediaAssetReference_activityVersionId_fieldKey_assetId_key" ON "MediaAssetReference"("activityVersionId", "fieldKey", "assetId");
CREATE UNIQUE INDEX "MediaAssetReference_activityId_fieldKey_assetId_key" ON "MediaAssetReference"("activityId", "fieldKey", "assetId");
CREATE UNIQUE INDEX "MediaAssetReference_testRevisionId_fieldKey_assetId_key" ON "MediaAssetReference"("testRevisionId", "fieldKey", "assetId");
CREATE UNIQUE INDEX "MediaAssetReference_testRevisionItemId_fieldKey_assetId_key" ON "MediaAssetReference"("testRevisionItemId", "fieldKey", "assetId");
CREATE INDEX "MediaAssetReference_assetId_idx" ON "MediaAssetReference"("assetId");
CREATE INDEX "MediaAssetReference_subjectId_idx" ON "MediaAssetReference"("subjectId");
CREATE INDEX "MediaAssetReference_bankActivityId_idx" ON "MediaAssetReference"("bankActivityId");
CREATE INDEX "MediaAssetReference_activityVersionId_idx" ON "MediaAssetReference"("activityVersionId");
CREATE INDEX "MediaAssetReference_activityId_idx" ON "MediaAssetReference"("activityId");
CREATE INDEX "MediaAssetReference_testRevisionId_idx" ON "MediaAssetReference"("testRevisionId");
CREATE INDEX "MediaAssetReference_testRevisionItemId_idx" ON "MediaAssetReference"("testRevisionItemId");

ALTER TABLE "MediaAsset" ADD CONSTRAINT "MediaAsset_blobId_fkey" FOREIGN KEY ("blobId") REFERENCES "MediaBlob"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MediaAsset" ADD CONSTRAINT "MediaAsset_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MediaAssetReference" ADD CONSTRAINT "MediaAssetReference_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "MediaAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MediaAssetReference" ADD CONSTRAINT "MediaAssetReference_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MediaAssetReference" ADD CONSTRAINT "MediaAssetReference_bankActivityId_fkey" FOREIGN KEY ("bankActivityId") REFERENCES "BankActivity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MediaAssetReference" ADD CONSTRAINT "MediaAssetReference_activityVersionId_fkey" FOREIGN KEY ("activityVersionId") REFERENCES "ActivityVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MediaAssetReference" ADD CONSTRAINT "MediaAssetReference_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MediaAssetReference" ADD CONSTRAINT "MediaAssetReference_testRevisionId_fkey" FOREIGN KEY ("testRevisionId") REFERENCES "TestRevision"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MediaAssetReference" ADD CONSTRAINT "MediaAssetReference_testRevisionItemId_fkey" FOREIGN KEY ("testRevisionItemId") REFERENCES "TestRevisionItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
