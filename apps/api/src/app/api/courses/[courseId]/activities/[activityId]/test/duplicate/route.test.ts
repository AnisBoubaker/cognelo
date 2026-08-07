import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  duplicateTest: vi.fn(),
  deleteTest: vi.fn(),
  duplicateHook: vi.fn(),
  deleteHook: vi.fn(),
  readJson: vi.fn(),
  requireUser: vi.fn()
}));

vi.mock("@cognelo/core", () => ({ deleteTest: mocks.deleteTest, duplicateTest: mocks.duplicateTest }));
vi.mock("@cognelo/activity-sdk/server", () => ({
  runCourseActivityDeletedHooks: mocks.deleteHook,
  runCourseActivityDuplicatedHooks: mocks.duplicateHook
}));
vi.mock("@/lib/http", () => ({
  handleRoute: async (handler: () => Promise<Response>) => handler(),
  json: (data: unknown, init?: ResponseInit) => Response.json(data, init),
  options: () => new Response(null, { status: 204 }),
  readJson: mocks.readJson,
  requireUser: mocks.requireUser
}));

const { POST } = await import("./route");

describe("duplicate Test route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireUser.mockResolvedValue({ id: "teacher-1", roles: ["teacher"] });
    mocks.readJson.mockResolvedValue({});
    mocks.duplicateTest.mockResolvedValue({
      test: { id: "test-copy", activityId: "test-activity-copy" },
      activityCopies: [{
        sourceActivityId: "child-source",
        activity: {
          id: "child-copy",
          bankActivityId: null,
          activityVersionId: null,
          title: "Question",
          description: "",
          lifecycle: "draft",
          config: {},
          metadata: {},
          activityType: { key: "mcq", name: "MCQ", description: "" }
        }
      }]
    });
  });

  it("copies plugin-owned child data after duplicating normalized Test rows", async () => {
    const response = await POST(new Request("http://test.local", { method: "POST" }) as never, {
      params: Promise.resolve({ courseId: "course-1", activityId: "test-source" })
    });

    expect(response.status).toBe(201);
    expect(mocks.duplicateHook).toHaveBeenCalledWith(expect.objectContaining({
      sourceActivityId: "child-source",
      activity: expect.objectContaining({ id: "child-copy" })
    }));
    await expect(response.json()).resolves.toEqual({ test: { id: "test-copy", activityId: "test-activity-copy" } });
  });
});
