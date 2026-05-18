import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  assignActivityToAllCourseGroups: vi.fn(),
  removeActivityFromAllCourseGroupsPolicy: vi.fn(),
  readJson: vi.fn(),
  requireUser: vi.fn()
}));

vi.mock("@cognelo/core", () => ({
  assignActivityToAllCourseGroups: mocks.assignActivityToAllCourseGroups,
  removeActivityFromAllCourseGroupsPolicy: mocks.removeActivityFromAllCourseGroupsPolicy
}));

vi.mock("@/lib/http", () => ({
  handleRoute: async (handler: () => Promise<Response>) => handler(),
  json: (data: unknown, init?: ResponseInit) => Response.json(data, init),
  options: () => new Response(null, { status: 204 }),
  readJson: mocks.readJson,
  requireUser: mocks.requireUser
}));

const { DELETE, POST } = await import("./route");

describe("assign all course groups route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireUser.mockResolvedValue({ id: "teacher-1", roles: ["teacher"] });
    mocks.readJson.mockResolvedValue({ availableFrom: "2026-05-18T13:00:00.000Z", availableUntil: null });
    mocks.assignActivityToAllCourseGroups.mockResolvedValue({ id: "activity-1" });
    mocks.removeActivityFromAllCourseGroupsPolicy.mockResolvedValue({ id: "activity-1" });
  });

  it("assigns a course activity to every group", async () => {
    const response = await POST(new Request("http://test.local") as never, {
      params: Promise.resolve({ courseId: "course-1", activityId: "activity-1" })
    });

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({ activity: { id: "activity-1" } });
    expect(mocks.assignActivityToAllCourseGroups).toHaveBeenCalledWith(
      { id: "teacher-1", roles: ["teacher"] },
      "course-1",
      "activity-1",
      { availableFrom: "2026-05-18T13:00:00.000Z", availableUntil: null }
    );
  });

  it("removes the all-groups policy without deleting group assignments", async () => {
    const response = await DELETE(new Request("http://test.local") as never, {
      params: Promise.resolve({ courseId: "course-1", activityId: "activity-1" })
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ activity: { id: "activity-1" } });
    expect(mocks.removeActivityFromAllCourseGroupsPolicy).toHaveBeenCalledWith(
      { id: "teacher-1", roles: ["teacher"] },
      "course-1",
      "activity-1"
    );
  });
});
