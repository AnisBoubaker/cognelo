import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  generateQuestionAuthoringText: vi.fn(),
  validateReferenceSolutionAgainstHiddenTests: vi.fn()
}));

vi.mock("@cognelo/core", async () => {
  const actual = await vi.importActual<typeof import("@cognelo/core")>("@cognelo/core");
  return {
    ...actual,
    generateQuestionAuthoringText: mocks.generateQuestionAuthoringText
  };
});

vi.mock("./executions", () => ({
  validateReferenceSolutionAgainstHiddenTests: mocks.validateReferenceSolutionAgainstHiddenTests
}));

const {
  codingExerciseTestsGenerationInputSchema,
  generateCodingExercisePrompt,
  generateCodingExerciseRubric,
  generateCodingExerciseSolution,
  generateCodingExerciseTests
} = await import("./generation");

const user = {
  id: "teacher-1",
  email: "teacher@example.test",
  name: null,
  firstName: null,
  lastName: null,
  roles: ["teacher" as const]
};

const subject = { title: "Programming", description: "Python basics" };

describe("coding exercise AI generation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.validateReferenceSolutionAgainstHiddenTests.mockResolvedValue({
      accepted: true,
      sampleTests: { tests: [] },
      hiddenTests: { tests: [] }
    });
  });

  it("retries prompt generation after invalid text", async () => {
    mocks.generateQuestionAuthoringText
      .mockResolvedValueOnce("too short")
      .mockResolvedValueOnce("Write a Python function for a classroom gradebook that returns the highest score from a list.");

    await expect(
      generateCodingExercisePrompt({
        user,
        description: "Maximum value practice",
        language: "python",
        locale: "en",
        subject
      })
    ).resolves.toMatchObject({ attempts: 2 });
  });

  it("generates solution payloads and returns impossible/error payloads", async () => {
    mocks.generateQuestionAuthoringText.mockResolvedValue(
      JSON.stringify({
        status: "ok",
        referenceSolution: "print(1)",
        templateSource: "{{ STUDENT_CODE }}",
        templateVisibleLineNumbers: []
      })
    );

    await expect(
      generateCodingExerciseSolution({
        user,
        description: "Return one",
        prompt: "Write a function that returns one.",
        language: "python",
        locale: "en",
        subject
      })
    ).resolves.toMatchObject({ status: "ok", starterCode: "", attempts: 1 });

    mocks.generateQuestionAuthoringText.mockResolvedValue(JSON.stringify({ status: "error", message: "This cannot be made into a coding task." }));
    await expect(
      generateCodingExerciseSolution({
        user,
        description: "Impossible",
        prompt: "Impossible task prompt.",
        language: "python",
        locale: "en",
        subject
      })
    ).resolves.toMatchObject({ status: "error", attempts: 1 });
  });

  it("validates generated-test count defaults and the per-kind maximum", () => {
    const baseInput = {
      description: "Return one",
      prompt: "Write a function that returns one.",
      language: "python",
      locale: "en" as const,
      referenceSolution: "print(1)",
      templateSource: "{{ STUDENT_CODE }}"
    };

    expect(codingExerciseTestsGenerationInputSchema.parse(baseInput)).toMatchObject({
      visibleTestCount: 3,
      hiddenTestCount: 8
    });
    expect(codingExerciseTestsGenerationInputSchema.parse({
      ...baseInput,
      visibleTestCount: 15,
      hiddenTestCount: 15
    })).toMatchObject({ visibleTestCount: 15, hiddenTestCount: 15 });
    expect(() => codingExerciseTestsGenerationInputSchema.parse({ ...baseInput, visibleTestCount: 16 })).toThrow();
    expect(() => codingExerciseTestsGenerationInputSchema.parse({ ...baseInput, hiddenTestCount: 16 })).toThrow();
  });

  it("retries when the model does not return the requested test counts", async () => {
    const testPayload = (visibleCount: number, hiddenCount: number) => ({
      sampleTests: Array.from({ length: visibleCount }, (_, index) => ({
        id: `sample-${index + 1}`,
        title: `Sample ${index + 1}`,
        input: String(index),
        output: String(index)
      })),
      hiddenTests: Array.from({ length: hiddenCount }, (_, index) => ({
        id: `hidden-${index + 1}`,
        name: `Hidden ${index + 1}`,
        stdin: String(index),
        expectedOutput: String(index)
      }))
    });
    mocks.generateQuestionAuthoringText
      .mockResolvedValueOnce(JSON.stringify(testPayload(1, 1)))
      .mockResolvedValueOnce(JSON.stringify(testPayload(2, 2)));

    await expect(generateCodingExerciseTests({
      user,
      description: "Return one",
      prompt: "Write a function that returns one.",
      language: "python",
      locale: "en",
      subject,
      referenceSolution: "print(1)",
      templateSource: "{{ STUDENT_CODE }}",
      templateVisibleLineNumbers: [],
      visibleTestCount: 2,
      hiddenTestCount: 2
    })).resolves.toMatchObject({ attempts: 2 });

    expect(mocks.generateQuestionAuthoringText.mock.calls[1]?.[1]?.userPrompt).toContain(
      "Generate exactly 2 visible sample tests; received 1."
    );
    expect(mocks.generateQuestionAuthoringText.mock.calls[1]?.[1]?.userPrompt).toContain(
      "Generate exactly 2 hidden tests; received 1."
    );
    expect(mocks.validateReferenceSolutionAgainstHiddenTests).toHaveBeenCalledTimes(1);
  });

  it("requires generated test names to be descriptive and no longer than fifty characters", async () => {
    mocks.generateQuestionAuthoringText
      .mockResolvedValueOnce(JSON.stringify({
        sampleTests: [{ id: "sample-1", title: "x".repeat(51), input: "-3", output: "0" }],
        hiddenTests: [{ id: "hidden-1", name: "Negative case", stdin: "6", expectedOutput: "720" }]
      }))
      .mockResolvedValueOnce(JSON.stringify({
        sampleTests: [{ id: "sample-1", title: "Factorial -3 should give 0", input: "-3", output: "0" }],
        hiddenTests: [{ id: "hidden-1", name: "Factorial 6 should give 720", stdin: "6", expectedOutput: "720" }]
      }));

    const generated = await generateCodingExerciseTests({
      user,
      description: "Calculate a factorial",
      prompt: "Calculate the factorial of the provided integer.",
      language: "python",
      locale: "en",
      subject,
      referenceSolution: "print(1)",
      templateSource: "{{ STUDENT_CODE }}",
      templateVisibleLineNumbers: [],
      visibleTestCount: 1,
      hiddenTestCount: 1
    });

    expect(generated).toMatchObject({
      attempts: 2,
      sampleTests: [{ title: "Factorial -3 should give 0" }],
      hiddenTests: [{ name: "Factorial 6 should give 720" }]
    });
    expect(mocks.validateReferenceSolutionAgainstHiddenTests).toHaveBeenCalledTimes(1);
    expect(mocks.generateQuestionAuthoringText.mock.calls[0]?.[1]?.systemPrompt).toContain(
      "title/name of at most 50 characters"
    );
    expect(mocks.generateQuestionAuthoringText.mock.calls[0]?.[1]?.systemPrompt).toContain(
      "Factorial -3 should give 0"
    );
  });

  it("generates the requested counts as contains-lines tests and reports validation failures", async () => {
    const sampleTests = Array.from({ length: 2 }, (_, index) => ({
      id: `sample-${index + 1}`,
      title: `Sample ${index + 1}`,
      input: String(index),
      output: String(index),
      outputMatchMode: "exact"
    }));
    const hiddenTests = Array.from({ length: 3 }, (_, index) => ({
      id: `hidden-${index + 1}`,
      name: `Hidden ${index + 1}`,
      stdin: String(index + 2),
      expectedOutput: String(index + 2),
      outputMatchMode: "regex"
    }));
    mocks.generateQuestionAuthoringText.mockResolvedValueOnce(
      JSON.stringify({
        sampleTests,
        hiddenTests
      })
    );

    const generated = await generateCodingExerciseTests({
      user,
      description: "Return one",
      prompt: "Write a function that returns one.",
      language: "python",
      locale: "en",
      subject,
      referenceSolution: "print(1)",
      templateSource: "{{ STUDENT_CODE }}",
      templateVisibleLineNumbers: [],
      visibleTestCount: 2,
      hiddenTestCount: 3
    });
    expect(generated).toMatchObject({ attempts: 1 });
    if (generated.status === "error") throw new Error("Expected generated tests.");
    expect(generated.sampleTests).toHaveLength(2);
    expect(generated.hiddenTests).toHaveLength(3);
    expect([...generated.sampleTests, ...generated.hiddenTests]).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ outputMatchMode: "contains_lines", containsLinesOrderMatters: false })
      ])
    );
    expect([...generated.sampleTests, ...generated.hiddenTests].every(
      (test) => test.outputMatchMode === "contains_lines" && test.containsLinesOrderMatters === false
    )).toBe(true);
    expect(mocks.validateReferenceSolutionAgainstHiddenTests).toHaveBeenCalledWith(expect.objectContaining({
      sampleTests: expect.arrayContaining([expect.objectContaining({ outputMatchMode: "contains_lines" })]),
      hiddenTests: expect.arrayContaining([expect.objectContaining({ outputMatchMode: "contains_lines" })])
    }));
    expect(mocks.generateQuestionAuthoringText.mock.calls[0]?.[1]?.systemPrompt).toContain("exactly 2 visible sample tests and exactly 3 hidden tests");
    expect(mocks.generateQuestionAuthoringText.mock.calls[0]?.[1]?.systemPrompt).toContain("outputMatchMode contains_lines");
    expect(mocks.generateQuestionAuthoringText.mock.calls[0]?.[1]?.systemPrompt).toContain("reproduce the same test case as a visible test with different input values");
    expect(mocks.generateQuestionAuthoringText.mock.calls[0]?.[1]?.systemPrompt).toContain("title/name of at most 50 characters");
    expect(mocks.generateQuestionAuthoringText.mock.calls[0]?.[1]?.systemPrompt).toContain("exit code 0");
    expect(mocks.generateQuestionAuthoringText.mock.calls[0]?.[1]?.systemPrompt).toContain("floating-point comparisons");

    mocks.validateReferenceSolutionAgainstHiddenTests.mockResolvedValue({ accepted: false, sampleTests: { tests: [] }, hiddenTests: { tests: [] } });
    mocks.generateQuestionAuthoringText.mockResolvedValue(JSON.stringify({ sampleTests: [], hiddenTests: [] }));
    await expect(
      generateCodingExerciseTests({
        user,
        description: "Return one",
        prompt: "Write a function that returns one.",
        language: "python",
        locale: "en",
        subject,
        referenceSolution: "print(1)",
        templateSource: "{{ STUDENT_CODE }}",
        templateVisibleLineNumbers: [],
        visibleTestCount: 1,
        hiddenTestCount: 1
      })
    ).rejects.toMatchObject({ status: 422, code: "CODING_EXERCISE_TEST_GENERATION_INVALID" });
  });

  it("stops retrying when Judge0 cannot compile the reviewed reference solution", async () => {
    mocks.generateQuestionAuthoringText.mockResolvedValue(JSON.stringify({
      sampleTests: [{ id: "sample-1", title: "Sample", input: "1", output: "1" }],
      hiddenTests: [{ id: "hidden-1", name: "Hidden", stdin: "1", expectedOutput: "1" }]
    }));
    mocks.validateReferenceSolutionAgainstHiddenTests.mockResolvedValue({
      accepted: false,
      sampleTests: { tests: [{ id: "sample-1", name: "Sample", passed: false, statusLabel: "Compilation Error" }] },
      hiddenTests: { tests: [{ id: "hidden-1", name: "Hidden", passed: false, statusLabel: "Compilation Error" }] }
    });

    await expect(generateCodingExerciseTests({
      user,
      description: "Compile a C program",
      prompt: "Read and print one number.",
      language: "c",
      locale: "en",
      subject,
      referenceSolution: "int main(void) { return 0; }",
      templateSource: "{{ STUDENT_CODE }}",
      templateVisibleLineNumbers: [],
      visibleTestCount: 1,
      hiddenTestCount: 1
    })).rejects.toMatchObject({ status: 422, code: "REFERENCE_SOLUTION_COMPILATION_FAILED" });
    expect(mocks.generateQuestionAuthoringText).toHaveBeenCalledTimes(1);
  });

  it("generates a weighted rubric from the title, prompt, and reference solution", async () => {
    mocks.generateQuestionAuthoringText
      .mockResolvedValueOnce(JSON.stringify({
        criteria: [{ title: "Correctness", description: "Evaluate the result.", weightPercent: 90 }]
      }))
      .mockResolvedValueOnce(JSON.stringify({
        criteria: [
          { title: "Correctness", description: "Evaluate the result and required behavior.", weightPercent: 70 },
          { title: "Clarity", description: "Evaluate code clarity and approach.", weightPercent: 30 }
        ]
      }));

    await expect(generateCodingExerciseRubric({
      user,
      title: "Find the smallest value",
      description: "Compare three values.",
      prompt: "Read three values and display the smallest value.",
      referenceSolution: "print(min(map(float, input().split())))",
      language: "python",
      locale: "fr",
      subject
    })).resolves.toMatchObject({
      attempts: 2,
      criteria: [
        { id: expect.stringMatching(/^criterion-/), title: "Correctness", weightPercent: 70 },
        { id: expect.stringMatching(/^criterion-/), title: "Clarity", weightPercent: 30 }
      ]
    });
    expect(mocks.generateQuestionAuthoringText.mock.calls[0]?.[1]?.systemPrompt).toContain("French");
    expect(mocks.generateQuestionAuthoringText.mock.calls[0]?.[1]?.systemPrompt).toContain("Do not include a rubric name");
    expect(mocks.generateQuestionAuthoringText.mock.calls[0]?.[1]?.userPrompt).toContain("Find the smallest value");
    expect(mocks.generateQuestionAuthoringText.mock.calls[0]?.[1]?.userPrompt).toContain("<reference_solution>");
  });
});
