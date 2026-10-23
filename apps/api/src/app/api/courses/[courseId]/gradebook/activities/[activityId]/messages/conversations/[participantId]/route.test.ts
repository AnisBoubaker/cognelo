import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const mocks = vi.hoisted(() => ({ get: vi.fn(), send: vi.fn(), read: vi.fn(), requireUser: vi.fn() }));
vi.mock("@cognelo/core", () => ({ getStaffActivityConversation: mocks.get, sendStaffActivityReply: mocks.send, markStaffActivityConversationRead: mocks.read }));
vi.mock("@/lib/http", () => ({
  handleRoute: (handler: () => Promise<Response>) => handler(), json: (data: unknown, init?: ResponseInit) => Response.json(data, init),
  options: () => new Response(null, { status: 204 }), readJson: (request: NextRequest) => request.json(), requireUser: mocks.requireUser
}));
const { GET, POST, PATCH } = await import("./route");
const params = { params: Promise.resolve({ courseId: "course", activityId: "activity", participantId: "student" }) };
describe("teacher conversation routes", () => {
  beforeEach(() => {
    vi.resetAllMocks(); mocks.requireUser.mockResolvedValue({ id: "teacher" });
    mocks.get.mockResolvedValue({ conversation: { messages: [] } }); mocks.send.mockResolvedValue({ sent: true }); mocks.read.mockResolvedValue({ readAt: "now" });
  });
  it("passes review attempt and history cursor to the authorized core service", async () => {
    await GET(new NextRequest("http://test.local/messages?attemptId=attempt&before=message"), params);
    expect(mocks.get).toHaveBeenCalledWith({ id: "teacher" }, "course", "activity", "student", { attemptId: "attempt", before: "message" });
  });
  it("trims replies and rejects forged sender identities", async () => {
    const request = (body: object) => new NextRequest("http://test.local/messages", { method: "POST", body: JSON.stringify(body) });
    expect((await POST(request({ body: "  Reply  " }), params)).status).toBe(201);
    expect(mocks.send).toHaveBeenCalledWith({ id: "teacher" }, "course", "activity", "student", "Reply");
    await expect(POST(request({ body: "Reply", senderUserId: "someone-else" }), params)).rejects.toThrow();
    expect(mocks.send).toHaveBeenCalledTimes(1);
  });
  it("bounds read receipts to the displayed message and reviewed attempt", async () => {
    await PATCH(new NextRequest("http://test.local/messages", { method: "PATCH", body: JSON.stringify({ lastMessageId: "last", attemptId: "attempt" }) }), params);
    expect(mocks.read).toHaveBeenCalledWith({ id: "teacher" }, "course", "activity", "student", "last", "attempt");
  });
});
