import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const schema = readFileSync(new URL("./schema.prisma", import.meta.url), "utf8");
const migration = readFileSync(
  new URL("./migrations/202609140001_media_assets/migration.sql", import.meta.url),
  "utf8"
);
const creatorMigration = readFileSync(
  new URL("./migrations/202609140002_media_asset_creator_nullable/migration.sql", import.meta.url),
  "utf8"
);

describe("media asset persistence", () => {
  it("separates immutable physical blobs from logical uploads and durable references", () => {
    expect(schema).toContain("model MediaBlob");
    expect(schema).toContain("sha256     String       @unique");
    expect(schema).toContain("model MediaAssetReference");
    expect(schema).toContain("activityVersionId  String?");
    expect(schema).toContain("testRevisionItemId String?");
  });

  it("shields polymorphic references with real foreign keys and a one-owner check", () => {
    expect(migration).toContain('CONSTRAINT "MediaAssetReference_one_owner_check"');
    expect(migration).toContain("num_nonnulls(");
    expect(creatorMigration).toContain('REFERENCES "User"("id") ON DELETE SET NULL');
    expect(migration).toContain('REFERENCES "ActivityVersion"("id") ON DELETE CASCADE');
    expect(migration).toContain('REFERENCES "TestRevisionItem"("id") ON DELETE CASCADE');
  });
});
