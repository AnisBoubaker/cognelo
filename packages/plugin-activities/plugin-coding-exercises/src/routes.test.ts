import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  assertCanManageActivityBank: vi.fn(),
  assertCanManageCourse: vi.fn(),
  generateCodingExercisePrompt: vi.fn(),
  generateCodingExerciseSolution: vi.fn(),
  generateCodingExerciseTests: vi.fn(),
  listCodingExerciseHiddenTests: vi.fn(),
  listRecentCodingExerciseExecutions: vi.fn(),
  replaceCodingExerciseHiddenTests: vi.fn(),
  runCodingExercise: vi.fn(),
  submitCodingExercise: vi.fn(),
  prisma: {
    course: { findUnique: vi.fn() }
  }
}));

vi.mock("@cognelo/core", async () => {
  const actual = await vi.importActual<typeof import("@cognelo/core")>("@cognelo/core");
  return {
    ...actual,
    assertCanManageActivityBank: mocks.assertCanManageActivityBank,
    assertCanManageCourse: mocks.assertCanManageCourse
  };
});

vi.mock("@cognelo/db", () => ({ prisma: mocks.prisma }));

vi.mock("./executions", async () => {
  const actual = await vi.importActual<typeof import("./executions")>("./executions");
  return {
    ...actual,
    listRecentCodingExerciseExecutions: mocks.listRecentCodingExerciseExecutions,
    runCodingExercise: mocks.runCodingExercise,
    submitCodingExercise: mocks.submitCodingExercise
  };
});

vi.mock("./hidden-tests", () => ({
  listBankCodingExerciseHiddenTests: vi.fn(),
  listCodingExerciseHiddenTests: mocks.listCodingExerciseHiddenTests,
  replaceBankCodingExerciseHiddenTests: vi.fn(),
  replaceCodingExerciseHiddenTests: mocks.replaceCodingExerciseHiddenTests
}));

vi.mock("./generation", async () => {
  const actual = await vi.importActual<typeof import("./generation")>("./generation");
  return {
    ...actual,
    generateCodingExercisePrompt: mocks.generateCodingExercisePrompt,
    generateCodingExerciseSolution: mocks.generateCodingExerciseSolution,
    generateCodingExerciseTests: mocks.generateCodingExerciseTests
  };
});

const {
  codingExerciseGeneratePromptRoute,
  codingExerciseGenerateSolutionRoute,
  codingExerciseGenerateTestsRoute,
  codingExerciseHiddenTestsRoute,
  codingExerciseRunRoute,
  codingExerciseSubmitRoute
} = await import("./routes");

const context = {
  user: { id: "teacher-1", email: "teacher@example.test", name: null, firstName: null, lastName: null, roles: ["teacher" as const] },
  courseId: "course-1",
  activityId: "activity-1",
  path: ["coding-exercises", "run"],
  activity: {
    id: "activity-1",
    title: "Coding",
    description: "",
    lifecycle: "draft",
    config: { language: "python", prompt: "Write code" },
    activityType: { key: "coding-exercise", name: "Coding", description: "" }
  }
};

describe("coding exercise plugin routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.listRecentCodingExerciseExecutions.mockResolvedValue([{ id: "run-1", kind: "run" }, { id: "submit-1", kind: "submit" }]);
    mocks.runCodingExercise.mockResolvedValue({ id: "run-1" });
    mocks.submitCodingExercise.mockResolvedValue({ id: "submit-1" });
    mocks.listCodingExerciseHiddenTests.mockResolvedValue({ tests: [] });
    mocks.replaceCodingExerciseHiddenTests.mockResolvedValue({ tests: [{ id: "hidden-1" }] });
    mocks.prisma.course.findUnique.mockResolvedValue({ subject: { title: "Programming", description: "Basics" } });
    mocks.generateCodingExercisePrompt.mockResolvedValue({ prompt: "Prompt" });
    mocks.generateCodingExerciseSolution.mockResolvedValue({ referenceSolution: "print(1)" });
    mocks.generateCodingExerciseTests.mockResolvedValue({ hiddenTests: [] });
  });

  it("runs, submits, and lists coding exercise executions", async () => {
    await expect(codingExerciseRunRoute.methods.GET?.({ request: new Request("http://test.local"), context, readJson: async () => ({}) })).resolves.toEqual({
      executions: [{ id: "run-1", kind: "run" }, { id: "submit-1", kind: "submit" }]
    });
    await expect(
      codingExerciseRunRoute.methods.POST?.({
        request: new Request("http://test.local"),
        context,
        readJson: async () => ({ sourceCode: "print(1)" })
      })
    ).resolves.toEqual({ execution: { id: "run-1" } });
    await expect(
      codingExerciseSubmitRoute.methods.POST?.({
        request: new Request("http://test.local"),
        context,
        readJson: async () => ({ sourceCode: "print(1)" })
      })
    ).resolves.toEqual({ execution: { id: "submit-1" } });
  });

  it("manages hidden tests only in course context with teacher permission", async () => {
    await expect(codingExerciseHiddenTestsRoute.methods.GET?.({ request: new Request("http://test.local"), context, readJson: async () => ({}) })).resolves.toEqual({
      tests: []
    });
    await expect(
      codingExerciseHiddenTestsRoute.methods.PUT?.({
        request: new Request("http://test.local"),
        context,
        readJson: async () => ({ tests: [], referenceSolution: "print(1)" })
      })
    ).resolves.toEqual({ tests: [{ id: "hidden-1" }] });
    expect(mocks.assertCanManageCourse).toHaveBeenCalledWith(context.user, "course-1");
  });

  it("generates prompt, solution, and tests with subject context", async () => {
    await expect(
      codingExerciseGeneratePromptRoute.methods.POST?.({
        request: new Request("http://test.local"),
        context,
        readJson: async () => ({ description: "Generate a list exercise.", language: "python", locale: "en" })
      })
    ).resolves.toEqual({ prompt: "Prompt" });

    await expect(
      codingExerciseGenerateSolutionRoute.methods.POST?.({
        request: new Request("http://test.local"),
        context,
        readJson: async () => ({ prompt: "Write code", description: "Generate a list exercise.", language: "python", locale: "en" })
      })
    ).resolves.toEqual({ referenceSolution: "print(1)" });

    await expect(
      codingExerciseGenerateTestsRoute.methods.POST?.({
        request: new Request("http://test.local"),
        context,
        readJson: async () => ({
          prompt: "Write code",
          description: "Generate a list exercise.",
          language: "python",
          locale: "en",
          referenceSolution: "print(1)",
          templateSource: "{{ STUDENT_CODE }}"
        })
      })
    ).resolves.toEqual({ hiddenTests: [] });
  });
});
