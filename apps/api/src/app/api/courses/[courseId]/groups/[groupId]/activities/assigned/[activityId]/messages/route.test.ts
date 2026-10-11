import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  getConversation: vi.fn(),
  markRead: vi.fn(),
  requireUser: vi.fn(),
  requireSafeExamBrowserAccess: vi.fn()
}));

vi.mock("@cognelo/core", () => ({
  getLearnerActivityConversation: mocks.getConversation,
  markLearnerActivityConversationRead: mocks.markRead
}));
vi.mock("@/lib/http", () => ({
  handleRoute: async (handler: () => Promise<Response>) => handler(),
  json: (data: unknown, init?: ResponseInit) => Response.json(data, init),
  options: () => new Response(null, { status: 204 }),
  readJson: (request: NextRequest) => request.json(),
  requireUser: mocks.requireUser
}));
vi.mock("@/lib/safe-exam-browser", () => ({
  requireSafeExamBrowserAccess: mocks.requireSafeExamBrowserAccess
}));

const { GET, PATCH } = await import("./route");
const params = {
  params: Promise.resolve({ courseId: "course-1", groupId: "group-1", activityId: "activity-1" })
};

describe("learner activity messaging route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireUser.mockResolvedValue({ id: "student-1", roles: ["student"] });
    mocks.getConversation.mockResolvedValue({ conversation: { id: "conversation-1", messages: [] } });
    mocks.markRead.mockResolvedValue({ readAt: "2026-10-11T16:00:00.000Z" });
  });

  it("enforces secure-browser access before returning the attempt conversation", async () => {
    const request = new NextRequest("http://test.local/messages");
    const response = await GET(request, params);
    await expect(response.json()).resolves.toEqual({ conversation: { id: "conversation-1", messages: [] } });
    expect(mocks.requireSafeExamBrowserAccess).toHaveBeenCalledWith(
      request,
      { id: "student-1", roles: ["student"] },
      "course-1",
      "group-1",
      "activity-1"
    );
  });

  it("marks only the requested learner conversation as read", async () => {
    const request = new NextRequest("http://test.local/messages", {
      method: "PATCH",
      body: JSON.stringify({ conversationId: "conversation-1" }),
      headers: { "content-type": "application/json" }
    });
    await PATCH(request, params);
    expect(mocks.markRead).toHaveBeenCalledWith(
      { id: "student-1", roles: ["student"] },
      "course-1",
      "group-1",
      "activity-1",
      "conversation-1"
    );
  });
});
