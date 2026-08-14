import { beforeEach, describe, expect, it, vi } from "vitest";

const hiddenTestMocks = vi.hoisted(() => ({
  copyBankCodingExerciseDataToCourseActivity: vi.fn(),
  copyCourseCodingExerciseData: vi.fn(),
  deleteBankCodingExerciseData: vi.fn(),
  deleteCourseCodingExerciseData: vi.fn()
}));
const executionMocks = vi.hoisted(() => ({
  codingExerciseRunInputSchema: { parse: vi.fn((value) => value) },
  codingExerciseSubmitInputSchema: { parse: vi.fn((value) => value) },
  runCodingExercise: vi.fn(),
  submitCodingExercise: vi.fn()
}));

vi.mock("./hidden-tests", () => hiddenTestMocks);
vi.mock("./executions", () => executionMocks);
vi.mock("./routes", () => ({
  codingExerciseGeneratePromptRoute: { path: "generate-prompt", methods: {} },
  codingExerciseGenerateSolutionRoute: { path: "generate-solution", methods: {} },
  codingExerciseGenerateTestsRoute: { path: "generate-tests", methods: {} },
  codingExerciseHiddenTestsRoute: { path: "hidden-tests", methods: {} },
  codingExerciseRunRoute: { path: "run", methods: {} },
  codingExerciseReviewAllRoute: { path: "review-all", methods: {} },
  codingExerciseSubmitRoute: { path: "submit", methods: {} }
}));

const { codingExercisesServerPlugin } = await import("./server");

describe("coding exercises server plugin lifecycle hooks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("copies bank-owned data when a coding exercise is assigned to a course", async () => {
    await codingExercisesServerPlugin.hooks?.onCourseActivityCreatedFromBankVersion?.({
      user: testUser(),
      courseId: "course-1",
      bankActivityId: "bank-activity-1",
      activityVersionId: "activity-version-1",
      activity: testActivity("coding-exercise")
    });

    expect(hiddenTestMocks.copyBankCodingExerciseDataToCourseActivity).toHaveBeenCalledWith({
      bankActivityId: "bank-activity-1",
      activityId: "activity-1"
    });
  });

  it("copies private authoring data when a coding exercise is duplicated", async () => {
    await codingExercisesServerPlugin.hooks?.onCourseActivityDuplicated?.({
      user: testUser(),
      courseId: "course-1",
      sourceActivityId: "source-1",
      activity: testActivity("coding-exercise")
    });
    expect(hiddenTestMocks.copyCourseCodingExerciseData).toHaveBeenCalledWith({ sourceActivityId: "source-1", activityId: "activity-1" });
  });

  it("deletes only bank-owned coding exercise data when a bank activity is deleted", async () => {
    await codingExercisesServerPlugin.hooks?.onBankActivityDeleted?.({
      user: testUser(),
      activityBankId: "bank-1",
      bankActivityId: "bank-activity-1",
      activityTypeKey: "coding-exercise"
    });

    expect(hiddenTestMocks.deleteBankCodingExerciseData).toHaveBeenCalledWith({
      bankActivityId: "bank-activity-1"
    });
  });

  it("ignores lifecycle hooks for other activity types", async () => {
    await codingExercisesServerPlugin.hooks?.onCourseActivityCreatedFromBankVersion?.({
      user: testUser(),
      courseId: "course-1",
      bankActivityId: "bank-activity-1",
      activityVersionId: "activity-version-1",
      activity: testActivity("mcq")
    });
    await codingExercisesServerPlugin.hooks?.onBankActivityDeleted?.({
      user: testUser(),
      activityBankId: "bank-1",
      bankActivityId: "bank-activity-1",
      activityTypeKey: "mcq"
    });

    expect(hiddenTestMocks.copyBankCodingExerciseDataToCourseActivity).not.toHaveBeenCalled();
    expect(hiddenTestMocks.deleteBankCodingExerciseData).not.toHaveBeenCalled();
  });

  it("runs and grades coding exercises through the composite contract", async () => {
    executionMocks.runCodingExercise.mockResolvedValue({ id: "run-1" });
    executionMocks.submitCodingExercise.mockResolvedValue({
      id: "submit-1",
      resultSummary: { earnedWeight: 3, totalWeight: 4 }
    });
    const activity = testActivity("coding-exercise");
    const user = testUser();

    await expect(codingExercisesServerPlugin.compositeExecution?.actions?.run?.({
      user,
      courseId: "course-1",
      groupId: "group-1",
      parentAttemptId: "attempt-1",
      testItemId: "item-1",
      activity,
      payload: { sourceCode: "print(1)" }
    })).resolves.toEqual({ execution: { id: "run-1" } });
    await expect(codingExercisesServerPlugin.compositeExecution?.submit({
      user,
      courseId: "course-1",
      groupId: "group-1",
      parentAttemptId: "attempt-1",
      testItemId: "item-1",
      activity,
      payload: { sourceCode: "print(1)" }
    })).resolves.toEqual(expect.objectContaining({
      state: { sourceCode: "print(1)", executionId: "submit-1" },
      gradingResult: expect.objectContaining({ rawScore: 3, rawMaxScore: 4 })
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
