import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const schema = readFileSync(new URL("./schema.prisma", import.meta.url), "utf8");
const migration = readFileSync(
  new URL("./migrations/202606180001_background_jobs/migration.sql", import.meta.url),
  "utf8"
);

describe("background jobs schema", () => {
  it("declares the shared background job model and status enum", () => {
    expect(schema).toContain("enum BackgroundJobStatus");
    expect(schema).toContain("model BackgroundJob");
    expect(schema).toContain("@@unique([queue, idempotencyKey])");
  });

  it("ships a migration for the durable queue table", () => {
    expect(migration).toContain('CREATE TYPE "BackgroundJobStatus"');
    expect(migration).toContain('CREATE TABLE "BackgroundJob"');
    expect(migration).toContain('CREATE UNIQUE INDEX "BackgroundJob_queue_idempotencyKey_key"');
    expect(migration).toContain('CREATE INDEX "BackgroundJob_queue_status_runAfter_idx"');
  });
});
