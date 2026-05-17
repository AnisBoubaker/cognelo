import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getGroupAssignedActivity: vi.fn(),
  requireUser: vi.fn()
}));

vi.mock("@cognelo/core", () => ({
  getGroupAssignedActivity: mocks.getGroupAssignedActivity
}));

vi.mock("@/lib/http", () => ({
  handleRoute: async (handler: () => Promise<Response>) => handler(),
  json: (data: unknown, init?: ResponseInit) => Response.json(data, init),
  options: () => new Response(null, { status: 204 }),
  requireUser: mocks.requireUser
}));

const { GET } = await import("./route");

describe("assigned group activity detail route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireUser.mockResolvedValue({ id: "teacher-1", roles: ["teacher"] });
    mocks.getGroupAssignedActivity.mockResolvedValue({ id: "activity-1", title: "Assigned" });
  });

  it("returns assigned group activity details", async () => {
    const response = await GET(new Request("http://test.local") as never, {
      params: Promise.resolve({ courseId: "course-1", groupId: "group-1", activityId: "activity-1" })
    });

    await expect(response.json()).resolves.toEqual({ activity: { id: "activity-1", title: "Assigned" } });
    expect(mocks.getGroupAssignedActivity).toHaveBeenCalledWith(
      { id: "teacher-1", roles: ["teacher"] },
      "course-1",
      "group-1",
      "activity-1"
    );
  });
});
