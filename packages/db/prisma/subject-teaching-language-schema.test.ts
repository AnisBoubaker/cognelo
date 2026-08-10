import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const schema = readFileSync(new URL("./schema.prisma", import.meta.url), "utf8");
const migration = readFileSync(
  new URL("./migrations/202608100003_subject_teaching_language/migration.sql", import.meta.url),
  "utf8"
);

describe("subject teaching language schema", () => {
  it("stores a backwards-compatible teaching language", () => {
    expect(schema).toContain('teachingLanguage       String                         @default("en")');
    expect(migration).toContain('ADD COLUMN "teachingLanguage" TEXT NOT NULL DEFAULT \'en\'');
  });
});
