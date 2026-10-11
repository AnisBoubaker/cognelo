import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  getOverview: vi.fn(),
  sendBroadcast: vi.fn(),
  requireUser: vi.fn()
}));

vi.mock("@cognelo/core", () => ({
  getActivityMessagingOverview: mocks.getOverview,
  sendActivityBroadcast: mocks.sendBroadcast
}));
vi.mock("@/lib/http", () => ({
  handleRoute: async (handler: () => Promise<Response>) => handler(),
  json: (data: unknown, init?: ResponseInit) => Response.json(data, init),
  options: () => new Response(null, { status: 204 }),
  readJson: (request: NextRequest) => request.json(),
  requireUser: mocks.requireUser
}));

const { GET, POST } = await import("./route");
const params = { params: Promise.resolve({ courseId: "course-1", activityId: "activity-1" }) };

describe("teacher activity messaging route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireUser.mockResolvedValue({ id: "teacher-1", roles: ["teacher"] });
    mocks.getOverview.mockResolvedValue({ activeRecipientCount: 2, broadcasts: [] });
    mocks.sendBroadcast.mockResolvedValue({ broadcast: { id: "broadcast-1" } });
  });

  it("loads the teacher's group-scoped messaging overview", async () => {
    const response = await GET(new NextRequest("http://test.local/messages?groupId=group-1"), params);
    await expect(response.json()).resolves.toEqual({ messaging: { activeRecipientCount: 2, broadcasts: [] } });
    expect(mocks.getOverview).toHaveBeenCalledWith(
      { id: "teacher-1", roles: ["teacher"] },
      "course-1",
      "activity-1",
      "group-1"
    );
  });

  it("validates and sends a trimmed broadcast", async () => {
    const response = await POST(new NextRequest("http://test.local/messages", {
      method: "POST",
      body: JSON.stringify({ body: "  Please check question 2.  " }),
      headers: { "content-type": "application/json" }
    }), params);
    expect(response.status).toBe(201);
    expect(mocks.sendBroadcast).toHaveBeenCalledWith(
      { id: "teacher-1", roles: ["teacher"] },
      "course-1",
      "activity-1",
      "Please check question 2.",
      null
    );
  });
});
