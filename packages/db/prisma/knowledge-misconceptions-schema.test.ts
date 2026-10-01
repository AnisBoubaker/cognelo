import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const schema = readFileSync(new URL("./schema.prisma", import.meta.url), "utf8");
const migration = readFileSync(
  new URL("./migrations/202609300001_knowledge_misconceptions/migration.sql", import.meta.url),
  "utf8"
);

describe("knowledge misconception persistence", () => {
  it("keeps the legacy projection nullable and snapshots activity selections", () => {
    expect(schema).toMatch(/misconceptions\s+Json\?/);
    expect(schema).toContain("model SubjectKnowledgeMisconception");
    expect(schema.match(/selectedMisconceptionIds\s+Json/g)).toHaveLength(3);
    expect(migration).toContain('ADD COLUMN "misconceptions" JSONB');
    expect(migration).toContain('ADD COLUMN "selectedMisconceptionIds" JSONB NOT NULL DEFAULT \'[]\'');
  });
});
