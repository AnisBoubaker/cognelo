import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  assertCanManageCourse: vi.fn(),
  assertCanManageCourseOrViewGradebook: vi.fn(),
  clearActivityResponseDraft: vi.fn(),
  getActivityAttemptAvailability: vi.fn(),
  recordActivityAttemptGradingResult: vi.fn(),
  startActivityAttempt: vi.fn(),
  submitActivityAttempt: vi.fn(),
  getWebDesignExpectedResult: vi.fn(),
  listRecentWebDesignExerciseSubmissions: vi.fn(),
  listWebDesignExerciseTests: vi.fn(),
  replaceWebDesignExerciseTests: vi.fn(),
  runWebDesignExercise: vi.fn(),
  submitWebDesignExercise: vi.fn()
}));

vi.mock("@cognelo/core", async () => {
  const actual = await vi.importActual<typeof import("@cognelo/core")>("@cognelo/core");
  return {
    ...actual,
    canShowStudentActivityGrade: vi.fn(async (context) => context.activity.assignment?.metadata?.assessmentMode !== "summative"),
    assertCanManageCourse: mocks.assertCanManageCourse,
    assertCanManageCourseOrViewGradebook: mocks.assertCanManageCourseOrViewGradebook,
    clearActivityResponseDraft: mocks.clearActivityResponseDraft,
    getActivityAttemptAvailability: mocks.getActivityAttemptAvailability,
    recordActivityAttemptGradingResult: mocks.recordActivityAttemptGradingResult,
    startActivityAttempt: mocks.startActivityAttempt,
    submitActivityAttempt: mocks.submitActivityAttempt
  };
});

vi.mock("./tests", () => ({
  getBankWebDesignExpectedResult: vi.fn(),
  getWebDesignExpectedResult: mocks.getWebDesignExpectedResult,
  listBankWebDesignExerciseTests: vi.fn(),
  listWebDesignExerciseTests: mocks.listWebDesignExerciseTests,
  replaceBankWebDesignExerciseTests: vi.fn(),
  replaceWebDesignExerciseTests: mocks.replaceWebDesignExerciseTests
}));

vi.mock("./executions", async () => {
  const actual = await vi.importActual<typeof import("./executions")>("./executions");
  return {
    ...actual,
    listRecentWebDesignExerciseSubmissions: mocks.listRecentWebDesignExerciseSubmissions,
    runWebDesignExercise: mocks.runWebDesignExercise,
    submitWebDesignExercise: mocks.submitWebDesignExercise
  };
});

const { webDesignExerciseExpectedResultRoute, webDesignExerciseRunRoute, webDesignExerciseSubmitRoute, webDesignExerciseTestsRoute } =
  await import("./routes");

const file = { id: "index", path: "index.html", language: "html" as const, starterCode: "<main></main>", isEditable: true, orderIndex: 0 };
const context = {
  user: { id: "teacher-1", email: "teacher@example.test", name: null, firstName: null, lastName: null, roles: ["teacher" as const] },
  courseId: "course-1",
  activityId: "activity-1",
  path: ["web-design-coding-exercises", "tests"],
  activity: {
    id: "activity-1",
    title: "Web",
    description: "",
    lifecycle: "draft",
    config: {},
    activityType: { key: "web-design-coding-exercise", name: "Web", description: "" }
  }
};

describe("web design coding exercise routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.clearActivityResponseDraft.mockResolvedValue({ ok: true });
    mocks.getActivityAttemptAvailability.mockResolvedValue({ canStart: true, reason: null });
    mocks.listWebDesignExerciseTests.mockResolvedValue({ tests: [] });
    mocks.replaceWebDesignExerciseTests.mockResolvedValue({ tests: [{ id: "test-1" }] });
    mocks.getWebDesignExpectedResult.mockResolvedValue({ expectedResult: null });
    mocks.listRecentWebDesignExerciseSubmissions.mockResolvedValue([{ id: "submission-1" }]);
    mocks.runWebDesignExercise.mockResolvedValue({ id: "run-1" });
    mocks.submitWebDesignExercise.mockResolvedValue({ id: "submit-1", score: 1, maxScore: 1, files: [file] });
    mocks.startActivityAttempt.mockResolvedValue({ id: "core-attempt-1" });
    mocks.submitActivityAttempt.mockResolvedValue({ id: "core-attempt-1" });
  });

  it("withholds summative grades and private outcomes on both history endpoints", async () => {
    const submission = { id: "submitted", kind: "submit", status: "failed", score: 0, maxScore: 10,
      message: "Private assertion failed", resultSummary: { score: 0 }, testResults: [{ name: "Private test", status: "failed" }] };
    mocks.listRecentWebDesignExerciseSubmissions.mockResolvedValue([submission]);
    const studentContext = { ...context, groupId: "group-1", activity: { ...context.activity, assignment: { id: "assignment", metadata: { assessmentMode: "summative" } } } };
    for (const route of [webDesignExerciseRunRoute, webDesignExerciseSubmitRoute]) {
      await expect(route.methods.GET?.({ request: new Request("http://test.local"), context: studentContext, readJson: async () => ({}) })).resolves.toEqual({
        submissions: [{ ...submission, status: "completed", score: null, maxScore: null, message: null, resultSummary: { gradingWithheld: true }, testResults: [] }]
      });
    }
  });

  it("rejects exhausted attempts before invoking the runner or persisting a plugin submission", async () => {
    mocks.getActivityAttemptAvailability.mockResolvedValue({ canStart: false, reason: "ATTEMPT_LIMIT_REACHED" });
    await expect(webDesignExerciseSubmitRoute.methods.POST!({
      request: new Request("http://test.local", { method: "POST" }),
      context: { ...context, groupId: "group-1" }, readJson: async () => ({ files: [file] })
    })).rejects.toMatchObject({ status: 409, code: "ATTEMPT_LIMIT_REACHED" });
    expect(mocks.submitWebDesignExercise).not.toHaveBeenCalled();
    expect(mocks.startActivityAttempt).not.toHaveBeenCalled();
  });

  it("manages tests and expected results in course context", async () => {
    await expect(webDesignExerciseTestsRoute.methods.GET?.({ request: new Request("http://test.local"), context, readJson: async () => ({}) })).resolves.toEqual({
      tests: []
    });

    await expect(
      webDesignExerciseTestsRoute.methods.PUT?.({
        request: new Request("http://test.local"),
        context,
        readJson: async () => ({ referenceFiles: [file], tests: [] })
      })
    ).resolves.toEqual({ tests: [{ id: "test-1" }] });

    await expect(
      webDesignExerciseExpectedResultRoute.methods.GET?.({ request: new Request("http://test.local"), context, readJson: async () => ({}) })
    ).resolves.toEqual({ expectedResult: null });
  });

  it.each([null, undefined, Number.NaN, 0])("does not consume an attempt when the runner returns an invalid maximum (%s)", async (maxScore) => {
    mocks.submitWebDesignExercise.mockResolvedValue({ id: "failed-submit", score: 1, maxScore, files: [file] });
    await expect(webDesignExerciseSubmitRoute.methods.POST!({
      request: new Request("http://test.local", { method: "POST" }),
      context: { ...context, groupId: "group-1" }, readJson: async () => ({ files: [file] })
    })).rejects.toMatchObject({ status: 502, code: "WEB_DESIGN_RESULT_INVALID" });
    expect(mocks.startActivityAttempt).not.toHaveBeenCalled();
    expect(mocks.submitActivityAttempt).not.toHaveBeenCalled();
    expect(mocks.clearActivityResponseDraft).not.toHaveBeenCalled();
  });

  it("runs and submits student files", async () => {
    await expect(webDesignExerciseRunRoute.methods.GET?.({ request: new Request("http://test.local"), context, readJson: async () => ({}) })).resolves.toEqual({
      submissions: [{ id: "submission-1" }]
    });

    await expect(
      webDesignExerciseRunRoute.methods.POST?.({ request: new Request("http://test.local"), context, readJson: async () => ({ files: [file] }) })
    ).resolves.toEqual({ submission: { id: "run-1" } });

    await expect(
      webDesignExerciseSubmitRoute.methods.POST?.({
        request: new Request("http://test.local"),
        context: { ...context, groupId: "group-1" },
        readJson: async () => ({ files: [file] })
      })
    ).resolves.toEqual({ submission: { id: "submit-1", score: 1, maxScore: 1, files: [file] } });
    expect(mocks.clearActivityResponseDraft).toHaveBeenCalledWith(
      context.user,
      "course-1",
      "group-1",
      "activity-1"
    );
    expect(mocks.startActivityAttempt).toHaveBeenCalledWith(context.user, expect.objectContaining({
      assessmentMode: "formative",
      pluginAttemptRef: "submit-1"
    }));
    expect(mocks.submitActivityAttempt).toHaveBeenCalledWith(context.user, expect.objectContaining({ attemptId: "core-attempt-1" }));
    expect(mocks.recordActivityAttemptGradingResult).not.toHaveBeenCalled();
  });
});
