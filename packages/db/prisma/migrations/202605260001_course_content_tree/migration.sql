-- CreateEnum
CREATE TYPE "CourseContentItemKind" AS ENUM ('folder', 'material', 'activity');

-- CreateTable
CREATE TABLE "CourseContentItem" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "groupId" TEXT,
    "parentId" TEXT,
    "kind" "CourseContentItemKind" NOT NULL,
    "titleSnapshot" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "isVisible" BOOLEAN NOT NULL DEFAULT true,
    "materialId" TEXT,
    "activityId" TEXT,
    "courseGroupActivityId" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CourseContentItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CourseContentItem_courseId_groupId_parentId_position_idx" ON "CourseContentItem"("courseId", "groupId", "parentId", "position");

-- CreateIndex
CREATE INDEX "CourseContentItem_courseId_parentId_position_idx" ON "CourseContentItem"("courseId", "parentId", "position");

-- CreateIndex
CREATE INDEX "CourseContentItem_groupId_parentId_position_idx" ON "CourseContentItem"("groupId", "parentId", "position");

-- CreateIndex
CREATE INDEX "CourseContentItem_parentId_idx" ON "CourseContentItem"("parentId");

-- CreateIndex
CREATE INDEX "CourseContentItem_kind_idx" ON "CourseContentItem"("kind");

-- CreateIndex
CREATE INDEX "CourseContentItem_isVisible_idx" ON "CourseContentItem"("isVisible");

-- CreateIndex
CREATE INDEX "CourseContentItem_materialId_idx" ON "CourseContentItem"("materialId");

-- CreateIndex
CREATE INDEX "CourseContentItem_activityId_idx" ON "CourseContentItem"("activityId");

-- CreateIndex
CREATE INDEX "CourseContentItem_courseGroupActivityId_idx" ON "CourseContentItem"("courseGroupActivityId");

-- AddForeignKey
ALTER TABLE "CourseContentItem" ADD CONSTRAINT "CourseContentItem_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseContentItem" ADD CONSTRAINT "CourseContentItem_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "CourseGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseContentItem" ADD CONSTRAINT "CourseContentItem_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "CourseContentItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseContentItem" ADD CONSTRAINT "CourseContentItem_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "CourseMaterial"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseContentItem" ADD CONSTRAINT "CourseContentItem_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseContentItem" ADD CONSTRAINT "CourseContentItem_courseGroupActivityId_fkey" FOREIGN KEY ("courseGroupActivityId") REFERENCES "CourseGroupActivity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
