import { cp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { transform } from "esbuild";

const require = createRequire(import.meta.url);
const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const moduleName = "vs/base/browser/dompurify/dompurify";

/** Replace the complete vendored module, never individual minified expressions. */
export function patchMonacoSanitizer(source) {
  const licenses = [...source.matchAll(/\/\*! @license DOMPurify [0-9.]+/g)];
  if (licenses.length !== 1) throw new Error("Unexpected Monaco sanitizer layout; review the pinned distribution before publishing assets.");
  const start = licenses[0].index;
  const marker = "// ESM-uncomment-end";
  const end = source.indexOf(marker, start);
  if (end < 0 || end - start > 250_000 || !source.slice(start, end).includes(`define("${moduleName}"`)) {
    throw new Error("The Monaco sanitizer module boundary could not be verified.");
  }
  return source.slice(0, start) + `define("${moduleName}", ["vs/cognelo-dompurify"], function (purify) { return purify; });\n` + source.slice(end + marker.length);
}

async function main() {
  const sourceDirectory = path.dirname(require.resolve("monaco-editor/min/vs/loader.js"));
  const packageRoot = path.resolve(sourceDirectory, "../..");
  const monacoPackage = JSON.parse(await readFile(path.join(packageRoot, "package.json"), "utf8"));
  const purifyRoot = path.resolve(path.dirname(require.resolve("dompurify")), "..");
  const purifyPackage = JSON.parse(await readFile(path.join(purifyRoot, "package.json"), "utf8"));
  const targetDirectory = path.join(webRoot, "public", "_vendor", "monaco", "vs");
  const versionMarker = path.join(targetDirectory, ".cognelo-version");
  const version = `${monacoPackage.version}:dompurify-${purifyPackage.version}:adapter-1`;
  if ((await readFile(versionMarker, "utf8").catch(() => "")).trim() === version) return;

  const original = await readFile(path.join(packageRoot, "dev/vs/editor/editor.main.js"), "utf8");
  const patched = patchMonacoSanitizer(original);
  const compiled = await transform(patched, { loader: "js", minify: true, target: "es2020", legalComments: "eof" });
  await rm(targetDirectory, { force: true, recursive: true });
  await mkdir(path.dirname(targetDirectory), { recursive: true });
  await cp(sourceDirectory, targetDirectory, { recursive: true, filter: (file) => !file.endsWith(".map") });
  await writeFile(path.join(targetDirectory, "editor/editor.main.js"), compiled.code, "utf8");
  await cp(path.join(purifyRoot, "dist/purify.min.js"), path.join(targetDirectory, "cognelo-dompurify.js"));
  await cp(path.join(purifyRoot, "LICENSE"), path.join(targetDirectory, "LICENSE.dompurify"));
  await cp(path.join(packageRoot, "LICENSE"), path.join(targetDirectory, "LICENSE.monaco"));

  // A dependency update cannot silently publish another old bundled sanitizer.
  for (const entry of await readdir(targetDirectory, { recursive: true })) {
    if (!entry.endsWith(".js")) continue;
    const javascript = await readFile(path.join(targetDirectory, entry), "utf8");
    for (const match of javascript.matchAll(/DOMPurify\s+([0-9]+\.[0-9]+\.[0-9]+)/g)) {
      if (match[1] !== purifyPackage.version) throw new Error("An outdated sanitizer remains in the Monaco assets.");
    }
  }
  await writeFile(versionMarker, `${version}\n`, "utf8");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
