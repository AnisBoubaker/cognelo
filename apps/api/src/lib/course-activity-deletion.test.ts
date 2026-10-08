import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  deleteActivity: vi.fn(),
  deleteTest: vi.fn(),
  getActivityDeletionImpact: vi.fn(),
  getActivityForDeletion: vi.fn(),
  getTestForDeletion: vi.fn(),
  runCourseActivityDeletedHooks: vi.fn()
}));

vi.mock("@cognelo/core", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@cognelo/core")>()),
  deleteActivity: mocks.deleteActivity,
  deleteTest: mocks.deleteTest,
  getActivityDeletionImpact: mocks.getActivityDeletionImpact,
  getActivityForDeletion: mocks.getActivityForDeletion,
  getTestForDeletion: mocks.getTestForDeletion
}));

vi.mock("@cognelo/activity-sdk/server", () => ({
  runCourseActivityDeletedHooks: mocks.runCourseActivityDeletedHooks
}));

const { deleteCourseActivityWithHooks } = await import("./course-activity-deletion");

const user = {
  id: "teacher-1",
  email: "teacher@example.test",
  name: null,
  firstName: null,
  lastName: null,
  roles: ["teacher" as const]
};

describe("course activity deletion orchestration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getActivityDeletionImpact.mockResolvedValue({
      activityId: "activity-1",
      title: "Loops",
      recordedAttemptCount: 0
    });
    mocks.getActivityForDeletion.mockResolvedValue({
      id: "activity-1",
      activityType: { key: "mcq" },
      testDefinition: null
    });
    mocks.deleteActivity.mockResolvedValue({ ok: true });
  });

  it("does not run destructive plugin hooks before recorded attempts are explicitly confirmed", async () => {
    mocks.getActivityDeletionImpact.mockResolvedValue({
      activityId: "activity-1",
      title: "Loops",
      recordedAttemptCount: 2
    });

    await expect(deleteCourseActivityWithHooks(user, "course-1", "activity-1")).rejects.toMatchObject({
      status: 409,
      code: "ACTIVITY_RECORDED_ATTEMPTS_CONFIRMATION_REQUIRED"
    });
    expect(mocks.runCourseActivityDeletedHooks).not.toHaveBeenCalled();
    expect(mocks.deleteActivity).not.toHaveBeenCalled();
  });

  it("runs the ordinary plugin cleanup and confirmed core deletion", async () => {
    mocks.getActivityDeletionImpact.mockResolvedValue({
      activityId: "activity-1",
      title: "Loops",
      recordedAttemptCount: 2
    });

    await expect(deleteCourseActivityWithHooks(user, "course-1", "activity-1", {
      confirmRecordedAttempts: true
    })).resolves.toEqual({ ok: true });

    expect(mocks.runCourseActivityDeletedHooks).toHaveBeenCalledWith({
      user,
      courseId: "course-1",
      activityId: "activity-1",
      activityTypeKey: "mcq"
    });
    expect(mocks.deleteActivity).toHaveBeenCalledWith(user, "course-1", "activity-1", {
      confirmRecordedAttempts: true
    });
  });

  it("cleans every private Test child before deleting the Test shell", async () => {
    mocks.getActivityForDeletion.mockResolvedValue({
      id: "test-activity",
      activityType: { key: "test" },
      testDefinition: { id: "test-1" }
    });
    mocks.getTestForDeletion.mockResolvedValue({
      items: [
        { activityId: "child-1", activity: { activityType: { key: "mcq" } } },
        { activityId: "child-2", activity: { activityType: { key: "coding-exercise" } } }
      ]
    });
    mocks.deleteTest.mockResolvedValue({ ok: true });

    await expect(deleteCourseActivityWithHooks(user, "course-1", "test-activity")).resolves.toEqual({ ok: true });

    expect(mocks.runCourseActivityDeletedHooks).toHaveBeenNthCalledWith(1, {
      user,
      courseId: "course-1",
      activityId: "child-1",
      activityTypeKey: "mcq"
    });
    expect(mocks.runCourseActivityDeletedHooks).toHaveBeenNthCalledWith(2, {
      user,
      courseId: "course-1",
      activityId: "child-2",
      activityTypeKey: "coding-exercise"
    });
    expect(mocks.deleteTest).toHaveBeenCalledWith(user, "course-1", "test-activity", {});
  });
});
