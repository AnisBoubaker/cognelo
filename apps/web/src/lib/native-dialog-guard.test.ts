import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const nativeDialogPattern = /\b(?:globalThis|window)\.(?:alert|confirm|prompt)\s*\(/;

function applicationSources(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      return entry.name === "generated" || entry.name === "node_modules" ? [] : applicationSources(path);
    }
    return /\.(?:ts|tsx)$/.test(entry.name) && !/\.test\.(?:ts|tsx)$/.test(entry.name) ? [path] : [];
  });
}

describe("native browser dialog guard", () => {
  it("keeps Cognelo-owned UI on the shared dialog provider", () => {
    const offenders = ["apps", "packages"]
      .flatMap(applicationSources)
      .filter((path) => nativeDialogPattern.test(readFileSync(path, "utf8")));

    expect(offenders).toEqual([]);
  });
});
