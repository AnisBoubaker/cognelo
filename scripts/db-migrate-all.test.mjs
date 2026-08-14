import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { coreMigrations, pluginSchemas, psqlDatabaseUrl, runAll } from "./db-migrate-all.mjs";

describe("db:migrate:all script helpers", () => {
  it("removes Prisma-only query parameters without corrupting the database name", () => {
    expect(
      psqlDatabaseUrl(
        "postgresql://cognelo_app1:secret@127.0.0.1:5432/cognelo_app1?schema=public&connection_limit=10&pool_timeout=10&sslmode=require"
      )
    ).toBe("postgresql://cognelo_app1:secret@127.0.0.1:5432/cognelo_app1?sslmode=require");
  });

  it("discovers only plugins that have Prisma schemas", () => {
    const root = mkdtempSync(join(tmpdir(), "cognelo-migrate-"));
    const pluginsDir = join(root, "packages/plugin-activities");
    mkdirSync(join(pluginsDir, "plugin-a/prisma"), { recursive: true });
    mkdirSync(join(pluginsDir, "plugin-b"), { recursive: true });
    mkdirSync(join(pluginsDir, "plugin-c/prisma"), { recursive: true });
    writeFileSync(join(pluginsDir, "plugin-a/prisma/schema.prisma"), "datasource db { provider = \"postgresql\" url = env(\"DATABASE_URL\") }");
    writeFileSync(join(pluginsDir, "plugin-c/prisma/schema.prisma"), "datasource db { provider = \"postgresql\" url = env(\"DATABASE_URL\") }");

    expect(pluginSchemas({ root, pluginsDir })).toEqual([
      "packages/plugin-activities/plugin-a/prisma/schema.prisma",
      "packages/plugin-activities/plugin-c/prisma/schema.prisma"
    ]);
  });

  it("orders core migrations by migration folder name", () => {
    const root = mkdtempSync(join(tmpdir(), "cognelo-core-migrations-"));
    const migrationsDir = join(root, "migrations");
    mkdirSync(join(migrationsDir, "202602010000_second"), { recursive: true });
    mkdirSync(join(migrationsDir, "202601010000_first"), { recursive: true });
    writeFileSync(join(migrationsDir, "202602010000_second/migration.sql"), "SELECT 2;");
    writeFileSync(join(migrationsDir, "202601010000_first/migration.sql"), "SELECT 1;");

    expect(coreMigrations({ coreMigrationsDir: migrationsDir }).map((migration) => migration.name)).toEqual([
      "202601010000_first",
      "202602010000_second"
    ]);
  });

  it("runs core migration/generate before plugin migrate/generate commands", () => {
    const calls = [];
    const runCommand = vi.fn((label, command, args) => {
      calls.push({ label, command, args });
    });

    runAll({
      applyCoreMigrationsFn: () => calls.push({ label: "apply core migrations" }),
      runCommand,
      schemas: ["packages/plugin-activities/plugin-a/prisma/schema.prisma", "packages/plugin-activities/plugin-c/prisma/schema.prisma"]
    });

    expect(calls).toEqual([
      { label: "apply core migrations" },
      { label: "Core Prisma generate", command: "npx", args: ["prisma", "generate", "--schema", "packages/db/prisma/schema.prisma"] },
      { label: "Plugin migrations", command: "npx", args: ["tsx", "scripts/apply-plugin-migrations.ts"] },
      {
        label: "Plugin Prisma generate: packages/plugin-activities/plugin-a/prisma/schema.prisma",
        command: "npx",
        args: ["prisma", "generate", "--schema", "packages/plugin-activities/plugin-a/prisma/schema.prisma"]
      },
      {
        label: "Plugin Prisma generate: packages/plugin-activities/plugin-c/prisma/schema.prisma",
        command: "npx",
        args: ["prisma", "generate", "--schema", "packages/plugin-activities/plugin-c/prisma/schema.prisma"]
      }
    ]);
  });
});
