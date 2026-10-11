import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const workspaceRoots = ["apps", "packages"];
const ignoredDirectories = new Set(["node_modules", ".next", "dist", "coverage", "generated", "tmp", ".git"]);
const protectedPackagePaths = new Set([
  "packages/activity-sdk",
  "packages/activity-ui",
  "packages/config",
  "packages/content-type-sdk",
  "packages/contracts",
  "packages/core",
  "packages/db"
]);
const compositionPackageName = "@cognelo/plugin-registry";

async function collectPackageJsonFiles(directory) {
  const results = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (!entry.isDirectory() || ignoredDirectories.has(entry.name)) continue;
    const child = path.join(directory, entry.name);
    try {
      const packageJson = path.join(child, "package.json");
      await readFile(packageJson, "utf8");
      results.push(packageJson);
    } catch {
      results.push(...await collectPackageJsonFiles(child));
    }
  }
  return results;
}

async function collectSourceFiles(directory) {
  const results = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (ignoredDirectories.has(entry.name) || entry.name.endsWith(".tsbuildinfo")) continue;
    const child = path.join(directory, entry.name);
    if (entry.isDirectory()) results.push(...await collectSourceFiles(child));
    else if (/\.(?:[cm]?[jt]sx?|prisma)$/.test(entry.name)) results.push(child);
  }
  return results;
}

const packageJsonFiles = (await Promise.all(workspaceRoots.map((workspaceRoot) => collectPackageJsonFiles(path.join(root, workspaceRoot))))).flat();
const packages = new Map();
for (const packageJsonFile of packageJsonFiles) {
  const manifest = JSON.parse(await readFile(packageJsonFile, "utf8"));
  if (!manifest.name) continue;
  packages.set(manifest.name, {
    name: manifest.name,
    directory: path.dirname(packageJsonFile),
    relativeDirectory: path.relative(root, path.dirname(packageJsonFile)),
    dependencies: new Set(Object.keys({
      ...manifest.dependencies,
      ...manifest.devDependencies,
      ...manifest.optionalDependencies,
      ...manifest.peerDependencies
    }))
  });
}

const pluginPackageNames = new Set(
  [...packages.values()]
    .filter((entry) => entry.relativeDirectory.includes("packages/plugin-activities/") || entry.relativeDirectory.includes("packages/plugin-content-types/"))
    .map((entry) => entry.name)
);
const pluginPackages = [...packages.values()].filter((entry) => pluginPackageNames.has(entry.name));
const compositionPackage = packages.get(compositionPackageName);
const violations = [];

function packageContainingResolvedImport(file, specifier, candidates) {
  if (!specifier.startsWith(".")) return undefined;
  const resolved = path.resolve(path.dirname(file), specifier);
  return candidates.find((candidate) => resolved === candidate.directory || resolved.startsWith(`${candidate.directory}${path.sep}`));
}

function pathsToPlugins(packageName, trail = []) {
  if (trail.includes(packageName)) return [];
  const entry = packages.get(packageName);
  if (!entry) return [];
  const nextTrail = [...trail, packageName];
  const paths = [];
  for (const dependency of entry.dependencies) {
    if (pluginPackageNames.has(dependency)) paths.push([...nextTrail, dependency]);
    else if (packages.has(dependency)) paths.push(...pathsToPlugins(dependency, nextTrail));
  }
  return paths;
}

for (const entry of packages.values()) {
  if (protectedPackagePaths.has(entry.relativeDirectory)) {
    for (const dependencyPath of pathsToPlugins(entry.name)) {
      violations.push(`${entry.relativeDirectory} reaches a plugin package: ${dependencyPath.join(" -> ")}`);
    }
  }
  if (pluginPackageNames.has(entry.name)) {
    for (const dependency of entry.dependencies) {
      if (pluginPackageNames.has(dependency)) {
        violations.push(`${entry.relativeDirectory} depends on sibling plugin ${dependency}`);
      }
    }
  }
}

const importPattern = /(?:from\s+|import\s*\(\s*|import\s+)["']([^"']+)["']/g;
const apiSourceRoot = path.join(root, "apps/api/src");
const sourceRoots = [
  ...[...packages.values()].filter((entry) => protectedPackagePaths.has(entry.relativeDirectory)).map((entry) => entry.directory),
  apiSourceRoot
];
for (const sourceRoot of sourceRoots) {
  for (const file of await collectSourceFiles(sourceRoot)) {
    const source = await readFile(file, "utf8");
    for (const match of source.matchAll(importPattern)) {
      const specifier = match[1];
      const importedPackage = [...pluginPackageNames].find((pluginName) => specifier === pluginName || specifier.startsWith(`${pluginName}/`));
      if (importedPackage) {
        violations.push(`${path.relative(root, file)} imports plugin package ${specifier}`);
      }
      const importedPluginPath = packageContainingResolvedImport(file, specifier, pluginPackages);
      if (importedPluginPath) {
        violations.push(`${path.relative(root, file)} imports plugin implementation ${importedPluginPath.relativeDirectory}`);
      }
      if (sourceRoot !== apiSourceRoot && (specifier === compositionPackageName || specifier.startsWith(`${compositionPackageName}/`))) {
        violations.push(`${path.relative(root, file)} imports the application plugin composition root ${specifier}`);
      }
      if (specifier.includes("/plugin-activities/") || specifier.includes("/plugin-content-types/")) {
        violations.push(`${path.relative(root, file)} imports a plugin implementation path: ${specifier}`);
      }
      if (sourceRoot !== apiSourceRoot && specifier.includes("/plugin-registry/")) {
        violations.push(`${path.relative(root, file)} imports the application plugin composition implementation: ${specifier}`);
      }
      if (sourceRoot !== apiSourceRoot && compositionPackage && packageContainingResolvedImport(file, specifier, [compositionPackage])) {
        violations.push(`${path.relative(root, file)} imports the application plugin composition implementation by relative path`);
      }
    }
  }
}

for (const entry of [...packages.values()].filter((candidate) => pluginPackageNames.has(candidate.name))) {
  for (const file of await collectSourceFiles(entry.directory)) {
    const source = await readFile(file, "utf8");
    for (const match of source.matchAll(importPattern)) {
      const specifier = match[1];
      const importedPlugin = [...pluginPackageNames].find((pluginName) => specifier === pluginName || specifier.startsWith(`${pluginName}/`));
      if (importedPlugin && importedPlugin !== entry.name) {
        violations.push(`${path.relative(root, file)} imports sibling plugin ${specifier}`);
      }
      const importedPluginPath = packageContainingResolvedImport(file, specifier, pluginPackages);
      if (importedPluginPath && importedPluginPath.name !== entry.name) {
        violations.push(`${path.relative(root, file)} imports sibling plugin implementation ${importedPluginPath.relativeDirectory}`);
      }
      if ((specifier.includes("/plugin-activities/") || specifier.includes("/plugin-content-types/")) && !specifier.includes(entry.relativeDirectory)) {
        violations.push(`${path.relative(root, file)} imports a sibling plugin implementation path: ${specifier}`);
      }
    }
  }
}

const coreSchemaPath = path.join(root, "packages/db/prisma/schema.prisma");
const coreSchema = await readFile(coreSchemaPath, "utf8");
const coreSchemaDeclarations = new Set([...coreSchema.matchAll(/^(?:model|enum)\s+(\w+)/gm)].map((match) => match[1]));
for (const declaration of coreSchemaDeclarations) {
  if (declaration.startsWith("Plugin")) {
    violations.push(`packages/db/prisma/schema.prisma declares plugin-prefixed type ${declaration}`);
  }
}
for (const pluginPackage of pluginPackages) {
  const pluginSchemaPath = path.join(pluginPackage.directory, "prisma/schema.prisma");
  let pluginSchema;
  try {
    pluginSchema = await readFile(pluginSchemaPath, "utf8");
  } catch {
    continue;
  }
  for (const match of pluginSchema.matchAll(/^(model|enum)\s+(\w+)/gm)) {
    if (coreSchemaDeclarations.has(match[2])) {
      violations.push(`packages/db/prisma/schema.prisma duplicates plugin-owned ${match[1]} ${match[2]} from ${pluginPackage.relativeDirectory}`);
    }
  }
}

if (violations.length) {
  console.error("Plugin boundary violations:\n");
  for (const violation of [...new Set(violations)].sort()) console.error(`- ${violation}`);
  process.exitCode = 1;
} else {
  console.log(`Plugin boundaries are valid (${pluginPackageNames.size} plugin packages checked).`);
}
