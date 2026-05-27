import { createHash, randomUUID } from "node:crypto";
import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const coreSchema = "packages/db/prisma/schema.prisma";
const coreMigrationsDir = join(root, "packages/db/prisma/migrations");
const pluginsDir = join(root, "packages/plugin-activities");

export function run(label, command, args) {
  console.log(`\n> ${label}`);
  const result = spawnSync(command, args, {
    cwd: root,
    env: process.env,
    stdio: "inherit"
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

export function pluginSchemas(options = {}) {
  const currentRoot = options.root ?? root;
  const currentPluginsDir = options.pluginsDir ?? pluginsDir;
  if (!existsSync(currentPluginsDir)) {
    return [];
  }

  return readdirSync(currentPluginsDir)
    .map((entry) => join(currentPluginsDir, entry))
    .filter((entryPath) => statSync(entryPath).isDirectory())
    .map((pluginPath) => join(pluginPath, "prisma/schema.prisma"))
    .filter((schemaPath) => existsSync(schemaPath))
    .map((schemaPath) => schemaPath.replace(`${currentRoot}/`, ""))
    .sort();
}

function psql(args, options = {}) {
  const databaseUrl = process.env.DATABASE_URL?.replace(/[?&]schema=[^&]+/, "");
  if (!databaseUrl) {
    console.error("DATABASE_URL is required.");
    process.exit(1);
  }

  let result = spawnSync("psql", [databaseUrl, ...args], {
    cwd: root,
    env: process.env,
    encoding: "utf8",
    stdio: options.capture ? "pipe" : "inherit"
  });

  if (result.error?.code === "ENOENT") {
    console.warn("Host psql was not found; falling back to the Docker Compose db service.");
    let dockerArgs = args;
    let input;
    const fileArgIndex = args.indexOf("-f");
    if (fileArgIndex >= 0 && args[fileArgIndex + 1]) {
      input = readFileSync(args[fileArgIndex + 1], "utf8");
      dockerArgs = args.toSpliced(fileArgIndex, 2);
    }

    result = spawnSync("docker", ["compose", "exec", "-T", "db", "psql", databaseUrl, ...dockerArgs], {
      cwd: root,
      env: process.env,
      input,
      encoding: "utf8",
      stdio: options.capture ? "pipe" : ["pipe", "inherit", "inherit"]
    });
  }

  if (result.error) {
    console.error(`Unable to run psql: ${result.error.message}`);
    process.exit(1);
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
  return result.stdout ?? "";
}

function sqlString(value) {
  return `'${value.replaceAll("'", "''")}'`;
}

function ensureCoreMigrationTable() {
  psql([
    "-v",
    "ON_ERROR_STOP=1",
    "-c",
    `CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
      "id" VARCHAR(36) PRIMARY KEY NOT NULL,
      "checksum" VARCHAR(64) NOT NULL,
      "finished_at" TIMESTAMPTZ,
      "migration_name" VARCHAR(255) NOT NULL,
      "logs" TEXT,
      "rolled_back_at" TIMESTAMPTZ,
      "started_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
      "applied_steps_count" INTEGER NOT NULL DEFAULT 0
    )`
  ]);
}

function appliedCoreMigrations() {
  const output = psql(["-tAc", `SELECT "migration_name" FROM "_prisma_migrations" WHERE "rolled_back_at" IS NULL`], { capture: true });
  return new Set(
    output
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
  );
}

export function coreMigrations(options = {}) {
  const currentCoreMigrationsDir = options.coreMigrationsDir ?? coreMigrationsDir;
  return readdirSync(currentCoreMigrationsDir)
    .map((entry) => join(currentCoreMigrationsDir, entry))
    .filter((entryPath) => statSync(entryPath).isDirectory())
    .map((migrationPath) => ({
      name: migrationPath.split("/").at(-1),
      file: join(migrationPath, "migration.sql")
    }))
    .filter((migration) => migration.name && existsSync(migration.file))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function applyCoreMigrations() {
  console.log("\n> Core Prisma migrate");
  ensureCoreMigrationTable();
  const applied = appliedCoreMigrations();

  for (const migration of coreMigrations()) {
    if (applied.has(migration.name)) {
      console.log(`Core migration already applied: ${migration.name}`);
      continue;
    }

    console.log(`Applying core migration: ${migration.name}`);
    psql(["-v", "ON_ERROR_STOP=1", "-f", migration.file]);
    const checksum = createHash("sha256").update(readFileSync(migration.file)).digest("hex");
    psql([
      "-v",
      "ON_ERROR_STOP=1",
      "-c",
      `INSERT INTO "_prisma_migrations"
        ("id", "checksum", "finished_at", "migration_name", "logs", "rolled_back_at", "started_at", "applied_steps_count")
       VALUES
        (${sqlString(randomUUID())}, ${sqlString(checksum)}, now(), ${sqlString(migration.name)}, NULL, NULL, now(), 1)`
    ]);
  }
}

export function runAll(options = {}) {
  const applyCoreMigrationsFn = options.applyCoreMigrationsFn ?? applyCoreMigrations;
  const runCommand = options.runCommand ?? run;
  const schemas = options.schemas ?? pluginSchemas();

  applyCoreMigrationsFn();
  runCommand("Core Prisma generate", "npx", ["prisma", "generate", "--schema", coreSchema]);
  runCommand("Plugin migrations", "npx", ["tsx", "scripts/apply-plugin-migrations.ts"]);

  for (const schema of schemas) {
    const label = schema;
    runCommand(`Plugin Prisma generate: ${label}`, "npx", ["prisma", "generate", "--schema", schema]);
  }
}

export function main() {
  runAll();
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
