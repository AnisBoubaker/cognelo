CREATE TABLE "CourseGroupHiddenCourseMaterial" (
  "groupId" TEXT NOT NULL,
  "courseMaterialId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "CourseGroupHiddenCourseMaterial_pkey" PRIMARY KEY ("groupId", "courseMaterialId"),
  CONSTRAINT "CourseGroupHiddenCourseMaterial_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "CourseGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "CourseGroupHiddenCourseMaterial_courseMaterialId_fkey" FOREIGN KEY ("courseMaterialId") REFERENCES "CourseMaterial"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "CourseGroupHiddenCourseMaterial_courseMaterialId_idx"
  ON "CourseGroupHiddenCourseMaterial"("courseMaterialId");
