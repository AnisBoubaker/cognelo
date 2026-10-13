import { describe, expect, it } from "vitest";
import { applyGeneratedCodingExerciseTests } from "./coding-exercise-generated-tests";

const sample = {
  id: "repeated", title: "Existing sample", input: "1", output: "1", testCode: "",
  outputMatchMode: "exact" as const, containsLinesOrderMatters: true
};
const hidden = {
  id: "repeated-hidden", name: "Existing hidden", stdin: "2", expectedOutput: "2", testCode: "",
  outputMatchMode: "regex" as const, containsLinesOrderMatters: false,
  isEnabled: false, weight: 7, orderIndex: 0
};

describe("applying generated coding tests", () => {
  it("adds cases without modifying existing cases even when generated IDs collide", () => {
    const result = applyGeneratedCodingExerciseTests({
      mode: "add", currentSampleTests: [sample], currentHiddenTests: [hidden],
      sampleTests: [{ ...sample, title: "New sample" }],
      hiddenTests: [{ ...hidden, id: sample.id, name: "New hidden", isEnabled: true }],
      validationSummary: { accepted: true }
    });
    expect(result.sampleTests[0]).toBe(sample);
    expect(result.hiddenTests[0]).toBe(hidden);
    expect(result.sampleTests[1]).toMatchObject({ title: "New sample" });
    expect(result.hiddenTests[1]).toMatchObject({ name: "New hidden", orderIndex: 1 });
    const ids = [...result.sampleTests, ...result.hiddenTests].map((test) => test.id);
    expect(new Set(ids).size).toBe(4);
    expect(ids.every((id) => id.length <= 80)).toBe(true);
    expect(result.validationSummary).toBeNull();
  });

  it.each(["visible", "hidden"])("preserves the other kind when adding only %s tests", (kind) => {
    const result = applyGeneratedCodingExerciseTests({
      mode: "add", currentSampleTests: [sample], currentHiddenTests: [hidden],
      sampleTests: kind === "visible" ? [sample] : [], hiddenTests: kind === "hidden" ? [hidden] : [],
      validationSummary: { accepted: true }
    });
    expect(result.sampleTests).toHaveLength(kind === "visible" ? 2 : 1);
    expect(result.hiddenTests).toHaveLength(kind === "hidden" ? 2 : 1);
    expect(result.sampleTests[0]).toBe(sample);
    expect(result.hiddenTests[0]).toBe(hidden);
  });

  it.each(["visible", "hidden"])("replaces the suite with only %s tests and remaps validation IDs", (kind) => {
    const sampleTests = kind === "visible" ? [{ ...sample, id: "a".repeat(80) }] : [];
    const hiddenTests = kind === "hidden" ? [{ ...hidden, id: "b".repeat(80) }] : [];
    const result = applyGeneratedCodingExerciseTests({
      mode: "replace", currentSampleTests: [sample], currentHiddenTests: [hidden], sampleTests, hiddenTests,
      validationSummary: {
        accepted: true,
        sampleTests: { tests: sampleTests.map((test) => ({ id: test.id, passed: true })) },
        hiddenTests: { tests: hiddenTests.map((test) => ({ id: test.id, passed: true })) }
      }
    });
    expect(result.sampleTests).toHaveLength(sampleTests.length);
    expect(result.hiddenTests).toHaveLength(hiddenTests.length);
    expect(result.validationSummary).toMatchObject({
      accepted: true,
      sampleTests: { tests: result.sampleTests.map((test) => ({ id: test.id, passed: true })) },
      hiddenTests: { tests: result.hiddenTests.map((test) => ({ id: test.id, passed: true })) }
    });
    expect([...result.sampleTests, ...result.hiddenTests].every((test) => test.id.length <= 80)).toBe(true);
  });
});
