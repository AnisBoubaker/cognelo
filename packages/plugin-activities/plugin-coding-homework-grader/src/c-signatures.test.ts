import { describe, expect, it } from "vitest";
import { normalizeCParameter } from "./c-signatures";
import { parseCodingHomeworkSourceFiles } from "./parsers";
import { codingHomeworkSubmissionReadiness, validateCodingHomeworkArchive } from "./validation";

describe("C requirement signatures", () => {
  it.each([
    ["int values[]", "int*"], ["int(*)[10]", "int(*)[10]"], ["signed char c", "signed char"], ["const char *text", "const char*"], ["int matrix[][10]", "int(*)[10]"],
    ["unsigned count", "unsigned int"], ["long unsigned int count", "unsigned long"], ["size_t count", "size_t"],
    ["struct Point *point", "struct Point*"], ["void (*callback)(int value, char *name)", "void(*)(int,char*)"]
  ])("normalizes %s as %s", (input, expected) => expect(normalizeCParameter(input)).toBe(expected));
  it("extracts signatures without executing source and preserves struct return functions", async () => {
    const result = await parseCodingHomeworkSourceFiles([{ path: "main.c", languageKey: "c", content: "struct Point *find(int values[], unsigned count) { return 0; }" }]);
    expect(result.functions[0].signature).toEqual({ returnType: "struct Point*", parameterTypes: ["int*", "unsigned int"] });
  });
  it("permits acknowledged academic gaps while retaining hard archive safety failures", async () => {
    const content = Buffer.from("int sum(int *values, int n) { return n; }");
    const summary = await validateCodingHomeworkArchive({ archiveSizeBytes: 100, requirements: {
      requiredFiles: [{ path: "missing.c" }], requiredFunctions: [{ name: "sum", returnType: "int", parameterTypes: ["int data[]", "double size"] }]
    }, entries: [{ path: "main.c", isDirectory: false, content, compressedSize: content.length, uncompressedSize: content.length }] });
    expect(summary.issues.map(issue => issue.code)).toEqual(["missing_file", "signature_mismatch"]);
    expect(codingHomeworkSubmissionReadiness(summary)).toMatchObject({ canSubmit: true, requiresAcknowledgement: true });
    summary.issues.push({ code: "forbidden_path", severity: "error", message: "Unsafe archive" });
    expect(codingHomeworkSubmissionReadiness(summary).canSubmit).toBe(false);
  });
});
