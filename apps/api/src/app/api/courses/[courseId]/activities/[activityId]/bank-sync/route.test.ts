import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getStatus: vi.fn(), sync: vi.fn(), retrieveHook: vi.fn(), publishHook: vi.fn(), readJson: vi.fn(), requireUser: vi.fn()
}));
vi.mock("@cognelo/core", () => ({ getCourseActivityBankSyncStatus: mocks.getStatus, syncCourseActivityWithBank: mocks.sync }));
vi.mock("@cognelo/activity-sdk/server", () => ({
  runCourseActivityCreatedFromBankVersionHooks: mocks.retrieveHook,
  runCourseActivityPublishedToBankHooks: mocks.publishHook
}));
vi.mock("@/lib/http", () => ({
  handleRoute: async (handler: () => Promise<Response>) => handler(), json: (data: unknown, init?: ResponseInit) => Response.json(data, init),
  options: () => new Response(null, { status: 204 }), readJson: mocks.readJson, requireUser: mocks.requireUser
}));

const { GET, POST } = await import("./route");
const params = { params: Promise.resolve({ courseId: "course-1", activityId: "activity-1" }) };
const activity = {
  id: "activity-1", bankActivityId: "bank-activity-1", activityVersionId: "version-4", title: "Quiz", description: "",
  lifecycle: "draft", config: {}, metadata: {}, activityType: { key: "mcq", name: "MCQ", description: "" }
};

describe("course activity bank sync route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireUser.mockResolvedValue({ id: "teacher-1", roles: ["teacher"] });
  });

  it("returns the sync status", async () => {
    mocks.getStatus.mockResolvedValue({ status: "bank_ahead", mutationsAllowed: true });
    const response = await GET(new Request("http://test.local") as never, params);
    expect(response.status).toBe(200);
    expect(mocks.getStatus).toHaveBeenCalledWith({ id: "teacher-1", roles: ["teacher"] }, "course-1", "activity-1");
  });

  it("dispatches bank-to-course plugin copying after retrieve", async () => {
    mocks.readJson.mockResolvedValue({ action: "retrieve_latest" });
    mocks.sync.mockResolvedValue({ action: "retrieve_latest", activity, version: { id: "version-4" } });
    const response = await POST(new Request("http://test.local", { method: "POST" }) as never, params);
    expect(response.status).toBe(200);
    expect(mocks.retrieveHook).toHaveBeenCalledWith(expect.objectContaining({ bankActivityId: "bank-activity-1", activityVersionId: "version-4" }));
    expect(mocks.publishHook).not.toHaveBeenCalled();
  });

  it("dispatches course-to-bank plugin copying after publish", async () => {
    mocks.readJson.mockResolvedValue({ action: "publish_to_bank" });
    mocks.sync.mockResolvedValue({ action: "publish_to_bank", activity, version: { id: "version-4" } });
    await POST(new Request("http://test.local", { method: "POST" }) as never, params);
    expect(mocks.publishHook).toHaveBeenCalled();
    expect(mocks.retrieveHook).not.toHaveBeenCalled();
  });
});
