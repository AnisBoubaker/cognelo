import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  deleteTest: vi.fn(),
  readJson: vi.fn(),
  requireUser: vi.fn(),
  retrieveHook: vi.fn(),
  deleteHook: vi.fn()
}));

vi.mock("@cognelo/core", () => ({
  createCourseTestFromBankVersion: mocks.create,
  deleteTest: mocks.deleteTest
}));
vi.mock("@cognelo/activity-sdk/server", () => ({
  runCourseActivityCreatedFromBankVersionHooks: mocks.retrieveHook,
  runCourseActivityDeletedHooks: mocks.deleteHook
}));
vi.mock("@/lib/http", () => ({
  handleRoute: async (handler: () => Promise<Response>) => handler(),
  json: (data: unknown, init?: ResponseInit) => Response.json(data, init),
  options: () => new Response(null, { status: 204 }),
  readJson: mocks.readJson,
  requireUser: mocks.requireUser
}));

const { POST } = await import("./route");

const child = {
  id: "course-child-1",
  title: "Question",
  description: "",
  lifecycle: "draft",
  config: {},
  metadata: {},
  activityType: { key: "coding-exercise", name: "Programming Exercise", description: "" }
};

describe("create course Test from bank route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireUser.mockResolvedValue({ id: "teacher-1", roles: ["teacher"] });
    mocks.readJson.mockResolvedValue({ bankActivityId: "bank-test-1" });
    mocks.create.mockResolvedValue({
      test: { activityId: "course-test-1" },
      activityCopies: [{ bankActivityId: "bank-child-1", activityVersionId: "child-version-1", activity: child }]
    });
    mocks.retrieveHook.mockResolvedValue(undefined);
    mocks.deleteHook.mockResolvedValue(undefined);
    mocks.deleteTest.mockResolvedValue({ ok: true });
  });

  it("copies plugin-private data for every imported Test child", async () => {
    const response = await POST(new Request("http://test.local", { method: "POST", body: "{}" }) as never, {
      params: Promise.resolve({ courseId: "course-1" })
    });

    expect(response.status).toBe(201);
    expect(mocks.retrieveHook).toHaveBeenCalledWith(expect.objectContaining({
      courseId: "course-1",
      bankActivityId: "bank-child-1",
      activityVersionId: "child-version-1",
      activity: expect.objectContaining({ id: "course-child-1" })
    }));
  });

  it("removes the partially imported graph when a child hook fails", async () => {
    mocks.retrieveHook.mockRejectedValue(new Error("copy failed"));

    await expect(POST(new Request("http://test.local", { method: "POST", body: "{}" }) as never, {
      params: Promise.resolve({ courseId: "course-1" })
    })).rejects.toThrow("copy failed");

    expect(mocks.deleteHook).toHaveBeenCalledWith(expect.objectContaining({ activityId: "course-child-1" }));
    expect(mocks.deleteTest).toHaveBeenCalledWith(expect.anything(), "course-1", "course-test-1");
  });
});
