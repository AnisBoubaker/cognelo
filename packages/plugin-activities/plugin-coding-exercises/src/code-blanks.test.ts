import { describe, expect, it } from "vitest";
import { assembleCodingBlankSource, codingBlankIds, codingBlankResponseState, resolveCodingBlankInput } from "./code-blanks";
import { codingExerciseConfigSchema, parseCodingExerciseConfig } from "./coding-exercises";
import { hasCodingExerciseAnswer } from "./web/coding-exercise-student-source";

const blankTemplate = "def square(x):\n    return {{ BLANK:expression }} + {{ BLANK:offset }}";
const config = { responseMode: "blanks", blankTemplate };

describe("code blank responses", () => {
  it("assembles equivalent completions without comparing with a reference answer", () => {
    for (const expression of ["x * x", "x ** 2"]) {
      const state = codingBlankResponseState(blankTemplate, { expression, offset: "0" });
      expect(state.sourceCode).toBe(`def square(x):\n    return ${expression} + 0`);
      expect(hasCodingExerciseAnswer(config, state)).toBe(true);
    }
  });

  it("ignores forged surrounding code and rejects stale or unknown blanks", () => {
    expect(resolveCodingBlankInput(config, { sourceCode: "forged", blankTemplate, blankAnswers: { expression: "x*x", offset: "0" } }).sourceCode)
      .toBe("def square(x):\n    return x*x + 0");
    expect(() => resolveCodingBlankInput(config, { sourceCode: "forged" })).toThrow("template has changed");
    expect(() => resolveCodingBlankInput(config, { sourceCode: "", blankTemplate, blankAnswers: { unknown: "x" } })).toThrow("unknown");
  });

  it("keeps untouched and cleared blanks unanswered even with nonempty fixed code", () => {
    const state = codingBlankResponseState(blankTemplate, { expression: " \n", offset: "" });
    expect(state.sourceCode).toBe("");
    expect(hasCodingExerciseAnswer(config, state)).toBe(false);
    expect(hasCodingExerciseAnswer(config, { sourceCode: "forged" })).toBe(false);
    expect(resolveCodingBlankInput(config, { sourceCode: "" })).toMatchObject({ sourceCode: "", blankTemplate, blankAnswers: { expression: "", offset: "" } });
  });

  it("supports inline and multiline code and never recursively substitutes inserted text", () => {
    expect(assembleCodingBlankSource("{{ BLANK:body }}\nprint('done')", { body: "x = '{{ BLANK:body }}'\nprint(x)" }))
      .toBe("x = '{{ BLANK:body }}'\nprint(x)\nprint('done')");
    expect(assembleCodingBlankSource("{{ BLANK:constructor }}", {})).toBe("");
  });

  it("rejects duplicate/malformed markers and bounded response overflow", () => {
    expect(codingBlankIds(blankTemplate)).toEqual(["expression", "offset"]);
    expect(() => codingBlankIds("{{ BLANK:x }} {{ BLANK:x }}")).toThrow("unique");
    expect(() => codingBlankIds("{{ BLANK:1 }}")).toThrow("Invalid");
    expect(() => codingBlankIds(Array.from({ length: 51 }, (_, i) => `{{ BLANK:b${i} }}`).join(""))).toThrow("50");
    expect(() => codingBlankResponseState(blankTemplate, { expression: "x".repeat(10001) })).toThrow();
    expect(codingExerciseConfigSchema.safeParse({ prompt: "", blankTemplate: "{{ BLANK:x }} {{ BLANK:x }}" }).success).toBe(false);
  });

  it.each(["program", "function", "template"])("preserves ordinary answers for legacy %s exercises", executionMode => {
    const parsed = parseCodingExerciseConfig({ prompt: "", language: "python", executionMode });
    expect(parsed.executionMode).toBe("template");
    expect(parsed.responseMode).toBeUndefined();
    expect(resolveCodingBlankInput(parsed, { sourceCode: "print(42)" })).toEqual({ sourceCode: "print(42)" });
  });

  it("leaves legacy code responses and their answer checks intact", () => {
    expect(resolveCodingBlankInput({}, { sourceCode: "print(1)" })).toEqual({ sourceCode: "print(1)" });
    expect(hasCodingExerciseAnswer({ prompt: "", starterCode: "print(0)" }, { sourceCode: "print(1)" })).toBe(true);
  });
});
