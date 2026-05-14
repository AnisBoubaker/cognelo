import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  archiveCourse: vi.fn(),
  getCourse: vi.fn(),
  readJson: vi.fn(),
  requireUser: vi.fn(),
  updateCourse: vi.fn()
}));

vi.mock("@cognelo/core", () => ({
  archiveCourse: mocks.archiveCourse,
  getCourse: mocks.getCourse,
  updateCourse: mocks.updateCourse
}));

vi.mock("@/lib/http", () => ({
  handleRoute: async (handler: () => Promise<Response>) => handler(),
  json: (data: unknown, init?: ResponseInit) => Response.json(data, init),
  options: () => new Response(null, { status: 204 }),
  readJson: mocks.readJson,
  requireUser: mocks.requireUser
}));

const { DELETE, GET, PATCH } = await import("./route");

describe("course detail route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireUser.mockResolvedValue({ id: "teacher-1", roles: ["teacher"] });
    mocks.getCourse.mockResolvedValue({ id: "course-1" });
    mocks.readJson.mockResolvedValue({ title: "Updated" });
    mocks.updateCourse.mockResolvedValue({ id: "course-1", title: "Updated" });
    mocks.archiveCourse.mockResolvedValue({ id: "course-1", status: "archived" });
  });

  it("gets, updates, and archives the selected course", async () => {
    await expect(
      (
        await GET(new Request("http://test.local") as never, { params: Promise.resolve({ courseId: "course-1" }) })
      ).json()
    ).resolves.toEqual({ course: { id: "course-1" } });

    await expect(
      (
        await PATCH(new Request("http://test.local") as never, { params: Promise.resolve({ courseId: "course-1" }) })
      ).json()
    ).resolves.toEqual({ course: { id: "course-1", title: "Updated" } });

    await expect(
      (
        await DELETE(new Request("http://test.local") as never, { params: Promise.resolve({ courseId: "course-1" }) })
      ).json()
    ).resolves.toEqual({ course: { id: "course-1", status: "archived" } });

    expect(mocks.getCourse).toHaveBeenCalledWith({ id: "teacher-1", roles: ["teacher"] }, "course-1");
    expect(mocks.updateCourse).toHaveBeenCalledWith({ id: "teacher-1", roles: ["teacher"] }, "course-1", { title: "Updated" });
    expect(mocks.archiveCourse).toHaveBeenCalledWith({ id: "teacher-1", roles: ["teacher"] }, "course-1");
  });
});
