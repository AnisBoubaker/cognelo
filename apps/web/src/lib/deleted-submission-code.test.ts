import { describe, expect, it } from "vitest";
import { deletedSubmissionCode, deletedSubmissionFiles } from "./deleted-submission-code";

describe("retained deleted submission code", () => {
  it("reads programming source from existing deletion snapshots without changing whitespace", () => {
    const source = "#include <stdio.h>\nint main(void) {\n  return 0;\n}\n";
    expect(deletedSubmissionCode({ submittedSourceCode: source, executionId: "retained-execution" })).toBe(source);
  });

  it("distinguishes an empty submission from a missing snapshot", () => {
    expect(deletedSubmissionCode({ submittedSourceCode: "" })).toBe("");
    expect(deletedSubmissionCode({ executionId: "legacy-reference" })).toBeNull();
  });

  it("continues to display the student's submitted Parsons arrangement", () => {
    expect(deletedSubmissionCode({ submittedState: { blocks: [
      { displayText: "if ready:", currentIndent: 0 },
      { displayText: "print('done')", currentIndent: 1 }
    ] } })).toBe("if ready:\n  print('done')");
  });

  it("ignores malformed data and never substitutes reference code or grading evidence", () => {
    expect(deletedSubmissionCode({ submittedSourceCode: null, submittedState: { blocks: [null, { code: "invalid" }] }, referenceSolution: "private", result: { sourceCode: "private" } })).toBeNull();
  });

  it("reads retained Web Design files as code, without executing their contents", () => {
    expect(deletedSubmissionFiles({ submittedFiles: [
      { path: "index.html", starterCode: "<h1>Student answer</h1>", language: "html" },
      { path: "script.js", starterCode: "", language: "javascript" },
      null
    ] })).toEqual([
      { path: "index.html", code: "<h1>Student answer</h1>", language: "html" },
      { path: "script.js", code: "", language: "javascript" }
    ]);
  });
});
