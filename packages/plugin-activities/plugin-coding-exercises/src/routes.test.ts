import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  assertCanManageActivityBank: vi.fn(),
  assertCanManageCourse: vi.fn(),
  clearActivityResponseDraft: vi.fn(),
  getActivityAttemptAvailability: vi.fn(),
  recordActivityAttemptGradingResult: vi.fn(),
  startActivityAttempt: vi.fn(),
  submitActivityAttempt: vi.fn(),
  generateCodingExercisePrompt: vi.fn(),
  generateCodingExerciseRubric: vi.fn(),
  generateCodingExerciseSolution: vi.fn(),
  generateCodingExerciseTests: vi.fn(),
  listCodingExerciseHiddenTests: vi.fn(),
  listCodingExerciseAttemptHistory: vi.fn(),
  listRecentCodingExerciseExecutions: vi.fn(),
  replaceCodingExerciseHiddenTests: vi.fn(),
  runCodingExercise: vi.fn(),
  submitCodingExercise: vi.fn(),
  prisma: {
    course: { findUnique: vi.fn() },
    pluginCodingExerciseReferenceSolution: { findUnique: vi.fn() },
    pluginCodingExerciseExecution: { update: vi.fn() }
  }
}));

vi.mock("@cognelo/core", async () => {
  const actual = await vi.importActual<typeof import("@cognelo/core")>("@cognelo/core");
  return {
    ...actual,
    assertCanManageActivityBank: mocks.assertCanManageActivityBank,
    assertCanManageCourse: mocks.assertCanManageCourse,
    clearActivityResponseDraft: mocks.clearActivityResponseDraft,
    getActivityAttemptAvailability: mocks.getActivityAttemptAvailability,
    recordActivityAttemptGradingResult: mocks.recordActivityAttemptGradingResult,
    startActivityAttempt: mocks.startActivityAttempt,
    submitActivityAttempt: mocks.submitActivityAttempt
  };
});

vi.mock("@cognelo/db", () => ({ prisma: mocks.prisma }));
vi.mock("./db-client", () => ({ prisma: mocks.prisma }));

vi.mock("./executions", async () => {
  const actual = await vi.importActual<typeof import("./executions")>("./executions");
  return {
    ...actual,
    listCodingExerciseAttemptHistory: mocks.listCodingExerciseAttemptHistory,
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
    generateCodingExerciseRubric: mocks.generateCodingExerciseRubric,
    generateCodingExerciseSolution: mocks.generateCodingExerciseSolution,
    generateCodingExerciseTests: mocks.generateCodingExerciseTests
  };
});

const {
  codingExerciseGeneratePromptRoute,
  codingExerciseGenerateRubricRoute,
  codingExerciseGenerateSolutionRoute,
  codingExerciseGenerateTestsRoute,
  codingExerciseHistoryRoute,
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
    mocks.clearActivityResponseDraft.mockResolvedValue({ ok: true });
    mocks.listRecentCodingExerciseExecutions.mockResolvedValue([{ id: "run-1", kind: "run" }, { id: "submit-1", kind: "submit" }]);
    mocks.listCodingExerciseAttemptHistory.mockResolvedValue({
      currentRuns: [{ id: "run-current", kind: "run" }],
      attempts: [{ submission: { id: "submit-1", kind: "submit" }, runs: [{ id: "run-1", kind: "run" }] }]
    });
    mocks.runCodingExercise.mockResolvedValue({ id: "run-1" });
    mocks.submitCodingExercise.mockResolvedValue({ id: "submit-1" });
    mocks.prisma.pluginCodingExerciseExecution.update.mockResolvedValue({ id: "submit-1" });
    mocks.getActivityAttemptAvailability.mockResolvedValue({
      attemptLimitMode: "max_attempts",
      gradesReleased: false,
      maxAttempts: 1,
      usedAttempts: 0,
      attemptsRemaining: 1,
      canStart: true,
      reason: null
    });
    mocks.startActivityAttempt.mockResolvedValue({ id: "attempt-1" });
    mocks.submitActivityAttempt.mockResolvedValue({ id: "attempt-1" });
    mocks.recordActivityAttemptGradingResult.mockResolvedValue({});
    mocks.listCodingExerciseHiddenTests.mockResolvedValue({ tests: [] });
    mocks.replaceCodingExerciseHiddenTests.mockResolvedValue({ tests: [{ id: "hidden-1" }] });
    mocks.prisma.course.findUnique.mockResolvedValue({ subject: { title: "Programming", description: "Basics", teachingLanguage: "fr" } });
    mocks.prisma.pluginCodingExerciseReferenceSolution.findUnique.mockResolvedValue(null);
    mocks.generateCodingExercisePrompt.mockResolvedValue({ prompt: "Prompt" });
    mocks.generateCodingExerciseRubric.mockResolvedValue({ criteria: [] });
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
        context: { ...context, groupId: "group-1" },
        readJson: async () => ({ sourceCode: "print(1)" })
      })
    ).resolves.toEqual({
      execution: { id: "submit-1" },
      aiFeedback: null,
      aiFeedbackError: null,
      availability: {
        attemptLimitMode: "unlimited",
        gradesReleased: false,
        maxAttempts: null,
        usedAttempts: null,
        attemptsRemaining: null,
        canStart: true,
        reason: null
      }
    });
    expect(mocks.clearActivityResponseDraft).toHaveBeenCalledWith(
      context.user,
      "course-1",
      "group-1",
      "activity-1"
    );
    await expect(
      codingExerciseHistoryRoute.methods.GET?.({ request: new Request("http://test.local"), context, readJson: async () => ({}) })
    ).resolves.toEqual({
      currentRuns: [{ id: "run-current", kind: "run" }],
      attempts: [{ submission: { id: "submit-1", kind: "submit" }, runs: [{ id: "run-1", kind: "run" }] }],
      availability: {
        attemptLimitMode: "unlimited",
        gradesReleased: false,
        maxAttempts: null,
        usedAttempts: null,
        attemptsRemaining: null,
        canStart: true,
        reason: null
      }
    });
  });

  it("records summative submissions in the shared attempt lifecycle and returns remaining availability", async () => {
    mocks.listCodingExerciseAttemptHistory.mockResolvedValue({ currentRuns: [], attempts: [] });
    mocks.submitCodingExercise.mockResolvedValue({
      id: "submit-1",
      status: "completed",
      resultSummary: { earnedWeight: 2, totalWeight: 2 }
    });
    mocks.getActivityAttemptAvailability
      .mockResolvedValueOnce({
        attemptLimitMode: "max_attempts",
        gradesReleased: false,
        maxAttempts: 1,
        usedAttempts: 0,
        attemptsRemaining: 1,
        canStart: true,
        reason: null
      })
      .mockResolvedValueOnce({
        attemptLimitMode: "max_attempts",
        gradesReleased: false,
        maxAttempts: 1,
        usedAttempts: 1,
        attemptsRemaining: 0,
        canStart: false,
        reason: "ATTEMPT_LIMIT_REACHED"
      });
    mocks.startActivityAttempt.mockResolvedValue({ id: "attempt-1" });
    mocks.submitActivityAttempt.mockResolvedValue({ id: "attempt-1" });

    await expect(
      codingExerciseSubmitRoute.methods.POST?.({
        request: new Request("http://test.local"),
        context: {
          ...context,
          groupId: "group-1",
          activity: {
            ...context.activity,
            assignment: { id: "assignment-1", metadata: { assessmentMode: "summative" } }
          }
        },
        readJson: async () => ({ sourceCode: "print(1)" })
      })
    ).resolves.toMatchObject({
      execution: { id: "submit-1" },
      availability: { canStart: false, attemptsRemaining: 0 }
    });
    expect(mocks.startActivityAttempt).toHaveBeenCalledWith(context.user, expect.objectContaining({
      activityId: "activity-1",
      courseId: "course-1",
      groupId: "group-1",
      pluginAttemptRef: "submit-1"
    }));
    expect(mocks.submitActivityAttempt).toHaveBeenCalledWith(context.user, expect.objectContaining({
      attemptId: "attempt-1",
      pluginAttemptRef: "submit-1"
    }));
    expect(mocks.recordActivityAttemptGradingResult).toHaveBeenCalledWith(context.user, expect.objectContaining({
      attemptId: "attempt-1",
      rawScore: 2,
      rawMaxScore: 2,
      isPass: true
    }));
  });

  it("counts legacy plugin submissions when deciding whether another attempt is available", async () => {
    mocks.getActivityAttemptAvailability.mockResolvedValue({
      attemptLimitMode: "max_attempts",
      gradesReleased: false,
      maxAttempts: 1,
      usedAttempts: 0,
      attemptsRemaining: 1,
      canStart: true,
      reason: null
    });

    await expect(
      codingExerciseHistoryRoute.methods.GET?.({
        request: new Request("http://test.local"),
        context: {
          ...context,
          groupId: "group-1",
          activity: {
            ...context.activity,
            assignment: { id: "assignment-1", metadata: { assessmentMode: "summative" } }
          }
        },
        readJson: async () => ({})
      })
    ).resolves.toMatchObject({
      attempts: [{ submission: { id: "submit-1" } }],
      availability: {
        usedAttempts: 1,
        attemptsRemaining: 0,
        canStart: false,
        reason: "ATTEMPT_LIMIT_REACHED"
      }
    });
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

  it("generates prompt, solution, tests, and rubrics with subject context", async () => {
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
          templateSource: "{{ STUDENT_CODE }}",
          visibleTestCount: 4,
          hiddenTestCount: 12
        })
      })
    ).resolves.toEqual({ hiddenTests: [] });

    await expect(
      codingExerciseGenerateRubricRoute.methods.POST?.({
        request: new Request("http://test.local"),
        context,
        readJson: async () => ({
          title: "Smallest value",
          prompt: "Write code that displays the smallest value.",
          description: "Generate a list exercise.",
          referenceSolution: "print(1)",
          language: "python",
          locale: "en"
        })
      })
    ).resolves.toEqual({ criteria: [] });
    expect(mocks.generateCodingExerciseRubric).toHaveBeenCalledWith(expect.objectContaining({
      locale: "fr",
      title: "Smallest value",
      referenceSolution: "print(1)",
      subject: expect.objectContaining({ teachingLanguage: "fr" })
    }));
    expect(mocks.generateCodingExerciseTests).toHaveBeenCalledWith(expect.objectContaining({
      visibleTestCount: 4,
      hiddenTestCount: 12
    }));
  });

  it("rejects rubric generation without title, prompt, and reference solution", async () => {
    await expect(
      codingExerciseGenerateRubricRoute.methods.POST?.({
        request: new Request("http://test.local"),
        context,
        readJson: async () => ({
          title: "",
          prompt: "",
          description: "",
          referenceSolution: "",
          language: "python",
          locale: "en"
        })
      })
    ).rejects.toThrow();
    expect(mocks.generateCodingExerciseRubric).not.toHaveBeenCalled();
  });
});
