ALTER TABLE "MediaAssetReference" ADD COLUMN "contentResourceId" TEXT;
ALTER TABLE "MediaAssetReference" DROP CONSTRAINT "MediaAssetReference_one_owner_check";
ALTER TABLE "MediaAssetReference" ADD CONSTRAINT "MediaAssetReference_one_owner_check" CHECK (
  num_nonnulls("subjectId", "bankActivityId", "activityVersionId", "activityId", "testRevisionId", "testRevisionItemId", "contentResourceId") = 1
);
ALTER TABLE "MediaAssetReference" ADD CONSTRAINT "MediaAssetReference_contentResourceId_fkey" FOREIGN KEY ("contentResourceId") REFERENCES "CourseContentResource"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE UNIQUE INDEX "MediaAssetReference_contentResourceId_fieldKey_assetId_key" ON "MediaAssetReference"("contentResourceId", "fieldKey", "assetId");
CREATE INDEX "MediaAssetReference_contentResourceId_idx" ON "MediaAssetReference"("contentResourceId");
