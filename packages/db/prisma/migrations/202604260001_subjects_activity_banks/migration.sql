CREATE TABLE "Subject" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL DEFAULT '',
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Subject_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SubjectMaterial" (
  "id" TEXT NOT NULL,
  "subjectId" TEXT NOT NULL,
  "parentId" TEXT,
  "title" TEXT NOT NULL,
  "kind" "MaterialKind" NOT NULL,
  "body" TEXT,
  "url" TEXT,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "position" INTEGER NOT NULL DEFAULT 0,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SubjectMaterial_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ActivityBank" (
  "id" TEXT NOT NULL,
  "subjectId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL DEFAULT '',
  "ownerId" TEXT NOT NULL,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ActivityBank_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Course" ADD COLUMN "subjectId" TEXT;

INSERT INTO "Subject" ("id", "title", "description", "createdById", "updatedAt")
SELECT 'migration-subject-default', 'Default subject', 'Default subject created for existing courses.', "createdById", CURRENT_TIMESTAMP
FROM "Course"
ORDER BY "createdAt" ASC
LIMIT 1;

UPDATE "Course"
SET "subjectId" = 'migration-subject-default'
WHERE "subjectId" IS NULL AND EXISTS (SELECT 1 FROM "Subject" WHERE "id" = 'migration-subject-default');

ALTER TABLE "Course" ALTER COLUMN "subjectId" SET NOT NULL;

CREATE INDEX "Course_subjectId_idx" ON "Course"("subjectId");
CREATE INDEX "Subject_createdById_idx" ON "Subject"("createdById");
CREATE INDEX "Subject_updatedAt_idx" ON "Subject"("updatedAt");
CREATE INDEX "SubjectMaterial_subjectId_position_idx" ON "SubjectMaterial"("subjectId", "position");
CREATE INDEX "SubjectMaterial_subjectId_parentId_position_idx" ON "SubjectMaterial"("subjectId", "parentId", "position");
CREATE INDEX "SubjectMaterial_kind_idx" ON "SubjectMaterial"("kind");
CREATE INDEX "ActivityBank_subjectId_updatedAt_idx" ON "ActivityBank"("subjectId", "updatedAt");
CREATE INDEX "ActivityBank_ownerId_idx" ON "ActivityBank"("ownerId");

ALTER TABLE "Course" ADD CONSTRAINT "Course_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Subject" ADD CONSTRAINT "Subject_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SubjectMaterial" ADD CONSTRAINT "SubjectMaterial_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SubjectMaterial" ADD CONSTRAINT "SubjectMaterial_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SubjectMaterial" ADD CONSTRAINT "SubjectMaterial_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "SubjectMaterial"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ActivityBank" ADD CONSTRAINT "ActivityBank_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ActivityBank" ADD CONSTRAINT "ActivityBank_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
