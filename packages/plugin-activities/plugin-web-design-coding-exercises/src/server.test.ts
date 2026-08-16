import { beforeEach, describe, expect, it, vi } from "vitest";

const testMocks = vi.hoisted(() => ({
  copyBankWebDesignExerciseData: vi.fn(),
  copyBankWebDesignExerciseTestsToCourseActivity: vi.fn(),
  copyCourseWebDesignExerciseData: vi.fn(),
  deleteBankWebDesignExerciseData: vi.fn(),
  deleteCourseWebDesignExerciseData: vi.fn()
}));
const executionMocks = vi.hoisted(() => ({
  webDesignExerciseRunInputSchema: { parse: vi.fn((value) => value) },
  runWebDesignExercise: vi.fn(),
  submitWebDesignExercise: vi.fn()
}));

vi.mock("./tests", () => testMocks);
vi.mock("./executions", () => executionMocks);
vi.mock("./routes", () => ({
  webDesignExerciseExpectedResultRoute: { path: "expected-result", methods: {} },
  webDesignExerciseRunRoute: { path: "run", methods: {} },
  webDesignExerciseReviewAllRoute: { path: "review-all", methods: {} },
  webDesignExerciseSubmitRoute: { path: "submit", methods: {} },
  webDesignExerciseTestsRoute: { path: "tests", methods: {} }
}));

const { webDesignCodingExercisesServerPlugin } = await import("./server");

describe("web design coding exercises server plugin lifecycle hooks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("copies bank-owned tests when assigned to a course", async () => {
    await webDesignCodingExercisesServerPlugin.hooks?.onCourseActivityCreatedFromBankVersion?.({
      user: testUser(),
      courseId: "course-1",
      bankActivityId: "bank-activity-1",
      activityVersionId: "activity-version-1",
      activity: testActivity("web-design-coding-exercise")
    });

    expect(testMocks.copyBankWebDesignExerciseTestsToCourseActivity).toHaveBeenCalledWith({
      bankActivityId: "bank-activity-1",
      activityId: "activity-1"
    });
  });

  it("copies private authoring data when a web design exercise is duplicated", async () => {
    await webDesignCodingExercisesServerPlugin.hooks?.onCourseActivityDuplicated?.({
      user: testUser(),
      courseId: "course-1",
      sourceActivityId: "source-1",
      activity: testActivity("web-design-coding-exercise")
    });
    expect(testMocks.copyCourseWebDesignExerciseData).toHaveBeenCalledWith({ sourceActivityId: "source-1", activityId: "activity-1" });
  });

  it("deletes bank-owned web design data when a bank activity is deleted", async () => {
    await webDesignCodingExercisesServerPlugin.hooks?.onBankActivityDeleted?.({
      user: testUser(),
      activityBankId: "bank-1",
      bankActivityId: "bank-activity-1",
      activityTypeKey: "web-design-coding-exercise"
    });

    expect(testMocks.deleteBankWebDesignExerciseData).toHaveBeenCalledWith({
      bankActivityId: "bank-activity-1"
    });
  });

  it("copies private bank data when a bank activity is duplicated", async () => {
    await webDesignCodingExercisesServerPlugin.hooks?.onBankActivityDuplicated?.({ user: testUser(), activityBankId: "bank-1", sourceBankActivityId: "source-1", bankActivityId: "copy-1", activityTypeKey: "web-design-coding-exercise" });
    expect(testMocks.copyBankWebDesignExerciseData).toHaveBeenCalledWith({ sourceBankActivityId: "source-1", bankActivityId: "copy-1" });
  });

  it("runs and grades web design exercises through the composite contract", async () => {
    const files = [{ id: "html", path: "index.html", language: "html", starterCode: "<h1>Hi</h1>", isEditable: true, orderIndex: 0 }];
    executionMocks.runWebDesignExercise.mockResolvedValue({ id: "run-1" });
    executionMocks.submitWebDesignExercise.mockResolvedValue({
      id: "submit-1",
      score: 2,
      maxScore: 3,
      resultSummary: { phase: "finished" },
      testResults: []
    });
    const activity = testActivity("web-design-coding-exercise");
    const user = testUser();

    await expect(webDesignCodingExercisesServerPlugin.compositeExecution?.actions?.run?.({
      user,
      courseId: "course-1",
      groupId: "group-1",
      parentAttemptId: "attempt-1",
      testItemId: "item-1",
      activity,
      payload: { files }
    })).resolves.toEqual({ submission: { id: "run-1" } });
    await expect(webDesignCodingExercisesServerPlugin.compositeExecution?.submit({
      user,
      courseId: "course-1",
      groupId: "group-1",
      parentAttemptId: "attempt-1",
      testItemId: "item-1",
      activity,
      payload: { files }
    })).resolves.toEqual(expect.objectContaining({
      state: { files, submissionId: "submit-1" },
      gradingResult: expect.objectContaining({ rawScore: 2, rawMaxScore: 3 })
    }));
  });
});

function testUser() {
  return {
    id: "user-1",
    email: "teacher@example.test",
    name: null,
    firstName: null,
    lastName: null,
    roles: ["teacher" as const]
  };
}

function testActivity(activityTypeKey: string) {
  return {
    id: "activity-1",
    title: "Activity",
    description: "",
    lifecycle: "draft",
    activityType: {
      key: activityTypeKey,
      name: activityTypeKey,
      description: ""
    }
  };
}
