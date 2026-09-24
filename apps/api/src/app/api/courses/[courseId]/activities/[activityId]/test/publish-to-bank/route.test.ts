import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  publish: vi.fn(),
  link: vi.fn(),
  deleteBankActivity: vi.fn(),
  publishHook: vi.fn(),
  deleteHook: vi.fn(),
  readJson: vi.fn(),
  requireUser: vi.fn()
}));

vi.mock("@cognelo/core", () => ({
  createBankTestFromCourse: mocks.create,
  updateBankTest: mocks.publish,
  linkCourseTestToPublishedBankCopy: mocks.link,
  deleteBankActivity: mocks.deleteBankActivity
}));
vi.mock("@cognelo/activity-sdk/server", () => ({
  runCourseActivityPublishedToBankHooks: mocks.publishHook,
  runBankActivityDeletedHooks: mocks.deleteHook
}));
vi.mock("@/lib/http", () => ({
  handleRoute: async (handler: () => Promise<Response>) => handler(),
  json: (data: unknown, init?: ResponseInit) => Response.json(data, init),
  options: () => new Response(null, { status: 204 }),
  readJson: mocks.readJson,
  requireUser: mocks.requireUser
}));

const { POST } = await import("./route");

describe("publish course Test to bank route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireUser.mockResolvedValue({ id: "teacher-1", roles: ["teacher"] });
    mocks.readJson.mockResolvedValue({ activityBankId: "bank-1" });
    mocks.create.mockResolvedValue({
      test: { bankActivityId: "bank-test-shell", activity: { bankId: "bank-1" } },
      activityCopies: [{
        sourceActivity: {
          id: "course-child-1",
          title: "Question",
          description: "",
          lifecycle: "draft",
          config: {},
          metadata: {},
          activityType: { key: "coding-exercise", name: "Programming Exercise", description: "" }
        },
        bankActivity: { id: "bank-child-1" }
      }]
    });
    mocks.publish.mockResolvedValue({
      id: "bank-test-1",
      bankActivityId: "bank-test-shell",
      activity: { currentVersion: { id: "shell-version-1", versionNumber: 1 } },
      items: [{
        bankActivityId: "bank-child-1",
        activity: { currentVersion: { id: "child-version-1", versionNumber: 1 } }
      }]
    });
    mocks.publishHook.mockResolvedValue(undefined);
    mocks.link.mockResolvedValue(undefined);
    mocks.deleteHook.mockResolvedValue(undefined);
  });

  it("copies private child data, publishes the bank graph, and links the course graph", async () => {
    const response = await POST(new Request("http://test.local", { method: "POST", body: "{}" }) as never, {
      params: Promise.resolve({ courseId: "course-1", activityId: "course-test-1" })
    });

    expect(response.status).toBe(201);
    expect(mocks.publishHook).toHaveBeenCalledWith(expect.objectContaining({
      courseId: "course-1",
      bankActivityId: "bank-child-1",
      activityVersionId: "child-version-1",
      activity: expect.objectContaining({ id: "course-child-1" })
    }));
    expect(mocks.link).toHaveBeenCalledWith(expect.anything(), "course-1", "course-test-1", {
      bankActivityId: "bank-test-shell",
      activityVersionId: "shell-version-1",
      versionNumber: 1,
      items: [{
        sourceActivityId: "course-child-1",
        bankActivityId: "bank-child-1",
        activityVersionId: "child-version-1",
        versionNumber: 1
      }]
    });
  });

  it("deletes the new bank graph when private-data publication fails", async () => {
    mocks.publishHook.mockRejectedValue(new Error("private copy failed"));
    mocks.deleteBankActivity.mockResolvedValue({
      deletedActivities: [{ bankActivityId: "bank-child-1", activityTypeKey: "coding-exercise" }]
    });

    await expect(POST(new Request("http://test.local", { method: "POST", body: "{}" }) as never, {
      params: Promise.resolve({ courseId: "course-1", activityId: "course-test-1" })
    })).rejects.toThrow("private copy failed");

    expect(mocks.deleteBankActivity).toHaveBeenCalledWith(expect.anything(), "bank-1", "bank-test-shell", { force: true });
    expect(mocks.deleteHook).toHaveBeenCalledWith(expect.objectContaining({ bankActivityId: "bank-child-1" }));
    expect(mocks.link).not.toHaveBeenCalled();
  });
});
