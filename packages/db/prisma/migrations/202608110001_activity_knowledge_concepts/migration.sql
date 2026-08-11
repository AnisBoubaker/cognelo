CREATE TABLE "BankActivityKnowledgeConcept" (
    "bankActivityId" TEXT NOT NULL,
    "conceptId" TEXT NOT NULL,
    CONSTRAINT "BankActivityKnowledgeConcept_pkey" PRIMARY KEY ("bankActivityId", "conceptId")
);

CREATE TABLE "ActivityVersionKnowledgeConcept" (
    "activityVersionId" TEXT NOT NULL,
    "conceptId" TEXT NOT NULL,
    CONSTRAINT "ActivityVersionKnowledgeConcept_pkey" PRIMARY KEY ("activityVersionId", "conceptId")
);

CREATE TABLE "ActivityKnowledgeConcept" (
    "activityId" TEXT NOT NULL,
    "conceptId" TEXT NOT NULL,
    CONSTRAINT "ActivityKnowledgeConcept_pkey" PRIMARY KEY ("activityId", "conceptId")
);

CREATE INDEX "BankActivityKnowledgeConcept_conceptId_idx" ON "BankActivityKnowledgeConcept"("conceptId");
CREATE INDEX "ActivityVersionKnowledgeConcept_conceptId_idx" ON "ActivityVersionKnowledgeConcept"("conceptId");
CREATE INDEX "ActivityKnowledgeConcept_conceptId_idx" ON "ActivityKnowledgeConcept"("conceptId");

ALTER TABLE "BankActivityKnowledgeConcept" ADD CONSTRAINT "BankActivityKnowledgeConcept_bankActivityId_fkey" FOREIGN KEY ("bankActivityId") REFERENCES "BankActivity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BankActivityKnowledgeConcept" ADD CONSTRAINT "BankActivityKnowledgeConcept_conceptId_fkey" FOREIGN KEY ("conceptId") REFERENCES "SubjectKnowledgeConcept"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ActivityVersionKnowledgeConcept" ADD CONSTRAINT "ActivityVersionKnowledgeConcept_activityVersionId_fkey" FOREIGN KEY ("activityVersionId") REFERENCES "ActivityVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ActivityVersionKnowledgeConcept" ADD CONSTRAINT "ActivityVersionKnowledgeConcept_conceptId_fkey" FOREIGN KEY ("conceptId") REFERENCES "SubjectKnowledgeConcept"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ActivityKnowledgeConcept" ADD CONSTRAINT "ActivityKnowledgeConcept_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ActivityKnowledgeConcept" ADD CONSTRAINT "ActivityKnowledgeConcept_conceptId_fkey" FOREIGN KEY ("conceptId") REFERENCES "SubjectKnowledgeConcept"("id") ON DELETE CASCADE ON UPDATE CASCADE;
