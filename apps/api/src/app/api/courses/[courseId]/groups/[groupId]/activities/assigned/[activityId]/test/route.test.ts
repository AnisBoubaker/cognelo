import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getTestRuntime: vi.fn(),
  startOrResumeTestAttempt: vi.fn(),
  requireUser: vi.fn()
}));

vi.mock("@cognelo/core", () => ({
  getTestRuntime: mocks.getTestRuntime,
  startOrResumeTestAttempt: mocks.startOrResumeTestAttempt
}));

vi.mock("@/lib/http", () => ({
  handleRoute: async (handler: () => Promise<Response>) => handler(),
  json: (data: unknown, init?: ResponseInit) => Response.json(data, init),
  options: () => new Response(null, { status: 204 }),
  requireUser: mocks.requireUser
}));

const { GET, POST } = await import("./route");
const params = {
  params: Promise.resolve({ courseId: "course-1", groupId: "group-1", activityId: "test-activity-1" })
};

describe("student Test runtime route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireUser.mockResolvedValue({ id: "student-1", roles: ["student"] });
    mocks.getTestRuntime.mockResolvedValue({ attempt: { id: "attempt-1" } });
    mocks.startOrResumeTestAttempt.mockResolvedValue({ attempt: { id: "attempt-1" } });
  });

  it("loads the requested active or previous Test sitting", async () => {
    const response = await GET(new Request("http://test.local?view=previous") as never, params);

    await expect(response.json()).resolves.toEqual({ runtime: { attempt: { id: "attempt-1" } } });
    expect(mocks.getTestRuntime).toHaveBeenCalledWith(
      { id: "student-1", roles: ["student"] },
      "course-1",
      "group-1",
      "test-activity-1",
      "previous"
    );
  });

  it("starts or resumes one parent Test attempt", async () => {
    const response = await POST(new Request("http://test.local", { method: "POST" }) as never, params);

    expect(response.status).toBe(201);
    expect(mocks.startOrResumeTestAttempt).toHaveBeenCalledWith(
      { id: "student-1", roles: ["student"] },
      "course-1",
      "group-1",
      "test-activity-1"
    );
  });
});
