import { describe, expect, it } from "vitest";
import { validateCodingHomeworkArchive } from "./validation";

describe("coding homework structure validation", () => {
  it("validates required files, folders, extensions, and functions", async () => {
    const summary = await validateCodingHomeworkArchive({
      archiveSizeBytes: 1024,
      requirements: {
        allowedExtensions: [".c", ".h"],
        ignoredPaths: ["build"],
        languageKey: "c",
        maxArchiveBytes: 10_000,
        maxFileCount: 10,
        requiredFiles: [{ path: "src/main.c" }],
        requiredFolders: [{ path: "include" }],
        requiredFunctions: [{ filePath: "src/main.c", name: "main" }]
      },
      entries: [
        file("src/main.c", "int main(void) { return 0; }"),
        file("include/app.h", "#pragma once\n"),
        file("build/tmp.o", "binary")
      ]
    });

    expect(summary.isValid).toBe(true);
    expect(summary.validFiles).toEqual(["src/main.c", "include/app.h"]);
    expect(summary.ignoredFiles).toEqual(["build/tmp.o"]);
    expect(summary.validFunctions).toEqual([{ filePath: "src/main.c", functionName: "main" }]);
    expect(summary.missingRequired).toEqual([]);
    expect(summary.unexpectedItems).toEqual([]);
  });

  it("separates missing requirements, unexpected extensions, and parser errors", async () => {
    const summary = await validateCodingHomeworkArchive({
      archiveSizeBytes: 1024,
      requirements: {
        allowedExtensions: [".c"],
        ignoredPaths: [],
        languageKey: "c",
        maxArchiveBytes: 10_000,
        maxFileCount: 10,
        requiredFiles: [{ path: "src/main.c" }],
        requiredFolders: [{ path: "include" }],
        requiredFunctions: [{ filePath: "src/main.c", name: "main" }]
      },
      entries: [file("src/main.c", "int helper(void) { if (1) { return 1; }"), file("notes.txt", "notes")]
    });

    expect(summary.isValid).toBe(false);
    expect(summary.missingRequired).toEqual([
      {
        code: "missing_folder",
        message: "Required folder is missing: include.",
        path: "include",
        severity: "error"
      },
      {
        code: "missing_function",
        functionName: "main",
        message: "Required function is missing: src/main.c:main.",
        path: "src/main.c",
        severity: "error"
      }
    ]);
    expect(summary.unexpectedItems).toEqual([
      {
        code: "unsupported_extension",
        message: "File extension is not allowed for notes.txt.",
        path: "notes.txt",
        severity: "error"
      }
    ]);
    expect(summary.parserDiagnostics).toEqual([
      {
        code: "parser_error",
        message: "Function helper has an opening brace without a matching closing brace.",
        path: "src/main.c",
        severity: "error"
      }
    ]);
  });
});

function file(path: string, content: string) {
  return {
    compressedSize: Buffer.byteLength(content),
    content: Buffer.from(content, "utf8"),
    isDirectory: false,
    path,
    uncompressedSize: Buffer.byteLength(content)
  };
}
