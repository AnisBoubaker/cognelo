import { describe, expect, it, vi } from "vitest";
import { gradeCodingBlanks } from "./blank-grading";

const template = "{{ BLANK:a }} + {{ BLANK:b }} + {{ BLANK:c }}";
const referenceAnswers = { a: "1", b: "2", c: "3" };
const suite = (accepted: boolean) => ({ summary: { accepted } });

describe("code blank partial-credit policy", () => {
  it("awards every answered blank on a combined pass but leaves empty blanks incorrect", async () => {
    const runSuite = vi.fn(async () => suite(true));
    const result = await gradeCodingBlanks({ template, referenceAnswers, answers: { a: "1", b: "2", c: "" }, runSuite });
    expect(result.grading).toMatchObject({ method: "combined", total: 3, answered: 2, correct: 2 });
    expect(result.grading.outcomes[2]).toMatchObject({ answered: false, correct: false });
    expect(runSuite).toHaveBeenCalledTimes(1);
    expect(runSuite).toHaveBeenCalledWith("1 + 2 + 3", false);
  });

  it("isolates a noncompiling value without losing credit for correct answers elsewhere", async () => {
    const runSuite = vi.fn(async (source: string) => suite(!source.includes("bad")));
    const result = await gradeCodingBlanks({ template, referenceAnswers, answers: { a: "1", b: "bad(", c: "3" },
      checkSyntax: async source => !source.includes("bad"), runSuite });
    expect(result.grading).toMatchObject({ method: "isolated", correct: 2, total: 3, syntaxPassed: false });
    expect(result.reviewRequired).toBe(false);
    expect(runSuite).toHaveBeenCalledTimes(1); // Correct reference-identical variants share the same suite.
  });

  it("gives a fully correct alternative solution full credit without isolated checks", async () => {
    const runSuite = vi.fn(async () => suite(true));
    const result = await gradeCodingBlanks({ template, referenceAnswers, answers: { a: "3", b: "1", c: "2" }, runSuite });
    expect(result.grading).toMatchObject({ correct: 3, method: "combined" });
    expect(result.reviewRequired).toBe(false);
    expect(runSuite).toHaveBeenCalledTimes(1);
  });

  it("requires teacher review only when every isolated filling passes and the combined answer fails", async () => {
    const result = await gradeCodingBlanks({ template, referenceAnswers, answers: { a: "x", b: "y", c: "z" },
      runSuite: async source => suite(source !== "x + y + z") });
    expect(result.grading).toMatchObject({ method: "isolated", correct: 3, combinedPassed: false });
    expect(result.reviewRequired).toBe(true);
  });

  it("keeps empty blanks incorrect when isolating a syntactically valid wrong value", async () => {
    const runSuite = vi.fn(async (source: string) => suite(source === "1 + 2 + 3"));
    const result = await gradeCodingBlanks({ template, referenceAnswers, answers: { a: "1", b: "99", c: " " },
      checkSyntax: async () => true, runSuite });
    expect(result.grading).toMatchObject({ method: "isolated", syntaxPassed: true, correct: 1, answered: 2, total: 3 });
    expect(result.reviewRequired).toBe(false);
    expect(runSuite).toHaveBeenCalledTimes(2);
  });

  it("does not turn an infrastructure failure into an incorrect blank", async () => {
    await expect(gradeCodingBlanks({ template, referenceAnswers, answers: { a: "x", b: "y", c: "z" },
      runSuite: async source => { if (source === "x + 2 + 3") throw new Error("runner unavailable"); return suite(false); } }))
      .rejects.toThrow("runner unavailable");
  });

  it("awards zero to an untouched answer without executing teacher-filled code", async () => {
    const runSuite = vi.fn();
    const result = await gradeCodingBlanks({ template, referenceAnswers, answers: {}, runSuite });
    expect(result.grading).toMatchObject({ method: "empty", correct: 0, total: 3 });
    expect(result.reviewRequired).toBe(false);
    expect(runSuite).not.toHaveBeenCalled();
  });
});
