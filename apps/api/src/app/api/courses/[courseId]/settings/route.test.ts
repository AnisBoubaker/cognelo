import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  readJson: vi.fn(),
  requireUser: vi.fn(),
  updateCourseSettings: vi.fn()
}));

vi.mock("@cognelo/core", () => ({
  updateCourseSettings: mocks.updateCourseSettings
}));

vi.mock("@/lib/http", () => ({
  handleRoute: async (handler: () => Promise<Response>) => handler(),
  json: (data: unknown, init?: ResponseInit) => Response.json(data, init),
  options: () => new Response(null, { status: 204 }),
  readJson: mocks.readJson,
  requireUser: mocks.requireUser
}));

const { PATCH } = await import("./route");

describe("course settings route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireUser.mockResolvedValue({ id: "teacher-1", roles: ["teacher"] });
    mocks.readJson.mockResolvedValue({ enrollment: "closed" });
    mocks.updateCourseSettings.mockResolvedValue({ id: "course-1", settings: { enrollment: "closed" } });
  });

  it("updates course settings", async () => {
    const response = await PATCH(new Request("http://test.local") as never, {
      params: Promise.resolve({ courseId: "course-1" })
    });

    await expect(response.json()).resolves.toEqual({ course: { id: "course-1", settings: { enrollment: "closed" } } });
    expect(mocks.updateCourseSettings).toHaveBeenCalledWith({ id: "teacher-1", roles: ["teacher"] }, "course-1", {
      enrollment: "closed"
    });
  });
});
