import { describe, expect, it } from "vitest";
import { compareCodingExerciseOutput, getJudge0ExpectedOutput, validateCodingExerciseOutputMatcher } from "./output-matcher";

describe("coding exercise output matcher", () => {
  it("keeps exact matching as the Judge0-backed default", () => {
    expect(getJudge0ExpectedOutput("12.5", { outputMatchMode: "exact", containsLinesOrderMatters: false })).toBe("12.5");
  });

  it("requires complete literal lines and accounts for duplicates", () => {
    const matcher = { outputMatchMode: "contains_lines" as const, containsLinesOrderMatters: false };
    expect(compareCodingExerciseOutput("Age: 3\nPoids: 12.5", "prompt\nPoids: 12.5\nAge: 3\n", matcher).matched).toBe(true);
    expect(compareCodingExerciseOutput("3", "38.7\n", matcher).matched).toBe(false);
    expect(compareCodingExerciseOutput("ok\nok", "ok\n", matcher).matched).toBe(false);
  });

  it("can require contained lines to appear in order", () => {
    const matcher = { outputMatchMode: "contains_lines" as const, containsLinesOrderMatters: true };
    expect(compareCodingExerciseOutput("first\nsecond", "prompt\nfirst\nignored\nsecond\n", matcher).matched).toBe(true);
    expect(compareCodingExerciseOutput("first\nsecond", "second\nfirst\n", matcher).matched).toBe(false);
  });

  it("supports safe RE2 search patterns across normalized program output", () => {
    const matcher = { outputMatchMode: "regex" as const, containsLinesOrderMatters: false };
    expect(compareCodingExerciseOutput("Poids: 12\\.5 kg", "prompt\nPoids: 12.5 kg\n", matcher).matched).toBe(true);
    expect(compareCodingExerciseOutput("Poids: 12\\.5 kg", "Poids: 12x5 kg\n", matcher).matched).toBe(false);
  });

  it("rejects empty, invalid, and unsupported regex patterns", () => {
    const matcher = { outputMatchMode: "regex" as const, containsLinesOrderMatters: false };
    expect(validateCodingExerciseOutputMatcher("", matcher)).toContain("non-empty");
    expect(validateCodingExerciseOutputMatcher("(", matcher)).toContain("Invalid");
    expect(validateCodingExerciseOutputMatcher("(a)\\1", matcher)).toContain("Invalid");
  });
});
