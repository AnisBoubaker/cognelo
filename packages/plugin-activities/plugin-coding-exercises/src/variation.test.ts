import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  generatePrompt: vi.fn(),
  generateMetadata: vi.fn(),
  generateSolution: vi.fn(),
  generateTests: vi.fn(),
  review: vi.fn(),
  listPrivate: vi.fn(),
  replacePrivate: vi.fn(),
  updateBankActivity: vi.fn()
}));

vi.mock("@cognelo/core", () => ({
  AppError: class AppError extends Error {
    constructor(public status: number, public code: string, message: string, public details?: unknown) { super(message); }
  },
  updateBankActivity: mocks.updateBankActivity
}));
vi.mock("./generation", () => ({
  generateCodingExercisePrompt: mocks.generatePrompt,
  generateCodingExerciseVariationMetadata: mocks.generateMetadata,
  generateCodingExerciseSolution: mocks.generateSolution,
  generateCodingExerciseTests: mocks.generateTests
}));
vi.mock("./hidden-tests", () => ({
  listBankCodingExerciseHiddenTests: mocks.listPrivate,
  replaceBankCodingExerciseHiddenTests: mocks.replacePrivate
}));
vi.mock("./variation-quality", () => ({ reviewCodingExerciseVariation: mocks.review }));

// Load the mocked error class first so concurrent mock-factory evaluation cannot
// give the variation handler a different AppError constructor for instanceof.
const { AppError } = await import("@cognelo/core");
const { createCodingExerciseBankActivityVariation } = await import("./variation");

describe("coding exercise bank variations", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.review.mockResolvedValue([]);
    mocks.listPrivate.mockResolvedValue({
      tests: [{ id: "hidden-original", name: "Original", stdin: "1", expectedOutput: "2", testCode: "", isEnabled: true, weight: 7, outputMatchMode: "exact", containsLinesOrderMatters: false }],
      referenceSolution: {
        sourceCode: "print(int(input()) + 1)",
        privateConfig: {
          templateSource: "{{ STUDENT_CODE }}",
          templateVisibleLineNumbers: [],
          aiFeedback: {
            enabled: true,
            gradingEnabled: true,
            instructions: "Use the rubric.",
            testWeightPercent: 60,
            aiWeightPercent: 40,
            criteria: [{ id: "criterion-1", title: "Correctness", description: "Correct algorithm", weightPercent: 100 }]
          }
        }
      }
    });
    mocks.generatePrompt.mockResolvedValue({ prompt: "Write a different program that doubles the supplied integer." });
    mocks.generateMetadata.mockResolvedValue({
      title: "Double an integer",
      description: "Read an integer and produce twice its value.",
      attempts: 1
    });
    mocks.generateSolution.mockResolvedValue({
      status: "ok",
      referenceSolution: "print(int(input()) * 2)",
      templateSource: "{{ STUDENT_CODE }}",
      templateVisibleLineNumbers: [],
      starterCode: ""
    });
    mocks.generateTests.mockResolvedValue({
      status: "ok",
      sampleTests: [{ id: "sample-new", title: "Doubles two", input: "2", output: "4", testCode: "", outputMatchMode: "contains_lines", containsLinesOrderMatters: false }],
      hiddenTests: [{ id: "hidden-new", name: "Doubles three", stdin: "3", expectedOutput: "6", testCode: "", isEnabled: true, weight: 1, outputMatchMode: "contains_lines", containsLinesOrderMatters: false }]
    });
    mocks.updateBankActivity.mockResolvedValue({});
    mocks.replacePrivate.mockResolvedValue({});
  });

  it("regenerates prompt, solution, and tests while preserving an independent copied rubric", async () => {
    const reportProgress = vi.fn(async () => undefined);
    await createCodingExerciseBankActivityVariation({
      user: { id: "teacher-1", email: "teacher@example.test", name: null, firstName: null, lastName: null, roles: ["teacher"] },
      activityBankId: "bank-1",
      sourceActivity: activity("source-1"),
      activity: activity("variation-1"),
      instructions: "Use a multiplication problem.",
      locale: "en",
      subject: { title: "Programming", description: "Introductory programming" },
      knowledge: { mode: "selected", concepts: [], selectedConcepts: [] },
      reportProgress
    });

    expect(mocks.updateBankActivity).toHaveBeenCalledWith(expect.anything(), "variation-1", expect.objectContaining({
      title: "Double an integer",
      description: "Read an integer and produce twice its value.",
      config: expect.objectContaining({ prompt: "Write a different program that doubles the supplied integer." })
    }));
    expect(mocks.generateTests).toHaveBeenCalledWith(expect.objectContaining({
      visibleTestCount: 1,
      hiddenTestCount: 1
    }));
    const privateSave = mocks.replacePrivate.mock.calls[0][0];
    expect(privateSave.bankActivityId).toBe("variation-1");
    expect(privateSave.input.privateConfig.aiFeedback).toEqual({
      enabled: true,
      gradingEnabled: true,
      instructions: "Use the rubric.",
      testWeightPercent: 60,
      aiWeightPercent: 40,
      criteria: [{ id: "criterion-1", title: "Correctness", description: "Correct algorithm", weightPercent: 100 }]
    });
    expect(privateSave.input.tests[0].weight).toBe(7);
    expect(reportProgress).toHaveBeenCalledWith({ fraction: 0.82, step: "validating" });
  });

  it.each([
    "Only variable names and the story changed; the algorithm is identical.",
    "Strictly increasing dice rolls yield 20/216 (9.26%), not 4/216 (1.85%).",
    "The solution requires advanced concepts outside the original learning objectives."
  ])("regenerates the whole candidate before generating tests: %s", async (issue) => {
    mocks.generatePrompt.mockResolvedValueOnce({ prompt: "A renamed version of the original exercise." });
    mocks.generateSolution.mockResolvedValueOnce({
      status: "ok", referenceSolution: "value = int(input()); print(value + 1)",
      templateSource: "{{ STUDENT_CODE }}", templateVisibleLineNumbers: [], starterCode: ""
    });
    mocks.review.mockResolvedValueOnce([issue]);
    await createCodingExerciseBankActivityVariation(variationInput());
    expect(mocks.generatePrompt).toHaveBeenCalledTimes(2);
    expect(mocks.generateSolution).toHaveBeenCalledTimes(2);
    expect(mocks.generatePrompt.mock.calls[1][0].description).toContain(issue);
    expect(mocks.generateSolution.mock.calls[1][0].description).toContain(issue);
    expect(mocks.generateTests).toHaveBeenCalledTimes(1);
    expect(mocks.generateTests.mock.calls[0][0].referenceSolution).toBe("print(int(input()) * 2)");
    expect(mocks.generateMetadata).toHaveBeenCalledTimes(1);
    expect(mocks.generateMetadata.mock.calls[0][0].prompt).toContain("doubles");
    expect(mocks.replacePrivate.mock.calls[0][0].input.referenceSolution).toBe("print(int(input()) * 2)");
  });

  it("fails after three rejected candidates without saving or treating rejection as missing tests", async () => {
    mocks.review.mockResolvedValue(["Same algorithm with renamed variables."]);
    await expect(createCodingExerciseBankActivityVariation(variationInput())).rejects.toMatchObject({
      code: "CODING_EXERCISE_VARIATION_QUALITY_FAILED"
    });
    expect(mocks.generatePrompt).toHaveBeenCalledTimes(3);
    expect(mocks.generateSolution).toHaveBeenCalledTimes(3);
    expect(mocks.generateTests).not.toHaveBeenCalled();
    expect(mocks.generateMetadata).not.toHaveBeenCalled();
    expect(mocks.replacePrivate).not.toHaveBeenCalled();
    expect(mocks.updateBankActivity).not.toHaveBeenCalled();
  });

  it("passes the complete source and rubric to generation and review without truncating the algorithm", async () => {
    const original = await mocks.listPrivate();
    const referenceSolution = "// required helper\n".repeat(200) + "original_algorithm_at_end();";
    mocks.listPrivate.mockResolvedValue({ ...original, referenceSolution: { ...original.referenceSolution, sourceCode: referenceSolution } });
    const input = variationInput();
    input.sourceActivity.config.prompt = "Course constraints. ".repeat(400) + "Required helper: nb_aleatoire.";
    await createCodingExerciseBankActivityVariation(input);
    const brief = mocks.generatePrompt.mock.calls[0][0].description;
    expect(brief).toContain(input.sourceActivity.config.prompt);
    expect(brief).toContain(referenceSolution);
    expect(brief).toContain("Correct algorithm");
    expect(mocks.review.mock.calls[0][0]).toMatchObject({
      source: { prompt: input.sourceActivity.config.prompt, referenceSolution, rubric: original.referenceSolution.privateConfig.aiFeedback },
      knowledge: input.knowledge
    });
  });

  it("retains the qualified solution when a testability retry fails quality review", async () => {
    mocks.generateTests.mockRejectedValueOnce(new AppError(422, "CODING_EXERCISE_TEST_GENERATION_INVALID", "Tests failed."));
    const initial = await mocks.generateSolution();
    mocks.generateSolution.mockClear().mockResolvedValueOnce(initial).mockResolvedValueOnce({ ...initial, referenceSolution: "print(int(input()) + 1)" });
    mocks.review.mockResolvedValueOnce([]).mockResolvedValueOnce(["Repeated original algorithm."]);
    await expect(createCodingExerciseBankActivityVariation(variationInput())).resolves.toMatchObject({ warnings: [{ code: "CODING_EXERCISE_VARIATION_INCOMPLETE_TESTS" }] });
    expect(mocks.review).toHaveBeenCalledTimes(2);
    expect(mocks.generateTests).toHaveBeenCalledTimes(1);
    expect(mocks.replacePrivate.mock.calls[0][0].input).toMatchObject({ referenceSolution: initial.referenceSolution, sampleTests: [], tests: [] });
  });

  it("does not save an unreviewed candidate when the reviewer is unavailable", async () => {
    mocks.review.mockRejectedValueOnce(new Error("Reviewer unavailable."));
    await expect(createCodingExerciseBankActivityVariation(variationInput())).rejects.toThrow("Reviewer unavailable.");
    expect(mocks.replacePrivate).not.toHaveBeenCalled();
    expect(mocks.updateBankActivity).not.toHaveBeenCalled();
  });

  it("omits a generated suite that repeats the source and keeps the new exercise with a review warning", async () => {
    mocks.generateTests.mockResolvedValue({
      status: "ok",
      sampleTests: [{ id: "sample-new", title: "Adds one", input: "1", output: "2", testCode: "", outputMatchMode: "exact", containsLinesOrderMatters: false }],
      hiddenTests: [{ id: "hidden-new", name: "Original", stdin: "1", expectedOutput: "2", testCode: "", isEnabled: true, weight: 1, outputMatchMode: "exact", containsLinesOrderMatters: false }]
    });

    await expect(createCodingExerciseBankActivityVariation({
      user: { id: "teacher-1", email: "teacher@example.test", name: null, firstName: null, lastName: null, roles: ["teacher"] },
      activityBankId: "bank-1",
      sourceActivity: activity("source-1"),
      activity: activity("variation-1"),
      instructions: "",
      locale: "en",
      subject: { title: "Programming", description: "Introductory programming" },
      knowledge: { mode: "selected", concepts: [], selectedConcepts: [] },
      reportProgress: vi.fn(async () => undefined)
    })).resolves.toMatchObject({ warnings: [{ code: "CODING_EXERCISE_VARIATION_INCOMPLETE_TESTS" }] });
    expect(mocks.updateBankActivity).toHaveBeenCalled();
    expect(mocks.replacePrivate.mock.calls[0][0].input).toMatchObject({ sampleTests: [], tests: [] });
  });

  it("refuses an oversized generated suite", async () => {
    mocks.generateTests.mockResolvedValue({
      status: "ok",
      sampleTests: [
        { id: "sample-new-1", title: "Doubles two", input: "2", output: "4", testCode: "" },
        { id: "sample-new-2", title: "Doubles four", input: "4", output: "8", testCode: "" }
      ],
      hiddenTests: [{ id: "hidden-new", name: "Doubles three", stdin: "3", expectedOutput: "6", testCode: "", isEnabled: true, weight: 1 }]
    });

    await expect(createCodingExerciseBankActivityVariation({
      user: { id: "teacher-1", email: "teacher@example.test", name: null, firstName: null, lastName: null, roles: ["teacher"] },
      activityBankId: "bank-1",
      sourceActivity: activity("source-1"),
      activity: activity("variation-1"),
      instructions: "",
      locale: "en",
      subject: { title: "Programming", description: "Introductory programming" },
      knowledge: { mode: "selected", concepts: [], selectedConcepts: [] },
      reportProgress: vi.fn(async () => undefined)
    })).rejects.toMatchObject({ code: "CODING_EXERCISE_VARIATION_TEST_COUNT_MISMATCH" });

    expect(mocks.updateBankActivity).not.toHaveBeenCalled();
    expect(mocks.replacePrivate).not.toHaveBeenCalled();
  });

  it("regenerates the solution and template when they cannot support the required tests", async () => {
    mocks.generateSolution
      .mockResolvedValueOnce({
        status: "ok",
        referenceSolution: "print_fixed_examples();",
        templateSource: "{{ STUDENT_CODE }}",
        templateVisibleLineNumbers: [],
        starterCode: ""
      })
      .mockResolvedValueOnce({
        status: "ok",
        referenceSolution: "int double_value(int value) { return value * 2; }",
        templateSource: "{{ STUDENT_CODE }}\n\n{{ TEST_CODE }}",
        templateVisibleLineNumbers: [],
        starterCode: ""
      });
    mocks.generateTests.mockRejectedValueOnce(new AppError(
      422,
      "CODING_EXERCISE_TEST_GENERATION_INVALID",
      "The AI agent could not generate valid coding exercise tests.",
      { issues: ["Every varying stdin case produced the same fixed stdout."] }
    ));

    await createCodingExerciseBankActivityVariation({
      user: { id: "teacher-1", email: "teacher@example.test", name: null, firstName: null, lastName: null, roles: ["teacher"] },
      activityBankId: "bank-1",
      sourceActivity: activity("source-1"),
      activity: activity("variation-1"),
      instructions: "",
      locale: "en",
      subject: { title: "Programming", description: "Introductory programming" },
      knowledge: { mode: "selected", concepts: [], selectedConcepts: [] },
      reportProgress: vi.fn(async () => undefined)
    });

    expect(mocks.generateSolution).toHaveBeenCalledTimes(2);
    expect(mocks.generateSolution.mock.calls[1]?.[0]?.description).toContain(
      "previous reference solution/template could not support the required automated test suite"
    );
    expect(mocks.generateSolution.mock.calls[1]?.[0]?.description).toContain(
      "Every varying stdin case produced the same fixed stdout."
    );
    expect(mocks.generateTests).toHaveBeenCalledTimes(2);
    expect(mocks.replacePrivate.mock.calls[0]?.[0]?.input.referenceSolution).toContain("double_value");
  });

  it.each(["sampleTests", "hiddenTests"] as const)("keeps passing tests when %s could not be generated", async (missing) => {
    const generated = await mocks.generateTests();
    mocks.generateTests.mockClear().mockResolvedValue({ ...generated, status: "warning", [missing]: [] });
    const result = await createCodingExerciseBankActivityVariation(variationInput());
    expect(result).toMatchObject({ warnings: [{
      code: "CODING_EXERCISE_VARIATION_INCOMPLETE_TESTS",
      message: expect.stringContaining("Review the reference solution, template, missing test coverage, and hidden-test weights")
    }] });
    expect(mocks.generateSolution).toHaveBeenCalledTimes(1);
    const saved = mocks.replacePrivate.mock.calls[0][0].input;
    expect(saved.sampleTests).toHaveLength(missing === "sampleTests" ? 0 : 1);
    expect(saved.tests).toHaveLength(missing === "hiddenTests" ? 0 : 1);
    if (missing === "sampleTests") expect(saved.tests[0].weight).toBe(7);
    expect(mocks.updateBankActivity.mock.calls[0][2].config.sampleTests).toEqual(saved.sampleTests);
  });

  it.each(["invalid tests", "compilation failure", "model declined"])("saves a reviewable exercise without tests after repeated %s", async (failure) => {
    if (failure === "model declined") mocks.generateTests.mockResolvedValue({ status: "error", message: "Cannot generate meaningful tests." });
    else mocks.generateTests.mockRejectedValue(new AppError(422,
      failure === "invalid tests" ? "CODING_EXERCISE_TEST_GENERATION_INVALID" : "REFERENCE_SOLUTION_COMPILATION_FAILED", "Tests failed."
    ));
    const result = await createCodingExerciseBankActivityVariation(variationInput());
    expect(result).toMatchObject({ warnings: [{ message: expect.stringContaining("Kept 0 of 1 visible tests and 0 of 1 hidden tests") }] });
    expect(mocks.generateTests).toHaveBeenCalledTimes(2);
    expect(mocks.replacePrivate.mock.calls[0][0].input).toMatchObject({
      sampleTests: [], tests: [], referenceSolution: "print(int(input()) * 2)"
    });
    expect(mocks.updateBankActivity.mock.calls[0][2]).toMatchObject({ title: "Double an integer", lifecycle: "draft", config: { sampleTests: [] } });
  });

  it("drops a case that fails the final save validation while retaining the other passing cases", async () => {
    mocks.replacePrivate.mockRejectedValueOnce(new AppError(422, "REFERENCE_SOLUTION_VALIDATION_FAILED", "Hidden test failed.", {
      validationSummary: {
        sampleTests: { tests: [{ id: "sample-new", passed: true }] },
        hiddenTests: { tests: [{ id: "hidden-new", passed: false }] }
      }
    }));
    const result = await createCodingExerciseBankActivityVariation(variationInput());
    expect(result).toMatchObject({ warnings: [{ message: expect.stringContaining("Kept 1 of 1 visible tests and 0 of 1 hidden tests") }] });
    expect(mocks.replacePrivate).toHaveBeenCalledTimes(2);
    expect(mocks.replacePrivate.mock.calls[1][0].input).toMatchObject({ sampleTests: [{ id: "sample-new" }], tests: [] });
  });

  it("keeps the earlier generated solution if the optional testability retry fails", async () => {
    const initialSolution = await mocks.generateSolution();
    mocks.generateSolution.mockClear().mockResolvedValueOnce(initialSolution).mockRejectedValueOnce(new Error("Model unavailable for the optional retry."));
    mocks.generateTests.mockRejectedValue(new AppError(422, "CODING_EXERCISE_TEST_GENERATION_INVALID", "Tests failed."));
    await expect(createCodingExerciseBankActivityVariation(variationInput())).resolves.toMatchObject({
      warnings: [{ code: "CODING_EXERCISE_VARIATION_INCOMPLETE_TESTS" }]
    });
    expect(mocks.replacePrivate.mock.calls[0][0].input).toMatchObject({
      sampleTests: [], tests: [], referenceSolution: initialSolution.referenceSolution
    });
  });

  it("still fails on execution-service or persistence errors", async () => {
    mocks.generateTests.mockRejectedValueOnce(new AppError(503, "JUDGE0_EXECUTION_UNAVAILABLE", "Runner unavailable."));
    await expect(createCodingExerciseBankActivityVariation(variationInput())).rejects.toMatchObject({ code: "JUDGE0_EXECUTION_UNAVAILABLE" });
    expect(mocks.replacePrivate).not.toHaveBeenCalled();
    mocks.replacePrivate.mockRejectedValueOnce(new Error("Database unavailable."));
    await expect(createCodingExerciseBankActivityVariation(variationInput())).rejects.toThrow("Database unavailable.");
    expect(mocks.updateBankActivity).not.toHaveBeenCalled();
  });

  it("does not warn when the source intentionally has no tests", async () => {
    const original = await mocks.listPrivate();
    mocks.listPrivate.mockResolvedValue({ ...original, tests: [] });
    const input = variationInput();
    input.sourceActivity.config.sampleTests = [];
    await expect(createCodingExerciseBankActivityVariation(input)).resolves.toEqual({ warnings: [] });
    expect(mocks.generateTests).not.toHaveBeenCalled();
  });
});

function variationInput() {
  return {
    user: { id: "teacher-1", email: "teacher@example.test", name: null, firstName: null, lastName: null, roles: ["teacher" as const] },
    activityBankId: "bank-1", sourceActivity: activity("source-1"), activity: activity("variation-1"),
    instructions: "", locale: "en" as const, subject: { title: "Programming", description: "Introductory programming" },
    knowledge: { mode: "selected" as const, concepts: [], selectedConcepts: [] },
    reportProgress: vi.fn(async () => undefined)
  };
}

function activity(id: string) {
  return {
    id,
    title: "Add one",
    description: "Increment an integer.",
    lifecycle: "draft",
    config: {
      prompt: "Write a program that adds one to the supplied integer.",
      language: "python",
      executionMode: "template",
      starterCode: "",
      studentTemplateSource: "{{ STUDENT_CODE }}",
      sampleTests: [{ id: "sample-original", title: "Adds one", input: "1", output: "2", testCode: "" }],
      maxEditorSeconds: 1800
    },
    activityType: { key: "coding-exercise", name: "Coding exercise", description: "" }
  };
}
