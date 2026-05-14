import { beforeEach, describe, expect, it, vi } from "vitest";

const testMocks = vi.hoisted(() => ({
  copyBankWebDesignExerciseTestsToCourseActivity: vi.fn(),
  deleteBankWebDesignExerciseData: vi.fn()
}));

vi.mock("./tests", () => testMocks);
vi.mock("./routes", () => ({
  webDesignExerciseExpectedResultRoute: { path: "expected-result", methods: {} },
  webDesignExerciseRunRoute: { path: "run", methods: {} },
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
