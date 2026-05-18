import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const schema = readFileSync(new URL("./schema.prisma", import.meta.url), "utf8");
const migration = readFileSync(
  new URL("./migrations/202605180001_gradebook_foundation/migration.sql", import.meta.url),
  "utf8"
);

describe("gradebook schema foundation", () => {
  it("declares the core gradebook models", () => {
    expect(schema).toContain("model GradebookItem");
    expect(schema).toContain("model ActivityAttempt");
    expect(schema).toContain("model Grade");
    expect(schema).toContain("model GradeEvent");
  });

  it("declares the gradebook enums used by the core models", () => {
    expect(schema).toContain("enum GradebookGradingMode");
    expect(schema).toContain("enum GradebookAttemptLimitMode");
    expect(schema).toContain("enum GradebookGradeStrategy");
    expect(schema).toContain("enum ActivityAttemptLifecycle");
    expect(schema).toContain("enum GradeSource");
    expect(schema).toContain("enum GradeEventType");
  });

  it("ships a migration for the gradebook tables and participant-scoped grade uniqueness", () => {
    expect(migration).toContain('CREATE TABLE "GradebookItem"');
    expect(migration).toContain('CREATE TABLE "ActivityAttempt"');
    expect(migration).toContain('CREATE TABLE "Grade"');
    expect(migration).toContain('CREATE TABLE "GradeEvent"');
    expect(migration).toContain(
      'CREATE UNIQUE INDEX "Grade_gradebookItemId_participantId_key" ON "Grade"("gradebookItemId", "participantId")'
    );
    expect(migration).toContain(
      'CREATE UNIQUE INDEX "ActivityAttempt_gradebookItemId_participantId_attemptNumber_key" ON "ActivityAttempt"("gradebookItemId", "participantId", "attemptNumber")'
    );
  });
});
