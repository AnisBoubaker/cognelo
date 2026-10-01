-- Existing concepts intentionally keep NULL here. Application reads NULL as
-- no misconceptions, while every subsequent graph save writes an array.
ALTER TABLE "SubjectKnowledgeConcept" ADD COLUMN "misconceptions" JSONB;

CREATE TABLE "SubjectKnowledgeMisconception" (
    "id" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "conceptId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SubjectKnowledgeMisconception_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SubjectKnowledgeMisconception_conceptId_position_idx" ON "SubjectKnowledgeMisconception"("conceptId", "position");
CREATE INDEX "SubjectKnowledgeMisconception_subjectId_active_idx" ON "SubjectKnowledgeMisconception"("subjectId", "active");
CREATE INDEX "SubjectKnowledgeMisconception_conceptId_active_idx" ON "SubjectKnowledgeMisconception"("conceptId", "active");

ALTER TABLE "SubjectKnowledgeMisconception" ADD CONSTRAINT "SubjectKnowledgeMisconception_subjectId_fkey"
FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SubjectKnowledgeMisconception" ADD CONSTRAINT "SubjectKnowledgeMisconception_conceptId_fkey"
FOREIGN KEY ("conceptId") REFERENCES "SubjectKnowledgeConcept"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BankActivityKnowledgeConcept"
ADD COLUMN "selectedMisconceptions" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN "selectedMisconceptionIds" JSONB NOT NULL DEFAULT '[]';

ALTER TABLE "ActivityVersionKnowledgeConcept"
ADD COLUMN "selectedMisconceptions" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN "selectedMisconceptionIds" JSONB NOT NULL DEFAULT '[]';

ALTER TABLE "ActivityKnowledgeConcept"
ADD COLUMN "selectedMisconceptions" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN "selectedMisconceptionIds" JSONB NOT NULL DEFAULT '[]';
