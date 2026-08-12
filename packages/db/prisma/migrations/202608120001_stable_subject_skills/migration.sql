ALTER TABLE "SubjectKnowledgeConcept"
  ADD COLUMN "active" BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE "SubjectKnowledgeSkill" (
  "id" TEXT NOT NULL,
  "subjectId" TEXT NOT NULL,
  "conceptId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "position" INTEGER NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SubjectKnowledgeSkill_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SubjectKnowledgeSkill_conceptId_position_idx" ON "SubjectKnowledgeSkill"("conceptId", "position");
CREATE INDEX "SubjectKnowledgeSkill_subjectId_active_idx" ON "SubjectKnowledgeSkill"("subjectId", "active");
CREATE INDEX "SubjectKnowledgeSkill_conceptId_active_idx" ON "SubjectKnowledgeSkill"("conceptId", "active");

ALTER TABLE "SubjectKnowledgeSkill"
  ADD CONSTRAINT "SubjectKnowledgeSkill_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "SubjectKnowledgeSkill_conceptId_fkey" FOREIGN KEY ("conceptId") REFERENCES "SubjectKnowledgeConcept"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "SubjectKnowledgeSkill" ("id", "subjectId", "conceptId", "title", "position", "createdAt", "updatedAt")
SELECT
  'skill_' || md5(concept."id" || E'\n' || skill.title || E'\n' || skill.ordinality::text),
  concept."subjectId",
  concept."id",
  skill.title,
  skill.ordinality - 1,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "SubjectKnowledgeConcept" concept
CROSS JOIN LATERAL (
  SELECT btrim(value) AS title, ordinality::integer
  FROM regexp_split_to_table(concept."skills", E'\r?\n') WITH ORDINALITY AS lines(value, ordinality)
  WHERE btrim(value) <> ''
) skill;

ALTER TABLE "BankActivityKnowledgeConcept"
  ADD COLUMN "selectedSkillIds" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "ActivityVersionKnowledgeConcept"
  ADD COLUMN "selectedSkillIds" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "ActivityKnowledgeConcept"
  ADD COLUMN "selectedSkillIds" JSONB NOT NULL DEFAULT '[]';

UPDATE "BankActivityKnowledgeConcept" link
SET "selectedSkillIds" = COALESCE((
  SELECT jsonb_agg(skill."id" ORDER BY skill."position")
  FROM "SubjectKnowledgeSkill" skill
  WHERE skill."conceptId" = link."conceptId"
    AND (link."selectsAllSkills" OR link."selectedSkills" ? skill."title")
), '[]'::jsonb);

UPDATE "ActivityVersionKnowledgeConcept" link
SET "selectedSkillIds" = COALESCE((
  SELECT jsonb_agg(skill."id" ORDER BY skill."position")
  FROM "SubjectKnowledgeSkill" skill
  WHERE skill."conceptId" = link."conceptId"
    AND (link."selectsAllSkills" OR link."selectedSkills" ? skill."title")
), '[]'::jsonb),
"selectedSkills" = COALESCE((
  SELECT jsonb_agg(skill."title" ORDER BY skill."position")
  FROM "SubjectKnowledgeSkill" skill
  WHERE skill."conceptId" = link."conceptId"
    AND (link."selectsAllSkills" OR link."selectedSkills" ? skill."title")
), '[]'::jsonb);

UPDATE "ActivityKnowledgeConcept" link
SET "selectedSkillIds" = COALESCE((
  SELECT jsonb_agg(skill."id" ORDER BY skill."position")
  FROM "SubjectKnowledgeSkill" skill
  WHERE skill."conceptId" = link."conceptId"
    AND (link."selectsAllSkills" OR link."selectedSkills" ? skill."title")
), '[]'::jsonb);
