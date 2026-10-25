import { expect, it } from "vitest";
import { escapeCsvCell } from "./csv";
it.each(["=1+1", "+1+1", "-1+1", "@SUM(1)", "\t=1+1", " \r\n=1+1", "\u001b=1+1"])("keeps formula-like text literal: %j", (value) => {
  const output = escapeCsvCell(value);
  expect(output.startsWith("'") || output.startsWith("\"'")).toBe(true);
});
it("retains numeric values and quotes CSV delimiters and carriage returns", () => {
  expect(escapeCsvCell(-2)).toBe("-2");
  expect(escapeCsvCell('a,"b"')).toBe('"a,""b"""');
  expect(escapeCsvCell("a\rb")).toBe('"a\rb"');
  expect(escapeCsvCell(null)).toBe("");
});
