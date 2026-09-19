import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(scriptDirectory, "..");
const sourceLoader = require.resolve("monaco-editor/min/vs/loader.js");
const sourceDirectory = path.dirname(sourceLoader);
const packageRoot = path.resolve(sourceDirectory, "../..");
const packageJson = JSON.parse(await readFile(path.join(packageRoot, "package.json"), "utf8"));
const targetDirectory = path.join(webRoot, "public", "_vendor", "monaco", "vs");
const versionMarker = path.join(targetDirectory, ".cognelo-version");
const installedVersion = String(packageJson.version);

const preparedVersion = await readFile(versionMarker, "utf8").catch(() => "");
if (preparedVersion.trim() === installedVersion) {
  process.exit(0);
}

await rm(targetDirectory, { force: true, recursive: true });
await mkdir(path.dirname(targetDirectory), { recursive: true });
await cp(sourceDirectory, targetDirectory, { recursive: true });
await writeFile(versionMarker, `${installedVersion}\n`, "utf8");
