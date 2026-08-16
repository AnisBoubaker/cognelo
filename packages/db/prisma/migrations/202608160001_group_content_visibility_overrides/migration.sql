CREATE TABLE "CourseGroupContentVisibilityOverride" (
    "groupId" TEXT NOT NULL,
    "contentItemId" TEXT NOT NULL,
    "isVisible" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CourseGroupContentVisibilityOverride_pkey" PRIMARY KEY ("groupId", "contentItemId")
);

CREATE INDEX "CourseGroupContentVisibilityOverride_contentItemId_idx"
ON "CourseGroupContentVisibilityOverride"("contentItemId");

ALTER TABLE "CourseGroupContentVisibilityOverride"
ADD CONSTRAINT "CourseGroupContentVisibilityOverride_groupId_fkey"
FOREIGN KEY ("groupId") REFERENCES "CourseGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CourseGroupContentVisibilityOverride"
ADD CONSTRAINT "CourseGroupContentVisibilityOverride_contentItemId_fkey"
FOREIGN KEY ("contentItemId") REFERENCES "CourseContentItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
