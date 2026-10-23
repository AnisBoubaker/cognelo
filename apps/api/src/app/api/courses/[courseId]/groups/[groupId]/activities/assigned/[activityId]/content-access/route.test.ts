import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ access: vi.fn(), messaging: vi.fn(), guard: vi.fn(), user: vi.fn() }));
vi.mock("@cognelo/core", () => ({
  AppError: class extends Error { constructor(public status: number, public code: string, message: string) { super(message); } },
  getActivityContentAccess: mocks.access, getLearnerActivityMessagingStatus: mocks.messaging, finalizeClosedActivityContent: vi.fn()
}));
vi.mock("@/lib/http", () => ({ handleRoute: (handler: () => Promise<Response>) => handler(), json: (data: unknown) => Response.json(data), options: vi.fn(), requireUser: mocks.user }));
vi.mock("@/lib/safe-exam-browser", () => ({ requireSafeExamBrowserAccess: mocks.guard }));
const { GET } = await import("./route");
const params = { params: Promise.resolve({ courseId: "course", groupId: "group", activityId: "activity" }) };
describe("activity access heartbeat", () => {
  beforeEach(() => { vi.resetAllMocks(); mocks.user.mockResolvedValue({ id: "student" }); mocks.access.mockResolvedValue({ locked: false }); mocks.messaging.mockResolvedValue({ version: "v1", unreadCount: 0 }); });
  it("adds only messaging status to the existing presence heartbeat", async () => {
    expect(await (await GET(new Request("http://test.local/content-access?messaging=presence"), params)).json()).toEqual({ access: { locked: false }, messaging: { version: "v1", unreadCount: 0 } });
    expect(mocks.guard).toHaveBeenCalledOnce();
    expect(mocks.messaging).toHaveBeenCalledWith({ id: "student" }, "course", "group", "activity", true);
  });
  it("does not read or renew messaging for closed content", async () => {
    mocks.access.mockResolvedValue({ locked: true });
    await GET(new Request("http://test.local/content-access?messaging=presence"), params);
    expect(mocks.messaging).not.toHaveBeenCalled(); expect(mocks.guard).not.toHaveBeenCalled();
  });
  it("history heartbeats do not renew answering presence", async () => {
    await GET(new Request("http://test.local/content-access?messaging=history"), params);
    expect(mocks.messaging).toHaveBeenCalledWith({ id: "student" }, "course", "group", "activity", false);
    expect(mocks.guard).not.toHaveBeenCalled();
  });
  it("keeps stored notices readable without presence when the secure-browser gate closes", async () => {
    const { AppError } = await import("@cognelo/core");
    mocks.guard.mockRejectedValue(new AppError(403, "SAFE_EXAM_BROWSER_REQUIRED", "Unavailable"));
    await GET(new Request("http://test.local/content-access?messaging=presence"), params);
    expect(mocks.messaging).toHaveBeenCalledWith({ id: "student" }, "course", "group", "activity", false);
  });
});
