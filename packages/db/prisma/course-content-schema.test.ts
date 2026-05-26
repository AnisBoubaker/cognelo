import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const schema = readFileSync(new URL("./schema.prisma", import.meta.url), "utf8");
const migration = readFileSync(
  new URL("./migrations/202605260001_course_content_tree/migration.sql", import.meta.url),
  "utf8"
);

describe("course content tree schema foundation", () => {
  it("declares the shared course content item model and kind enum", () => {
    expect(schema).toContain("model CourseContentItem");
    expect(schema).toContain("enum CourseContentItemKind");
  });

  it("supports folders, materials, and activities as content item kinds", () => {
    expect(schema).toContain("folder");
    expect(schema).toContain("material");
    expect(schema).toContain("activity");
  });

  it("ships a migration for the course content table and key relationships", () => {
    expect(migration).toContain('CREATE TYPE "CourseContentItemKind" AS ENUM');
    expect(migration).toContain('CREATE TABLE "CourseContentItem"');
    expect(migration).toContain('"isVisible" BOOLEAN NOT NULL DEFAULT true');
    expect(migration).toContain('CONSTRAINT "CourseContentItem_parentId_fkey"');
    expect(migration).toContain('CONSTRAINT "CourseContentItem_materialId_fkey"');
    expect(migration).toContain('CONSTRAINT "CourseContentItem_activityId_fkey"');
    expect(migration).toContain('CONSTRAINT "CourseContentItem_courseGroupActivityId_fkey"');
  });
});
