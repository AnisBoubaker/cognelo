import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const schema = readFileSync(new URL("./schema.prisma", import.meta.url), "utf8");
const migration = readFileSync(
  new URL("./migrations/202609240003_subject_programming_language/migration.sql", import.meta.url),
  "utf8"
);

describe("subject programming language schema", () => {
  it("stores an optional default for newly created programming exercises", () => {
    expect(schema).toContain("programmingLanguage    String?");
    expect(migration).toContain('ADD COLUMN "programmingLanguage" TEXT');
  });
});
