import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  assertCanManageCourse: vi.fn(),
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
    assertCanManageCourse: mocks.assertCanManageCourse
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
    mocks.listWebDesignExerciseTests.mockResolvedValue({ tests: [] });
    mocks.replaceWebDesignExerciseTests.mockResolvedValue({ tests: [{ id: "test-1" }] });
    mocks.getWebDesignExpectedResult.mockResolvedValue({ expectedResult: null });
    mocks.listRecentWebDesignExerciseSubmissions.mockResolvedValue([{ id: "submission-1" }]);
    mocks.runWebDesignExercise.mockResolvedValue({ id: "run-1" });
    mocks.submitWebDesignExercise.mockResolvedValue({ id: "submit-1" });
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

  it("runs and submits student files", async () => {
    await expect(webDesignExerciseRunRoute.methods.GET?.({ request: new Request("http://test.local"), context, readJson: async () => ({}) })).resolves.toEqual({
      submissions: [{ id: "submission-1" }]
    });

    await expect(
      webDesignExerciseRunRoute.methods.POST?.({ request: new Request("http://test.local"), context, readJson: async () => ({ files: [file] }) })
    ).resolves.toEqual({ submission: { id: "run-1" } });

    await expect(
      webDesignExerciseSubmitRoute.methods.POST?.({ request: new Request("http://test.local"), context, readJson: async () => ({ files: [file] }) })
    ).resolves.toEqual({ submission: { id: "submit-1" } });
  });
});
