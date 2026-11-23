import { describe, expect, it } from "vitest";
import { canMarkBlankSelection, projectBlankAuthoring, serializeBlankAuthoring, updateBlankRanges } from "./code-blanks-authoring-model";

describe("inline code blank authoring", () => {
  const template = "return {{ BLANK:expression }} + {{ BLANK:offset }}";
  const answers = { expression: "x * x", offset: "0" };

  it("allows a single line or inline fragment but disables empty and multiline selections", () => {
    const document = { source: "int x = 0;\r\nreturn x;", ranges: [] };
    expect(canMarkBlankSelection(document, 0, 10)).toBe(true);
    expect(canMarkBlankSelection(document, 4, 5)).toBe(true);
    expect(canMarkBlankSelection(document, 0, document.source.length)).toBe(false);
    expect(canMarkBlankSelection(document, 0, 12)).toBe(false);
    expect(canMarkBlankSelection(document, 4, 4)).toBe(false);
    expect(canMarkBlankSelection({ source: "first\nsecond", ranges: [] }, 0, 6)).toBe(false);
  });

  it("shows the full reference code and serializes only the selected ranges as private values", () => {
    const document = projectBlankAuthoring(template, answers);
    expect(document.source).toBe("return x * x + 0");
    expect(document.ranges).toEqual([{ id: "expression", start: 7, end: 12 }, { id: "offset", start: 15, end: 16 }]);
    expect(serializeBlankAuthoring(document)).toEqual({ template, answers });
  });

  it("unmarks code without removing or altering any source", () => {
    const document = projectBlankAuthoring(template, answers);
    expect(serializeBlankAuthoring({ ...document, ranges: document.ranges.filter(range => range.id !== "expression") }))
      .toEqual({ template: "return x * x + {{ BLANK:offset }}", answers: { offset: "0" } });
  });

  it("keeps the ID when editing inside a blank, replacing it, or clearing and retyping it", () => {
    const original = [{ id: "answer", start: 7, end: 12 }];
    expect(updateBlankRanges(original, [{ rangeOffset: 8, rangeLength: 0, text: " ** 2" }])).toEqual([{ id: "answer", start: 7, end: 17 }]);
    const replaced = updateBlankRanges(original, [{ rangeOffset: 7, rangeLength: 5, text: "x ** 2" }]);
    expect(replaced).toEqual([{ id: "answer", start: 7, end: 13 }]);
    const cleared = updateBlankRanges(original, [{ rangeOffset: 7, rangeLength: 5, text: "" }]);
    expect(updateBlankRanges(cleared, [{ rangeOffset: 7, rangeLength: 0, text: "value" }])).toEqual(original);
  });

  it("moves blanks after surrounding edits and supports multiline and multiple edits", () => {
    const original = projectBlankAuthoring(template, answers);
    const ranges = updateBlankRanges(original.ranges, [
      { rangeOffset: 0, rangeLength: 0, text: "# comment\n" },
      { rangeOffset: 15, rangeLength: 1, text: "10" }
    ]);
    expect(serializeBlankAuthoring({ source: "# comment\nreturn x * x + 10", ranges }))
      .toEqual({ template: "# comment\n" + template, answers: { expression: "x * x", offset: "10" } });
  });

  it("removes marks when deleting their surrounding code and rejects overlapping ranges", () => {
    expect(updateBlankRanges([{ id: "x", start: 2, end: 5 }], [{ rangeOffset: 0, rangeLength: 9, text: "new" }])).toEqual([]);
    expect(() => serializeBlankAuthoring({ source: "abcd", ranges: [{ id: "a", start: 0, end: 3 }, { id: "b", start: 2, end: 4 }] })).toThrow("overlap");
  });
});
