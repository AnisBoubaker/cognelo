import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const schema = readFileSync(new URL("./schema.prisma", import.meta.url), "utf8");
const migration = readFileSync(
  new URL("./migrations/202608110001_activity_knowledge_concepts/migration.sql", import.meta.url),
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
});
