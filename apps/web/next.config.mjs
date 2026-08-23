import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const repositoryRoot = fileURLToPath(new URL("../..", import.meta.url));
const webPackage = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8"));

function resolveCogneloVersion() {
  const configuredVersion = process.env.NEXT_PUBLIC_COGNELO_VERSION?.trim();
  if (configuredVersion) return configuredVersion;

  try {
    const gitDescription = execFileSync(
      "git",
      ["describe", "--tags", "--match", "cognelo-*", "--always", "--dirty"],
      { cwd: repositoryRoot, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }
    ).trim();
    if (gitDescription) return gitDescription.replace(/^cognelo-/, "");
  } catch {
    // Source archives may not contain Git metadata; the package version remains a stable fallback.
  }

  return webPackage.version;
}

const nextConfig = {
  env: {
    NEXT_PUBLIC_COGNELO_VERSION: resolveCogneloVersion()
  },
  transpilePackages: ["@cognelo/contracts", "@cognelo/activity-ui", "@cognelo/plugin-parsons", "@cognelo/plugin-mcq"]
};

export default nextConfig;
