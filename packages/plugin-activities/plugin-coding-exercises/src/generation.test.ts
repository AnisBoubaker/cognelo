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

const { generateCodingExercisePrompt, generateCodingExerciseSolution, generateCodingExerciseTests } = await import("./generation");

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

  it("generates tests, caps hidden tests by schema, and reports validation failures", async () => {
    mocks.generateQuestionAuthoringText.mockResolvedValueOnce(
      JSON.stringify({
        sampleTests: [{ id: "sample-1", title: "Sample", input: "", output: "1" }],
        hiddenTests: [{ id: "hidden-1", name: "Hidden", stdin: "", expectedOutput: "1" }]
      })
    );

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
        templateVisibleLineNumbers: []
      })
    ).resolves.toMatchObject({ attempts: 1, hiddenTests: [{ id: "hidden-1" }] });
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
        templateVisibleLineNumbers: []
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
      templateVisibleLineNumbers: []
    })).rejects.toMatchObject({ status: 422, code: "REFERENCE_SOLUTION_COMPILATION_FAILED" });
    expect(mocks.generateQuestionAuthoringText).toHaveBeenCalledTimes(1);
  });
});
