import type { CodingExerciseSampleTest } from "../coding-exercises";

export type TestGenerationMode = "add" | "replace";

export function applyGeneratedCodingExerciseTests<HiddenTest extends { id: string; orderIndex?: number }>(input: {
  mode: TestGenerationMode;
  currentSampleTests: CodingExerciseSampleTest[];
  currentHiddenTests: HiddenTest[];
  sampleTests: CodingExerciseSampleTest[];
  hiddenTests: HiddenTest[];
  validationSummary: Record<string, unknown>;
}) {
  // Generated IDs are model-controlled and can repeat across successive requests.
  // Give new cases independent IDs without changing any existing case.
  const addedSampleTests = input.sampleTests.map((test) => ({ ...test, id: `sample-${crypto.randomUUID()}` }));
  const addedHiddenTests = input.hiddenTests.map((test, index) => ({
    ...test,
    id: `hidden-${crypto.randomUUID()}`,
    orderIndex: (input.mode === "add" ? input.currentHiddenTests.length : 0) + index
  }));
  const validationSummary = { ...input.validationSummary };
  for (const [key, original, added] of [
    ["sampleTests", input.sampleTests, addedSampleTests],
    ["hiddenTests", input.hiddenTests, addedHiddenTests]
  ] as const) {
    const group = validationSummary[key];
    if (!group || typeof group !== "object" || !("tests" in group) || !Array.isArray(group.tests)) continue;
    const ids = new Map(original.map((test, index) => [test.id, added[index].id]));
    validationSummary[key] = {
      ...group,
      tests: group.tests.map((test: Record<string, unknown>) => ({ ...test, id: ids.get(String(test.id)) ?? test.id }))
    };
  }
  return {
    sampleTests: input.mode === "add" ? [...input.currentSampleTests, ...addedSampleTests] : addedSampleTests,
    hiddenTests: input.mode === "add" ? [...input.currentHiddenTests, ...addedHiddenTests] : addedHiddenTests,
    addedSampleTests,
    addedHiddenTests,
    // A generated summary covers only new cases. Save validates the combined suite
    // using the server's persisted fingerprints for any unchanged existing cases.
    validationSummary: input.mode === "add" ? null : validationSummary
  };
}
