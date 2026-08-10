import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const schema = readFileSync(new URL("./schema.prisma", import.meta.url), "utf8");
const migration = readFileSync(
  new URL("./migrations/202608100001_subject_knowledge_graph/migration.sql", import.meta.url),
  "utf8"
);

describe("subject knowledge graph schema", () => {
  it("stores subject-scoped concepts and directed prerequisites", () => {
    expect(schema).toContain("model SubjectKnowledgeConcept");
    expect(schema).toContain("model SubjectKnowledgePrerequisite");
    expect(schema).toContain("sourceConceptId");
    expect(schema).toContain("requiredConceptId");
  });

  it("ships the graph tables, unique edge constraint, and cascading relationships", () => {
    expect(migration).toContain('CREATE TABLE "SubjectKnowledgeConcept"');
    expect(migration).toContain('CREATE TABLE "SubjectKnowledgePrerequisite"');
    expect(migration).toContain('"sourceConceptId", "requiredConceptId"');
    expect(migration).toContain('REFERENCES "Subject"("id") ON DELETE CASCADE');
    expect(migration).toContain('REFERENCES "SubjectKnowledgeConcept"("id") ON DELETE CASCADE');
  });
});
