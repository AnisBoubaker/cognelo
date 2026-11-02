import { describe, expect, it } from "vitest";
import { reconcileTeacherSolutionRequirements } from "./teacher-solution-selection";
import { decodeHomeworkSolutionText, isHomeworkArchiveMetadata } from "./teacher-solution";

describe("teacher solution replacement", () => {
  const previous = { files: [{ path: "Solution/main.c" }, { path: "keep.c" }], functions: [
    { key: "Solution/main.c:add", sourcePath: "Solution/main.c", functionName: "add", signature: { returnType: "int", parameterTypes: ["int"] } },
    { key: "keep.c:keep", sourcePath: "keep.c", functionName: "keep", signature: { returnType: "int", parameterTypes: [] } }
  ] };
  it("removes stale paths/functions while preserving unrelated requirements and updating retained signatures", () => {
    const result = reconcileTeacherSolutionRequirements({ requiredFiles: [{ path: "Solution/main.c" }, { path: "manual.h" }], requiredFunctions: [
      { name: "add", filePath: "Solution/main.c" }, { name: "keep", filePath: "keep.c", returnType: "int", parameterTypes: [] }, { name: "manual" }
    ], maxFileCount: 50 }, previous, { files: [{ path: "main.c" }, { path: "keep.c" }], functions: [{ ...previous.functions[1], signature: { returnType: "long", parameterTypes: ["char*"] } }] });
    expect(result).toEqual({ requiredFiles: [{ path: "manual.h" }], requiredFunctions: [{ name: "keep", filePath: "keep.c", returnType: "long", parameterTypes: ["char*"] }, { name: "manual" }], maxFileCount: 50 });
  });
  it("filters macOS metadata and rejects binary/malformed source before JSON persistence", () => {
    expect(isHomeworkArchiveMetadata("__MACOSX/Solution/._main.c")).toBe(true);
    expect(isHomeworkArchiveMetadata("Solution/._main.h")).toBe(true);
    expect(isHomeworkArchiveMetadata("Solution/main.c")).toBe(false);
    expect(() => decodeHomeworkSolutionText(Buffer.from("int main(void) { return 0; }\u0000"), "main.c")).toThrow(/binary data/);
    expect(() => decodeHomeworkSolutionText(Buffer.from([0xff, 0x00, 0xff]), "main.c")).toThrow(/not readable text/);
    const source = "int somme(void) { /* été */ return 0; }";
    expect(decodeHomeworkSolutionText(Buffer.from(source), "main.c")).toBe(source);
    expect(decodeHomeworkSolutionText(Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(source, "utf16le")]), "main.c")).toBe(source);
  });
});
