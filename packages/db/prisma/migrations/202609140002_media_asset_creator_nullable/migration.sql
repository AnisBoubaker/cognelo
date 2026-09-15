ALTER TABLE "MediaAsset" DROP CONSTRAINT "MediaAsset_createdById_fkey";

ALTER TABLE "MediaAsset" ALTER COLUMN "createdById" DROP NOT NULL;

ALTER TABLE "MediaAsset" ADD CONSTRAINT "MediaAsset_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
