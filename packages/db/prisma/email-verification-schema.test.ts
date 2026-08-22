import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const schema = readFileSync(new URL("./schema.prisma", import.meta.url), "utf8");
const migration = readFileSync(
  new URL("./migrations/202608220002_email_verification/migration.sql", import.meta.url),
  "utf8"
);

describe("first-login email verification schema", () => {
  it("stores verification state and one challenge per user", () => {
    expect(schema).toContain("emailVerifiedAt");
    expect(schema).toContain("model EmailVerificationChallenge");
    expect(schema).toContain("failedAttempts Int      @default(0)");
  });

  it("grandfathers existing users and creates the challenge table", () => {
    expect(migration).toContain('UPDATE "User" SET "emailVerifiedAt" = CURRENT_TIMESTAMP');
    expect(migration).toContain('CREATE TABLE "EmailVerificationChallenge"');
    expect(migration).toContain('REFERENCES "User"("id") ON DELETE CASCADE');
  });
});
