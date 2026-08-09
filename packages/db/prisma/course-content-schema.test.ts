import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const schema = readFileSync(new URL("./schema.prisma", import.meta.url), "utf8");
const migration = readFileSync(
  new URL("./migrations/202605260001_course_content_tree/migration.sql", import.meta.url),
  "utf8"
);
const placementMigration = readFileSync(
  new URL("./migrations/202608090001_inherit_course_wide_activity_placement/migration.sql", import.meta.url),
  "utf8"
);

describe("course content tree schema foundation", () => {
  it("declares the shared course content item model and kind enum", () => {
    expect(schema).toContain("model CourseContentItem");
    expect(schema).toContain("enum CourseContentItemKind");
  });

  it("supports folders, plugin-backed content, and activities as content item kinds", () => {
    expect(schema).toContain("folder");
    expect(schema).toContain("content");
    expect(schema).toContain("activity");
  });

  it("ships migrations for the course content table, content resources, and key relationships", () => {
    const contentTypeMigration = readFileSync(
      new URL("./migrations/202605270001_content_type_plugins_foundation/migration.sql", import.meta.url),
      "utf8"
    );

    expect(migration).toContain('CREATE TYPE "CourseContentItemKind" AS ENUM');
    expect(migration).toContain('CREATE TABLE "CourseContentItem"');
    expect(migration).toContain('"isVisible" BOOLEAN NOT NULL DEFAULT true');
    expect(migration).toContain('CONSTRAINT "CourseContentItem_parentId_fkey"');
    expect(migration).toContain('CONSTRAINT "CourseContentItem_materialId_fkey"');
    expect(migration).toContain('CONSTRAINT "CourseContentItem_activityId_fkey"');
    expect(migration).toContain('CONSTRAINT "CourseContentItem_courseGroupActivityId_fkey"');
    expect(contentTypeMigration).toContain("CREATE TABLE \"ContentTypePluginInstallation\"");
    expect(contentTypeMigration).toContain("CREATE TABLE \"ContentTypePluginTableBackup\"");
    expect(contentTypeMigration).toContain("CREATE TABLE \"CourseContentResource\"");
    expect(contentTypeMigration).toContain("\"contentResourceId\" TEXT");
    expect(contentTypeMigration).toContain("ContentTypePluginTableBackup_pluginKey_fkey");
    expect(contentTypeMigration).toContain("CourseContentItem_contentResourceId_fkey");
  });

  it("restores legacy all-groups activity rows to their course folder placement", () => {
    expect(placementMigration).toContain('UPDATE "CourseContentItem" AS "groupItem"');
    expect(placementMigration).toContain("metadata\"->>'assignmentScope' = 'course_all_groups'");
    expect(placementMigration).toContain('"parentId" = "courseItem"."parentId"');
    expect(placementMigration).toContain('"position" = "courseItem"."position"');
  });
});
