import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { expect, it } from "vitest";
import { patchMonacoSanitizer } from "../apps/web/scripts/prepare-monaco-assets.mjs";
const require = createRequire(import.meta.url);

it("replaces the pinned Monaco sanitizer module with the maintained first-party dependency", () => {
  const source = readFileSync(require.resolve("monaco-editor/dev/vs/editor/editor.main.js"), "utf8");
  const patched = patchMonacoSanitizer(source);
  expect(patched).not.toContain("DOMPurify 3.1.7");
  expect(patched).toContain('define("vs/base/browser/dompurify/dompurify", ["vs/cognelo-dompurify"]');
});
it("refuses to publish assets if the upstream module layout cannot be verified", () => {
  expect(() => patchMonacoSanitizer("unknown distribution")).toThrow();
  expect(() => patchMonacoSanitizer("/*! @license DOMPurify 3.1.7 */ no module boundary")).toThrow();
});
