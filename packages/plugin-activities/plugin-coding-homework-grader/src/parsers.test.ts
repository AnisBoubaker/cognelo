import { describe, expect, it } from "vitest";
import {
  codingHomeworkCParserAdapter,
  createCodingHomeworkParserRegistry,
  parseCodingHomeworkSourceFiles
} from "./parsers";

describe("coding homework C parser adapter", () => {
  it("extracts deterministic C function records and normalized AST text", async () => {
    const source = [
      "#include <stdio.h>",
      "",
      "static int add(int a, int b) {",
      "  // ignored by the serializer",
      "  return a + b;",
      "}",
      "",
      "void greet(void) {",
      "  printf(\"hello\");",
      "}"
    ].join("\n");

    const first = await codingHomeworkCParserAdapter.parse([{ path: "src/main.c", languageKey: "c", content: source }]);
    const second = await codingHomeworkCParserAdapter.parse([{ path: "src/main.c", languageKey: "c", content: source }]);

    expect(first).toEqual(second);
    expect(first.diagnostics).toEqual([]);
    expect(first.functions.map((fn) => fn.functionName)).toEqual(["add", "greet"]);
    expect(first.functions[0]).toMatchObject({
      sourcePath: "src/main.c",
      startLine: 3,
      endLine: 6,
      functionCode: "static int add(int a, int b) {\n  // ignored by the serializer\n  return a + b;\n}",
      astText: ["c-ast-v1", "function:add", "return:static int", "params:int a|int b", "body:return a + b ;"].join("\n")
    });
    expect(first.functions[1]?.astText).toBe(["c-ast-v1", "function:greet", "return:void", "params:void", "body:printf ( <string> ) ;"].join("\n"));
  });

  it("returns recoverable diagnostics for broken files after extracting valid functions", async () => {
    const source = ["int ok(void) {", "  return 1;", "}", "", "int broken(void) {", "  if (1) {", "    return 2;", "  }"].join("\n");

    const result = await codingHomeworkCParserAdapter.parse([{ path: "src/broken.c", languageKey: "c", content: source }]);

    expect(result.functions.map((fn) => fn.functionName)).toEqual(["ok"]);
    expect(result.diagnostics).toEqual([
      {
        code: "C_UNMATCHED_FUNCTION_BRACE",
        line: 5,
        message: "Function broken has an opening brace without a matching closing brace.",
        path: "src/broken.c",
        severity: "error"
      }
    ]);
  });

  it("keeps the parser registry language-neutral", async () => {
    const registry = createCodingHomeworkParserRegistry([codingHomeworkCParserAdapter]);
    const result = await registry.parse([
      { path: "src/main.c", languageKey: "c", content: "int main(void) { return 0; }" },
      { path: "src/main.py", languageKey: "python", content: "def main():\n    return 0" }
    ]);

    expect(result.functions.map((fn) => fn.functionName)).toEqual(["main"]);
    expect(result.diagnostics).toContainEqual({
      code: "PARSER_ADAPTER_NOT_FOUND",
      message: "No parser adapter is registered for python.",
      path: "src/main.py",
      severity: "warning"
    });
    expect(() => createCodingHomeworkParserRegistry([codingHomeworkCParserAdapter, codingHomeworkCParserAdapter])).toThrow(/already registered/);
  });

  it("exposes the default parser entry point", async () => {
    await expect(parseCodingHomeworkSourceFiles([{ path: "src/main.c", languageKey: "c", content: "int main(void) { return 0; }" }])).resolves.toMatchObject({
      functions: [expect.objectContaining({ functionName: "main" })],
      diagnostics: []
    });
  });
});

it("bounds malformed signatures, many functions, and oversized source analysis", async () => {
  const started = performance.now();
  const malformed = await parseCodingHomeworkSourceFiles([{ path: "malformed.c", languageKey: "c", content: "a".repeat(100_000) + "{}" }]);
  expect(malformed.functions).toHaveLength(0);
  const crowded = await parseCodingHomeworkSourceFiles([{ path: "crowded.c", languageKey: "c", content: "int f(void) { return 0; }\n".repeat(3000) }]);
  expect(crowded.diagnostics.some((issue) => issue.code === "FUNCTION_ANALYSIS_LIMIT")).toBe(true);
  const large = await parseCodingHomeworkSourceFiles([{ path: "large.c", languageKey: "c", content: " ".repeat(2_000_001) }]);
  expect(large.diagnostics[0].code).toBe("SOURCE_ANALYSIS_LIMIT");
  expect(performance.now() - started).toBeLessThan(1000);
});
