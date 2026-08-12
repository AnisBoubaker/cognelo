import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const schema = readFileSync(new URL("./schema.prisma", import.meta.url), "utf8");
const migration = readFileSync(
  new URL("./migrations/202608100001_subject_knowledge_graph/migration.sql", import.meta.url),
  "utf8"
);
const edgeHandleMigration = readFileSync(
  new URL("./migrations/202608100002_subject_knowledge_edge_handles/migration.sql", import.meta.url),
  "utf8"
);
const skillsMigration = readFileSync(
  new URL("./migrations/202608110002_rename_concept_description_to_skills/migration.sql", import.meta.url),
  "utf8"
);
const stableSkillsMigration = readFileSync(
  new URL("./migrations/202608120001_stable_subject_skills/migration.sql", import.meta.url),
  "utf8"
);

describe("subject knowledge graph schema", () => {
  it("stores subject-scoped concepts and directed prerequisites", () => {
    expect(schema).toContain("model SubjectKnowledgeConcept");
    expect(schema).toContain("model SubjectKnowledgePrerequisite");
    expect(schema).toContain("sourceConceptId");
    expect(schema).toContain("requiredConceptId");
    expect(schema).toContain("sourceHandle");
    expect(schema).toContain("targetHandle");
  });

  it("ships the graph tables, unique edge constraint, and cascading relationships", () => {
    expect(migration).toContain('CREATE TABLE "SubjectKnowledgeConcept"');
    expect(migration).toContain('CREATE TABLE "SubjectKnowledgePrerequisite"');
    expect(migration).toContain('"sourceConceptId", "requiredConceptId"');
    expect(migration).toContain('REFERENCES "Subject"("id") ON DELETE CASCADE');
    expect(migration).toContain('REFERENCES "SubjectKnowledgeConcept"("id") ON DELETE CASCADE');
  });

  it("persists manually arranged edge endpoints", () => {
    expect(edgeHandleMigration).toContain('ADD COLUMN "sourceHandle" TEXT');
    expect(edgeHandleMigration).toContain('ADD COLUMN "targetHandle" TEXT');
  });

  it("stores newline-delimited concept skills under the canonical field name", () => {
    expect(schema).toContain("skills                String");
    expect(skillsMigration).toContain('RENAME COLUMN "description" TO "skills"');
  });

  it("normalizes skills to stable identities while retaining the compatibility text projection", () => {
    expect(schema).toContain("model SubjectKnowledgeSkill");
    expect(schema).toContain("skillRecords          SubjectKnowledgeSkill[]");
    expect(stableSkillsMigration).toContain('CREATE TABLE "SubjectKnowledgeSkill"');
    expect(stableSkillsMigration).toContain('INSERT INTO "SubjectKnowledgeSkill"');
  });

});
