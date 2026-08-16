import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  deleteActivity: vi.fn(), duplicateCourseActivity: vi.fn(), duplicateHook: vi.fn(), deleteHook: vi.fn(), readJson: vi.fn(), requireUser: vi.fn()
}));
vi.mock("@cognelo/core", () => ({ deleteActivity: mocks.deleteActivity, duplicateCourseActivity: mocks.duplicateCourseActivity }));
vi.mock("@cognelo/activity-sdk/server", () => ({ runCourseActivityDeletedHooks: mocks.deleteHook, runCourseActivityDuplicatedHooks: mocks.duplicateHook }));
vi.mock("@/lib/http", () => ({
  handleRoute: async (handler: () => Promise<Response>) => handler(), json: (data: unknown, init?: ResponseInit) => Response.json(data, init),
  options: () => new Response(null, { status: 204 }), readJson: mocks.readJson, requireUser: mocks.requireUser
}));

const { POST } = await import("./route");

describe("course activity duplicate route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireUser.mockResolvedValue({ id: "teacher-1", roles: ["teacher"] });
    mocks.readJson.mockResolvedValue({ title: "Quiz (copy)", contentItemId: "content-1" });
    mocks.duplicateCourseActivity.mockResolvedValue({
      id: "activity-2", bankActivityId: "bank-activity-1", activityVersionId: "version-3", title: "Quiz (copy)", description: "",
      lifecycle: "draft", config: {}, metadata: {}, activityType: { key: "mcq", name: "MCQ", description: "" }
    });
  });

  it("duplicates the core activity then dispatches plugin-owned copy work", async () => {
    const response = await POST(new Request("http://test.local", { method: "POST" }) as never, { params: Promise.resolve({ courseId: "course-1", activityId: "activity-1" }) });
    expect(response.status).toBe(201);
    expect(mocks.duplicateCourseActivity).toHaveBeenCalledWith({ id: "teacher-1", roles: ["teacher"] }, "course-1", "activity-1", { title: "Quiz (copy)", contentItemId: "content-1" });
    expect(mocks.duplicateHook).toHaveBeenCalledWith(expect.objectContaining({ courseId: "course-1", sourceActivityId: "activity-1", activity: expect.objectContaining({ id: "activity-2", bankActivityId: "bank-activity-1", activityVersionId: "version-3" }) }));
  });
});
