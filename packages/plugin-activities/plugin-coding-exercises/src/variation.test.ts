import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  generatePrompt: vi.fn(),
  generateMetadata: vi.fn(),
  generateSolution: vi.fn(),
  generateTests: vi.fn(),
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

const [{ AppError }, { createCodingExerciseBankActivityVariation }] = await Promise.all([
  import("@cognelo/core"),
  import("./variation")
]);

describe("coding exercise bank variations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

  it("rejects a generated test suite that repeats the source tests", async () => {
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
    })).rejects.toMatchObject({ code: "CODING_EXERCISE_VARIATION_TESTS_NOT_DISTINCT" });
    expect(mocks.updateBankActivity).not.toHaveBeenCalled();
    expect(mocks.replacePrivate).not.toHaveBeenCalled();
  });

  it("refuses to save a variation whose visible or hidden test count changed", async () => {
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
});

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
