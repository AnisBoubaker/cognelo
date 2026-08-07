import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const schema = readFileSync(new URL("./schema.prisma", import.meta.url), "utf8");
const migration = readFileSync(
  new URL("./migrations/202608070001_compound_tests_foundation/migration.sql", import.meta.url),
  "utf8"
);
const executionMigration = readFileSync(
  new URL("./migrations/202608070002_compound_test_execution/migration.sql", import.meta.url),
  "utf8"
);

describe("compound Test schema foundation", () => {
  it("distinguishes core and plugin activity providers", () => {
    expect(schema).toContain("enum ActivityProviderKind");
    expect(schema).toContain("providerKind     ActivityProviderKind");
    expect(schema).toContain("providerKey      String?");
    expect(migration).toContain('CREATE TYPE "ActivityProviderKind" AS ENUM (\'core\', \'plugin\')');
  });

  it("declares normalized Test and TestItem models", () => {
    expect(schema).toContain("model Test {");
    expect(schema).toContain("model TestItem {");
    expect(schema).toContain('activity   Activity   @relation("TestShellActivity"');
    expect(schema).toContain('activity       Activity @relation("TestItemActivity"');
  });

  it("ships relational and value constraints for Test composition", () => {
    expect(migration).toContain('CREATE TABLE "Test"');
    expect(migration).toContain('CREATE TABLE "TestItem"');
    expect(migration).toContain('CREATE UNIQUE INDEX "Test_activityId_key"');
    expect(migration).toContain('CREATE UNIQUE INDEX "TestItem_activityId_key"');
    expect(migration).toContain('CONSTRAINT "TestItem_position_nonnegative"');
    expect(migration).toContain('CONSTRAINT "TestItem_points_positive"');
    expect(migration).toContain('CONSTRAINT "TestItem_testId_fkey"');
    expect(migration).toContain('CONSTRAINT "TestItem_activityId_fkey"');
  });

  it("persists one child execution record per Test item and parent attempt", () => {
    expect(schema).toContain("model TestItemAttempt {");
    expect(schema).toContain("@@unique([parentAttemptId, testItemId])");
    expect(executionMigration).toContain('CREATE TABLE "TestItemAttempt"');
    expect(executionMigration).toContain('CREATE UNIQUE INDEX "TestItemAttempt_parentAttemptId_testItemId_key"');
    expect(executionMigration).toContain('CONSTRAINT "TestItemAttempt_parentAttemptId_fkey"');
    expect(executionMigration).toContain('CONSTRAINT "TestItemAttempt_testItemId_fkey"');
  });
});
