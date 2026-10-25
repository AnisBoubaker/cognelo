import { expect, it } from "vitest";
import { extractSimplePdfText } from "./server";

it("handles unterminated literals and long whitespace without backtracking", () => {
  const started = performance.now();
  expect(extractSimplePdfText(Buffer.from("(".repeat(100_000)))).toBe("");
  expect(extractSimplePdfText(Buffer.from("(" + " ".repeat(100_000) + ")"))).toBe("");
  expect(performance.now() - started).toBeLessThan(1000);
});
it("retains nested parentheses and decodes literal escapes", () => {
  expect(extractSimplePdfText(Buffer.from("(Hello\\nworld) (nested (inside)) (\\101)"))).toBe("Hello\nworld\nnested (inside)\nA");
});
