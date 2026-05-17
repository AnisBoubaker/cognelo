import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  addCourseMembership: vi.fn(),
  readJson: vi.fn(),
  requireUser: vi.fn()
}));

vi.mock("@cognelo/core", () => ({
  addCourseMembership: mocks.addCourseMembership
}));

vi.mock("@/lib/http", () => ({
  handleRoute: async (handler: () => Promise<Response>) => handler(),
  json: (data: unknown, init?: ResponseInit) => Response.json(data, init),
  options: () => new Response(null, { status: 204 }),
  readJson: mocks.readJson,
  requireUser: mocks.requireUser
}));

const { POST } = await import("./route");

describe("course memberships route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireUser.mockResolvedValue({ id: "teacher-1", roles: ["teacher"] });
    mocks.readJson.mockResolvedValue({ email: "student@example.test", role: "student" });
    mocks.addCourseMembership.mockResolvedValue({ id: "membership-1" });
  });

  it("adds a course membership", async () => {
    const response = await POST(new Request("http://test.local") as never, {
      params: Promise.resolve({ courseId: "course-1" })
    });

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({ membership: { id: "membership-1" } });
    expect(mocks.addCourseMembership).toHaveBeenCalledWith({ id: "teacher-1", roles: ["teacher"] }, "course-1", {
      email: "student@example.test",
      role: "student"
    });
  });
});
