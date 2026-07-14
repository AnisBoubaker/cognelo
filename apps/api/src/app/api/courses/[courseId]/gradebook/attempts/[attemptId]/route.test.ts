import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  deleteActivitySubmission: vi.fn(),
  readJson: vi.fn(),
  requireUser: vi.fn(),
  runActivityAttemptDeletedHooks: vi.fn()
}));

vi.mock("@cognelo/core", () => ({
  deleteActivitySubmission: mocks.deleteActivitySubmission
}));

vi.mock("@cognelo/activity-sdk/server", () => ({
  runActivityAttemptDeletedHooks: mocks.runActivityAttemptDeletedHooks
}));

vi.mock("@/lib/http", () => ({
  handleRoute: async (handler: () => Promise<Response>) => handler(),
  json: (data: unknown, init?: ResponseInit) => Response.json(data, init),
  options: () => new Response(null, { status: 204 }),
  readJson: mocks.readJson,
  requireUser: mocks.requireUser
}));

const { DELETE } = await import("./route");

describe("gradebook attempt deletion route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireUser.mockResolvedValue({ id: "teacher-1", roles: ["teacher"] });
    mocks.readJson.mockResolvedValue({ reason: "Wrong file" });
    mocks.deleteActivitySubmission.mockResolvedValue({
      attempt: {
        id: "attempt-1",
        activityId: "activity-1",
        groupId: "group-1",
        metadata: {
          deletion: {
            deletedAt: "2026-06-19T10:00:00.000Z"
          }
        },
        pluginAttemptRef: "submission-1",
        pluginKey: "coding-homework-grader"
      },
      grade: null
    });
  });

  it("soft-deletes the core attempt and notifies the owning activity plugin", async () => {
    const response = await DELETE(new Request("http://test.local", { method: "DELETE" }) as never, {
      params: Promise.resolve({ courseId: "course-1", attemptId: "attempt-1" })
    });

    await expect(response.json()).resolves.toEqual({
      result: {
        attempt: expect.objectContaining({ id: "attempt-1" }),
        grade: null
      }
    });
    expect(mocks.deleteActivitySubmission).toHaveBeenCalledWith({ id: "teacher-1", roles: ["teacher"] }, "course-1", {
      attemptId: "attempt-1",
      reason: "Wrong file"
    });
    expect(mocks.runActivityAttemptDeletedHooks).toHaveBeenCalledWith({
      user: { id: "teacher-1", roles: ["teacher"] },
      courseId: "course-1",
      groupId: "group-1",
      activityId: "activity-1",
      pluginKey: "coding-homework-grader",
      coreAttemptId: "attempt-1",
      pluginAttemptRef: "submission-1",
      reason: "Wrong file",
      deletedAt: "2026-06-19T10:00:00.000Z"
    });
  });
});
