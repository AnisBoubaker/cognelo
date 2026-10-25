import { readFile, writeFile, chmod, mkdtemp, rename } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, basename } from "node:path";
import { existsSync } from "node:fs";
import { randomBytes, createCipheriv, createDecipheriv } from "node:crypto";
import { parseEnv } from "node:util";
import { execFileSync } from "node:child_process";

const rotate = process.argv.includes("--rotate-existing");
const envPath = ".env", judgePath = "infra/judge0/judge0.conf";
const text = existsSync(envPath) ? await readFile(envPath, "utf8") : await readFile(".env.example", "utf8");
const previous = parseEnv(text), next = { ...previous };
const database = new URL(previous.DATABASE_URL || "postgresql://postgres@127.0.0.1:5432/cognelo?schema=public");
if (!["localhost", "127.0.0.1", "[::1]"].includes(database.hostname)) throw new Error("This helper only configures local development databases.");
const judgeText = existsSync(judgePath) ? await readFile(judgePath, "utf8") : await readFile("infra/judge0/judge0.conf.example", "utf8");
const oldJudge = parseEnv(judgeText), judge = { ...oldJudge };
const random = () => randomBytes(32).toString("hex");
const defaultKey = "0123456789abcdef".repeat(4);
const needsKey = !next.EMAIL_CREDENTIALS_ENCRYPTION_KEY || next.EMAIL_CREDENTIALS_ENCRYPTION_KEY === defaultKey;
if (!next.JWT_SECRET || /replace|change.?me|dev.*secret/i.test(next.JWT_SECRET)) next.JWT_SECRET = random();
if (needsKey) next.EMAIL_CREDENTIALS_ENCRYPTION_KEY = random();
if (!next.WEB_DESIGN_RUNNER_TOKEN) next.WEB_DESIGN_RUNNER_TOKEN = random();
const oldPassword = decodeURIComponent(database.password);
const replacePassword = !oldPassword || oldPassword === "postgres" || oldPassword === "CONFIGURE_LOCALLY";
if (replacePassword) database.password = random();
next.DATABASE_URL = database.href;
next.POSTGRES_PASSWORD = decodeURIComponent(database.password);
for (const [key, fallback] of Object.entries({ AUTHN_TOKEN: "dev-local-token", POSTGRES_PASSWORD: "judge0", REDIS_PASSWORD: "judge0-redis-password", SECRET_KEY_BASE: "dev-judge0-secret-key-base" })) {
  if (!judge[key] || judge[key] === fallback || judge[key].startsWith("GENERATE_")) judge[key] = random();
}
next.JUDGE0_AUTH_TOKEN = judge.AUTHN_TOKEN;
next.COGNELO_ALLOW_DEMO_SEED = "true";
const dockerEnv = { ...process.env, ...next };
const projectName = next.COMPOSE_PROJECT_NAME || basename(process.cwd()).toLowerCase().replace(/[^a-z0-9_-]/g, "");
const containerFor = (service, all = false) => {
  try { return execFileSync("docker", ["ps", all ? "-aq" : "-q", "--filter", `label=com.docker.compose.project=${projectName}`, "--filter", `label=com.docker.compose.service=${service}`], { env: dockerEnv, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim(); }
  catch { throw new Error("Start Docker before configuring local service credentials."); }
};
const appDb = containerFor("db"), judgeDb = containerFor("judge0-db");
if ((!appDb && containerFor("db", true)) || (!judgeDb && containerFor("judge0-db", true))) {
  throw new Error("Start the existing database containers before rotating credentials. Existing data volumes must be updated before their passwords change.");
}
if ((appDb || judgeDb) && !rotate && (replacePassword || needsKey || judge.POSTGRES_PASSWORD !== oldJudge.POSTGRES_PASSWORD || judge.AUTHN_TOKEN !== oldJudge.AUTHN_TOKEN)) {
  throw new Error("Existing services need coordinated credential rotation. Run with --rotate-existing, then restart the local services. Data volumes are retained.");
}
function encrypt(value, key, purpose) {
  if (!value) return null;
  const iv = randomBytes(12), cipher = createCipheriv("aes-256-gcm", Buffer.from(key, "hex"), iv);
  if (purpose === "ai") cipher.setAAD(Buffer.from("cognelo-ai-key-v1"));
  const output = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return [purpose === "ai" ? "ai-v1" : "v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), output.toString("base64url")].join(":");
}
function decrypt(value, purpose) {
  if (!value || !value.startsWith(purpose === "ai" ? "ai-v1:" : "v1:")) return value;
  const [, iv, tag, data] = value.split(":");
  const decipher = createDecipheriv("aes-256-gcm", Buffer.from(previous.EMAIL_CREDENTIALS_ENCRYPTION_KEY, "hex"), Buffer.from(iv, "base64url"));
  if (purpose === "ai") decipher.setAAD(Buffer.from("cognelo-ai-key-v1"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(data, "base64url")), decipher.final()]).toString("utf8");
}
if (rotate && !appDb) throw new Error("Start the existing local database before rotating its credentials.");
if (appDb && rotate) {
  const recovery = await mkdtemp(join(tmpdir(), "cognelo-local-credentials-"));
  await writeFile(join(recovery, "app.env"), text, { mode: 0o600 });
  await writeFile(join(recovery, "judge0.conf"), judgeText, { mode: 0o600 });
  await writeFile(join(recovery, "next.env"), replaceVariables(text, next), { mode: 0o600 });
  await writeFile(join(recovery, "next-judge0.conf"), replaceVariables(judgeText, judge), { mode: 0o600 });
  console.log(`Private credential recovery snapshot: ${recovery}`);
  process.env.DATABASE_URL = previous.DATABASE_URL;
  const { PrismaClient } = await import("@prisma/client");
  const db = new PrismaClient();
  try {
    await db.$transaction(async (tx) => {
      for (const row of await tx.executionRunner.findMany()) {
        const localJudge = row.runnerType === "judge0" && ["http://localhost:2358", "http://127.0.0.1:2358"].includes(row.baseUrl);
        const value = localJudge ? judge.AUTHN_TOKEN : decrypt(row.authTokenEncrypted);
        await tx.executionRunner.update({ where: { id: row.id }, data: { authTokenEncrypted: encrypt(value, next.EMAIL_CREDENTIALS_ENCRYPTION_KEY), ...(localJudge ? { authHeader: "X-Auth-Token" } : {}) } });
      }
      for (const row of await tx.emailDeliveryConfiguration.findMany()) await tx.emailDeliveryConfiguration.update({ where: { id: row.id }, data: {
        smtpPasswordEncrypted: encrypt(decrypt(row.smtpPasswordEncrypted), next.EMAIL_CREDENTIALS_ENCRYPTION_KEY),
        graphClientSecretEncrypted: encrypt(decrypt(row.graphClientSecretEncrypted), next.EMAIL_CREDENTIALS_ENCRYPTION_KEY)
      } });
      for (const row of await tx.aiAgentConnection.findMany()) if (row.apiKey) await tx.aiAgentConnection.update({ where: { id: row.id }, data: { apiKey: encrypt(decrypt(row.apiKey, "ai"), next.EMAIL_CREDENTIALS_ENCRYPTION_KEY, "ai") } });
      if (needsKey) await tx.emailVerificationChallenge.deleteMany({});
    });
  } finally { await db.$disconnect(); }
}
function changeDatabasePassword(container, user, password) {
  const identifier = '"' + user.replaceAll('"', '""') + '"';
  const literal = "'" + password.replaceAll("'", "''") + "'";
  execFileSync("docker", ["exec", "-i", container, "psql", "-U", user, "-d", "postgres", "-v", "ON_ERROR_STOP=1"], { input: `ALTER ROLE ${identifier} PASSWORD ${literal};\n`, stdio: ["pipe", "ignore", "inherit"] });
}
if (appDb && rotate && replacePassword) changeDatabasePassword(appDb, decodeURIComponent(database.username), next.POSTGRES_PASSWORD);
if (judgeDb && rotate && judge.POSTGRES_PASSWORD !== oldJudge.POSTGRES_PASSWORD) changeDatabasePassword(judgeDb, judge.POSTGRES_USER, judge.POSTGRES_PASSWORD);
function replaceVariables(source, values) {
  const seen = new Set();
  const original = parseEnv(source);
  const quote = (value) => {
    if (!value.includes("'") && !/[\r\n]/.test(value)) return "'" + value + "'";
    if (!/[`$\\\r\n]/.test(value)) return JSON.stringify(value);
    throw new Error("A custom environment value requires manual quoting; no generated credentials were written.");
  };
  const lines = source.split("\n").map((line) => {
    const match = /^([A-Z][A-Z0-9_]*)=/.exec(line);
    if (!match || !(match[1] in values)) return line;
    seen.add(match[1]); return original[match[1]] === values[match[1]] ? line : `${match[1]}=${quote(values[match[1]])}`;
  });
  for (const [key, value] of Object.entries(values)) if (!seen.has(key)) lines.push(`${key}=${quote(value)}`);
  return lines.join("\n").replace(/\n*$/, "") + "\n";
}
await writeFile(".env.security-next", replaceVariables(text, next), { mode: 0o600 });
await writeFile(".env.judge0-next", replaceVariables(judgeText, judge), { mode: 0o600 });
await rename(".env.security-next", envPath);
await rename(".env.judge0-next", judgePath);
await chmod(envPath, 0o600);
await chmod(judgePath, 0o600);
console.log("Local credentials configured. Restart the local app and execution services; existing data volumes are retained.");
