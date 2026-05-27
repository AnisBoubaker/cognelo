import { beforeEach, describe, expect, it, vi } from "vitest";

const hiddenTestMocks = vi.hoisted(() => ({
  copyBankCodingExerciseDataToCourseActivity: vi.fn(),
  deleteBankCodingExerciseData: vi.fn()
}));

vi.mock("./hidden-tests", () => hiddenTestMocks);
vi.mock("./routes", () => ({
  codingExerciseGeneratePromptRoute: { path: "generate-prompt", methods: {} },
  codingExerciseGenerateSolutionRoute: { path: "generate-solution", methods: {} },
  codingExerciseGenerateTestsRoute: { path: "generate-tests", methods: {} },
  codingExerciseHiddenTestsRoute: { path: "hidden-tests", methods: {} },
  codingExerciseRunRoute: { path: "run", methods: {} },
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
