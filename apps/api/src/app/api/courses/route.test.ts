import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createCourse: vi.fn(),
  listCourses: vi.fn(),
  readJson: vi.fn(),
  requireUser: vi.fn()
}));

vi.mock("@cognelo/core", () => ({
  createCourse: mocks.createCourse,
  listCourses: mocks.listCourses
}));

vi.mock("@/lib/http", () => ({
  handleRoute: async (handler: () => Promise<Response>) => handler(),
  json: (data: unknown, init?: ResponseInit) => Response.json(data, init),
  options: () => new Response(null, { status: 204 }),
  readJson: mocks.readJson,
  requireUser: mocks.requireUser
}));

const { GET, POST } = await import("./route");

describe("courses route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireUser.mockResolvedValue({ id: "teacher-1", roles: ["teacher"] });
    mocks.listCourses.mockResolvedValue([{ id: "course-1" }]);
    mocks.readJson.mockResolvedValue({ title: "Programming", subjectId: "subject-1" });
    mocks.createCourse.mockResolvedValue({ id: "course-1" });
  });

  it("lists courses for the current user", async () => {
    const response = await GET();

    await expect(response.json()).resolves.toEqual({ courses: [{ id: "course-1" }] });
    expect(mocks.listCourses).toHaveBeenCalledWith({ id: "teacher-1", roles: ["teacher"] });
  });

  it("creates a course from the request body", async () => {
    const response = await POST(new Request("http://test.local") as never);

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({ course: { id: "course-1" } });
    expect(mocks.createCourse).toHaveBeenCalledWith(
      { id: "teacher-1", roles: ["teacher"] },
      { title: "Programming", subjectId: "subject-1" }
    );
  });
});
