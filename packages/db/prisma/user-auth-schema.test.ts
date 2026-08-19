import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const schema = readFileSync(new URL("./schema.prisma", import.meta.url), "utf8");
const migration = readFileSync(
  new URL("./migrations/202608170001_forced_password_change/migration.sql", import.meta.url),
  "utf8"
);

describe("user forced-password-change schema", () => {
  it("persists password-change requirements and token invalidation versions", () => {
    expect(schema).toContain("mustChangePassword      Boolean                  @default(false)");
    expect(schema).toContain("authVersion             Int                      @default(0)");
  });

  it("ships the corresponding user migration", () => {
    expect(migration).toContain('ADD COLUMN "mustChangePassword" BOOLEAN NOT NULL DEFAULT false');
    expect(migration).toContain('ADD COLUMN "authVersion" INTEGER NOT NULL DEFAULT 0');
  });
});
