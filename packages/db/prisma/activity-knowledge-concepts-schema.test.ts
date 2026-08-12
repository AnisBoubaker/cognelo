import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const schema = readFileSync(new URL("./schema.prisma", import.meta.url), "utf8");
const migration = readFileSync(
  new URL("./migrations/202608110001_activity_knowledge_concepts/migration.sql", import.meta.url),
  "utf8"
);
const skillSelectionMigration = readFileSync(
  new URL("./migrations/202608110003_activity_concept_skill_selections/migration.sql", import.meta.url),
  "utf8"
);
const stableSkillsMigration = readFileSync(
  new URL("./migrations/202608120001_stable_subject_skills/migration.sql", import.meta.url),
  "utf8"
);

describe("activity knowledge concept links", () => {
  it("models current bank, immutable version, and course-copy links", () => {
    expect(schema).toContain("model BankActivityKnowledgeConcept");
    expect(schema).toContain("model ActivityVersionKnowledgeConcept");
    expect(schema).toContain("model ActivityKnowledgeConcept");
  });

  it("ships cascading foreign keys for activity and concept deletion", () => {
    expect(migration).toContain('REFERENCES "BankActivity"("id") ON DELETE CASCADE');
    expect(migration).toContain('REFERENCES "ActivityVersion"("id") ON DELETE CASCADE');
    expect(migration).toContain('REFERENCES "Activity"("id") ON DELETE CASCADE');
    expect(migration.match(/REFERENCES "SubjectKnowledgeConcept"\("id"\) ON DELETE CASCADE/g)).toHaveLength(3);
  });

  it("distinguishes whole-concept selection from explicit skill selection", () => {
    expect(schema.match(/selectsAllSkills/g)).toHaveLength(3);
    expect(schema.match(/selectedSkills/g)).toHaveLength(3);
    expect(skillSelectionMigration.match(/ADD COLUMN "selectsAllSkills"/g)).toHaveLength(3);
    expect(skillSelectionMigration.match(/ADD COLUMN "selectedSkills"/g)).toHaveLength(3);
  });

  it("stores stable skill identifiers beside title snapshots", () => {
    expect(schema.match(/selectedSkillIds/g)).toHaveLength(3);
    expect(stableSkillsMigration.match(/ADD COLUMN "selectedSkillIds"/g)).toHaveLength(3);
  });
});
