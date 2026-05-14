import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  assignActivityToGroup: vi.fn(),
  listGroupActivityAssignments: vi.fn(),
  readJson: vi.fn(),
  requireUser: vi.fn()
}));

vi.mock("@cognelo/core", () => ({
  assignActivityToGroup: mocks.assignActivityToGroup,
  listGroupActivityAssignments: mocks.listGroupActivityAssignments
}));

vi.mock("@/lib/http", () => ({
  handleRoute: async (handler: () => Promise<Response>) => handler(),
  json: (data: unknown, init?: ResponseInit) => Response.json(data, init),
  options: () => new Response(null, { status: 204 }),
  readJson: mocks.readJson,
  requireUser: mocks.requireUser
}));

const { GET, POST } = await import("./route");

describe("group activities route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireUser.mockResolvedValue({ id: "teacher-1", roles: ["teacher"] });
    mocks.listGroupActivityAssignments.mockResolvedValue([{ id: "assignment-1" }]);
    mocks.readJson.mockResolvedValue({ activityId: "activity-1" });
    mocks.assignActivityToGroup.mockResolvedValue({ id: "assignment-1" });
  });

  it("lists and assigns activities for the selected group", async () => {
    await expect(
      (
        await GET(new Request("http://test.local") as never, { params: Promise.resolve({ courseId: "course-1", groupId: "group-1" }) })
      ).json()
    ).resolves.toEqual({ assignments: [{ id: "assignment-1" }] });

    const createResponse = await POST(new Request("http://test.local") as never, {
      params: Promise.resolve({ courseId: "course-1", groupId: "group-1" })
    });

    expect(createResponse.status).toBe(201);
    await expect(createResponse.json()).resolves.toEqual({ assignment: { id: "assignment-1" } });
    expect(mocks.assignActivityToGroup).toHaveBeenCalledWith(
      { id: "teacher-1", roles: ["teacher"] },
      "course-1",
      "group-1",
      { activityId: "activity-1" }
    );
  });
});
