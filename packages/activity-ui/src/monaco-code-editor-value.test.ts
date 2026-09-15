import { describe, expect, it } from "vitest";
import { getEditableMonacoValue } from "./monaco-code-editor-value";

describe("getEditableMonacoValue", () => {
  it("ignores Monaco value notifications while the editor is read-only", () => {
    expect(
      getEditableMonacoValue({
        nextValue: "// Hidden code\nstudent answer",
        readOnly: true,
        readOnlyPrefix: "// Hidden code\n",
        readOnlySuffix: ""
      })
    ).toBeNull();
  });

  it("returns only the editable student region", () => {
    expect(
      getEditableMonacoValue({
        nextValue: "// Hidden code\nstudent answer\n// Hidden tests",
        readOnly: false,
        readOnlyPrefix: "// Hidden code\n",
        readOnlySuffix: "\n// Hidden tests"
      })
    ).toBe("student answer");
  });

  it("rejects changes that remove a protected template region", () => {
    expect(
      getEditableMonacoValue({
        nextValue: "student answer",
        readOnly: false,
        readOnlyPrefix: "// Hidden code\n",
        readOnlySuffix: ""
      })
    ).toBeNull();
  });

  it("keeps ordinary editable editors unchanged", () => {
    expect(
      getEditableMonacoValue({
        nextValue: "student answer",
        readOnly: false,
        readOnlyPrefix: "",
        readOnlySuffix: ""
      })
    ).toBe("student answer");
  });
});
