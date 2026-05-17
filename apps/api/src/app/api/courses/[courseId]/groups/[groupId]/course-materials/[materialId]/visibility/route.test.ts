import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  hideCourseMaterialForGroup: vi.fn(),
  requireUser: vi.fn(),
  unhideCourseMaterialForGroup: vi.fn()
}));

vi.mock("@cognelo/core", () => ({
  hideCourseMaterialForGroup: mocks.hideCourseMaterialForGroup,
  unhideCourseMaterialForGroup: mocks.unhideCourseMaterialForGroup
}));

vi.mock("@/lib/http", () => ({
  handleRoute: async (handler: () => Promise<Response>) => handler(),
  json: (data: unknown, init?: ResponseInit) => Response.json(data, init),
  options: () => new Response(null, { status: 204 }),
  requireUser: mocks.requireUser
}));

const { DELETE, PUT } = await import("./route");

describe("group inherited course material visibility route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireUser.mockResolvedValue({ id: "teacher-1", roles: ["teacher"] });
    mocks.hideCourseMaterialForGroup.mockResolvedValue({ ok: true, hidden: true });
    mocks.unhideCourseMaterialForGroup.mockResolvedValue({ ok: true, hidden: false });
  });

  it("hides inherited course materials for a group", async () => {
    const response = await PUT(new Request("http://test.local") as never, {
      params: Promise.resolve({ courseId: "course-1", groupId: "group-1", materialId: "material-1" })
    });

    await expect(response.json()).resolves.toEqual({ ok: true, hidden: true });
    expect(mocks.hideCourseMaterialForGroup).toHaveBeenCalledWith(
      { id: "teacher-1", roles: ["teacher"] },
      "course-1",
      "group-1",
      "material-1"
    );
  });

  it("unhides inherited course materials for a group", async () => {
    const response = await DELETE(new Request("http://test.local") as never, {
      params: Promise.resolve({ courseId: "course-1", groupId: "group-1", materialId: "material-1" })
    });

    await expect(response.json()).resolves.toEqual({ ok: true, hidden: false });
    expect(mocks.unhideCourseMaterialForGroup).toHaveBeenCalledWith(
      { id: "teacher-1", roles: ["teacher"] },
      "course-1",
      "group-1",
      "material-1"
    );
  });
});
