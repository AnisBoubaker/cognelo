import { describe, expect, it } from "vitest";
import {
  clampMonacoSelectionToEditableOffsets,
  getEditableMonacoOffsets,
  getEditableMonacoValue
} from "./monaco-code-editor-value";

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

  it("uses the current Monaco model length for an empty answer's first keystroke", () => {
    expect(getEditableMonacoOffsets("a\n\n", "", "\n\n")).toEqual({
      startOffset: 0,
      endOffset: 1
    });
  });

  it("limits select-all to the editable student region", () => {
    expect(
      clampMonacoSelectionToEditableOffsets(
        { startOffset: 0, endOffset: 25 },
        { startOffset: 5, endOffset: 20 }
      )
    ).toEqual({ startOffset: 5, endOffset: 20 });
  });
});
