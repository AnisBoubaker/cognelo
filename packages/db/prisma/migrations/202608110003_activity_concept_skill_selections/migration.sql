ALTER TABLE "BankActivityKnowledgeConcept"
  ADD COLUMN "selectsAllSkills" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "selectedSkills" JSONB NOT NULL DEFAULT '[]';

ALTER TABLE "ActivityVersionKnowledgeConcept"
  ADD COLUMN "selectsAllSkills" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "selectedSkills" JSONB NOT NULL DEFAULT '[]';

ALTER TABLE "ActivityKnowledgeConcept"
  ADD COLUMN "selectsAllSkills" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "selectedSkills" JSONB NOT NULL DEFAULT '[]';
