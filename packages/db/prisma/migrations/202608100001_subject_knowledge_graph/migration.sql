CREATE TABLE "SubjectKnowledgeConcept" (
    "id" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "positionX" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "positionY" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SubjectKnowledgeConcept_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SubjectKnowledgePrerequisite" (
    "id" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "sourceConceptId" TEXT NOT NULL,
    "requiredConceptId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SubjectKnowledgePrerequisite_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SubjectKnowledgeConcept_subjectId_idx" ON "SubjectKnowledgeConcept"("subjectId");
CREATE INDEX "SubjectKnowledgePrerequisite_subjectId_idx" ON "SubjectKnowledgePrerequisite"("subjectId");
CREATE INDEX "SubjectKnowledgePrerequisite_requiredConceptId_idx" ON "SubjectKnowledgePrerequisite"("requiredConceptId");
CREATE UNIQUE INDEX "SubjectKnowledgePrerequisite_sourceConceptId_requiredConceptId_key" ON "SubjectKnowledgePrerequisite"("sourceConceptId", "requiredConceptId");

ALTER TABLE "SubjectKnowledgeConcept" ADD CONSTRAINT "SubjectKnowledgeConcept_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SubjectKnowledgePrerequisite" ADD CONSTRAINT "SubjectKnowledgePrerequisite_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SubjectKnowledgePrerequisite" ADD CONSTRAINT "SubjectKnowledgePrerequisite_sourceConceptId_fkey" FOREIGN KEY ("sourceConceptId") REFERENCES "SubjectKnowledgeConcept"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SubjectKnowledgePrerequisite" ADD CONSTRAINT "SubjectKnowledgePrerequisite_requiredConceptId_fkey" FOREIGN KEY ("requiredConceptId") REFERENCES "SubjectKnowledgeConcept"("id") ON DELETE CASCADE ON UPDATE CASCADE;
