import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createCourseGroup: vi.fn(),
  listCourseGroups: vi.fn(),
  readJson: vi.fn(),
  requireUser: vi.fn()
}));

vi.mock("@cognelo/core", () => ({
  createCourseGroup: mocks.createCourseGroup,
  listCourseGroups: mocks.listCourseGroups
}));

vi.mock("@/lib/http", () => ({
  handleRoute: async (handler: () => Promise<Response>) => handler(),
  json: (data: unknown, init?: ResponseInit) => Response.json(data, init),
  options: () => new Response(null, { status: 204 }),
  readJson: mocks.readJson,
  requireUser: mocks.requireUser
}));

const { GET, POST } = await import("./route");

describe("course groups route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireUser.mockResolvedValue({ id: "teacher-1", roles: ["teacher"] });
    mocks.listCourseGroups.mockResolvedValue([{ id: "group-1" }]);
    mocks.readJson.mockResolvedValue({ title: "Group A" });
    mocks.createCourseGroup.mockResolvedValue({ id: "group-1" });
  });

  it("lists and creates groups for the selected course", async () => {
    await expect(
      (
        await GET(new Request("http://test.local") as never, { params: Promise.resolve({ courseId: "course-1" }) })
      ).json()
    ).resolves.toEqual({ groups: [{ id: "group-1" }] });

    const createResponse = await POST(new Request("http://test.local") as never, {
      params: Promise.resolve({ courseId: "course-1" })
    });

    expect(createResponse.status).toBe(201);
    await expect(createResponse.json()).resolves.toEqual({ group: { id: "group-1" } });
    expect(mocks.listCourseGroups).toHaveBeenCalledWith({ id: "teacher-1", roles: ["teacher"] }, "course-1");
    expect(mocks.createCourseGroup).toHaveBeenCalledWith({ id: "teacher-1", roles: ["teacher"] }, "course-1", { title: "Group A" });
  });
});
