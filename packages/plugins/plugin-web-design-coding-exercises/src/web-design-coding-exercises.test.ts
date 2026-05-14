import { describe, expect, it } from "vitest";
import {
  buildWebDesignPreviewDocument,
  inferWebDesignFileLanguage,
  normalizeWebDesignExerciseConfig,
  normalizeWebDesignFilePath,
  parseWebDesignExerciseConfig,
  webDesignExerciseTestsInputSchema,
  webDesignPromptIncludesExpectedResult,
  webDesignPromptRequestsCroppedExpectedResult
} from "./web-design-coding-exercises";

describe("web design coding exercise helpers", () => {
  it("normalizes file paths and infers languages", () => {
    expect(normalizeWebDesignFilePath("\\src//index.html")).toBe("src/index.html");
    expect(inferWebDesignFileLanguage("styles.css")).toBe("css");
    expect(inferWebDesignFileLanguage("app.mjs")).toBe("javascript");
    expect(inferWebDesignFileLanguage("index.html")).toBe("html");
  });

  it("deduplicates files and sorts them by order", () => {
    const normalized = normalizeWebDesignExerciseConfig({
      prompt: "Build a page",
      previewEntry: "/index.html",
      maxEditorSeconds: 1800,
      files: [
        { id: "b", path: "script.js", language: "javascript", starterCode: "", isEditable: true, orderIndex: 2 },
        { id: "a", path: "/index.html", language: "html", starterCode: "<main></main>", isEditable: true, orderIndex: 1 },
        { id: "dupe", path: "index.html", language: "html", starterCode: "", isEditable: true, orderIndex: 3 }
      ]
    });

    expect(normalized.previewEntry).toBe("index.html");
    expect(normalized.files.map((file) => file.path)).toEqual(["index.html", "script.js"]);
  });

  it("falls back to default config for invalid input", () => {
    expect(parseWebDesignExerciseConfig({ files: [] }).files.length).toBeGreaterThan(0);
  });

  it("detects expected-result prompt markers", () => {
    expect(webDesignPromptIncludesExpectedResult("Compare with {{ EXPECTED_RESULT }}")).toBe(true);
    expect(webDesignPromptRequestsCroppedExpectedResult("Compare with {{ EXPECTED_RESULT_CROPPED }}")).toBe(true);
  });

  it("builds a preview document with escaped style and script tags", () => {
    const document = buildWebDesignPreviewDocument([
      { path: "index.html", language: "html", starterCode: "<main>Hello</main>" },
      { path: "styles.css", language: "css", starterCode: "body::after { content: '</style>'; }" },
      { path: "script.js", language: "javascript", starterCode: "console.log('</script>');" }
    ]);

    expect(document).toContain("<main>Hello</main>");
    expect(document).toContain("<\\/style>");
    expect(document).toContain("<\\/script>");
  });

  it("validates test payload defaults for sample and hidden tests", () => {
    expect(
      webDesignExerciseTestsInputSchema.parse({
        referenceFiles: [{ id: "index", path: "index.html", language: "html", starterCode: "<main></main>" }],
        tests: [{ id: "sample-1", name: "Heading", kind: "sample", testCode: "await page.locator('h1')" }]
      })
    ).toMatchObject({
      tests: [{ id: "sample-1", isEnabled: true, weight: 1 }]
    });
  });
});
