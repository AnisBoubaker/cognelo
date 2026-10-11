import { beforeEach, describe, expect, it, vi } from "vitest";

const routeHandler = vi.hoisted(() => vi.fn());

const mocks = vi.hoisted(() => ({
  assertActivityTypePluginEnabled: vi.fn(),
  assertCanManageCourse: vi.fn(),
  assertCanViewCourseGradebook: vi.fn(),
  getActivity: vi.fn(),
  getActivityForGradebook: vi.fn(),
  requireUser: vi.fn(),
  resolveCoursePluginRouteAuthorization: vi.fn(),
  resolvePluginRoute: vi.fn()
}));

vi.mock("@cognelo/core", () => ({
  AppError: class AppError extends Error {
    constructor(
      public status: number,
      public code: string,
      message: string,
      public details?: unknown
    ) {
      super(message);
    }
  },
  assertActivityTypePluginEnabled: mocks.assertActivityTypePluginEnabled,
  assertCanManageCourse: mocks.assertCanManageCourse,
  assertCanViewCourseGradebook: mocks.assertCanViewCourseGradebook,
  getActivity: mocks.getActivity,
  getActivityForGradebook: mocks.getActivityForGradebook
}));

vi.mock("@cognelo/activity-sdk/server", () => ({
  resolveCoursePluginRouteAuthorization: mocks.resolveCoursePluginRouteAuthorization,
  resolvePluginRoute: mocks.resolvePluginRoute
}));

vi.mock("@/lib/http", () => ({
  handleRoute: async (handler: () => Promise<Response>) => handler(),
  json: (data: unknown, init?: ResponseInit) => Response.json(data, init),
  options: () => new Response(null, { status: 204 }),
  requireUser: mocks.requireUser
}));

const { GET, POST } = await import("./route");

describe("course activity plugin dispatch route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireUser.mockResolvedValue({ id: "user-1", roles: ["teacher"] });
    mocks.resolveCoursePluginRouteAuthorization.mockReturnValue("manage_course");
    const activity = {
      id: "activity-1",
      bankActivityId: "bank-activity-1",
      activityVersionId: "version-1",
      title: "Activity",
      description: "",
      lifecycle: "draft",
      config: { prompt: "Solve it" },
      metadata: {},
      activityType: { key: "coding-exercise", name: "Coding exercise", description: "" }
    };
    mocks.getActivity.mockResolvedValue(activity);
    mocks.getActivityForGradebook.mockResolvedValue(activity);
    routeHandler.mockResolvedValue({ ok: true });
    mocks.resolvePluginRoute.mockReturnValue({ methods: { POST: routeHandler } });
  });

  it("dispatches supported plugin methods with course activity context", async () => {
    const response = await POST(new Request("http://test.local", { method: "POST", body: "{\"run\":true}" }) as never, {
      params: Promise.resolve({ courseId: "course-1", activityId: "activity-1", pluginPath: ["run"] })
    });

    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(mocks.getActivity).toHaveBeenCalledWith({ id: "user-1", roles: ["teacher"] }, "course-1", "activity-1");
    expect(mocks.assertActivityTypePluginEnabled).toHaveBeenCalledWith("coding-exercise");
    expect(mocks.resolvePluginRoute).toHaveBeenCalledWith("coding-exercise", ["run"]);
    expect(routeHandler).toHaveBeenCalledWith(
      expect.objectContaining({
        context: expect.objectContaining({
          courseId: "course-1",
          activityId: "activity-1",
          activity: expect.objectContaining({
            id: "activity-1",
            bankActivityId: "bank-activity-1",
            activityType: { key: "coding-exercise", name: "Coding exercise", description: "" }
          })
        }),
        readJson: expect.any(Function)
      })
    );
  });

  it("rejects unsupported plugin methods", async () => {
    mocks.resolvePluginRoute.mockReturnValue({ methods: { POST: routeHandler } });

    await expect(
      GET(new Request("http://test.local", { method: "GET" }) as never, {
        params: Promise.resolve({ courseId: "course-1", activityId: "activity-1", pluginPath: ["run"] })
      })
    ).rejects.toMatchObject({ status: 405, code: "METHOD_NOT_ALLOWED" });
  });

  it("uses a plugin's declared gradebook authorization for read-only review routes", async () => {
    mocks.resolveCoursePluginRouteAuthorization.mockReturnValue("view_gradebook");
    mocks.resolvePluginRoute.mockReturnValue({ methods: { GET: routeHandler } });

    await GET(new Request("http://test.local", { method: "GET" }) as never, {
      params: Promise.resolve({ courseId: "course-1", activityId: "activity-1", pluginPath: ["review-all"] })
    });

    expect(mocks.assertCanViewCourseGradebook).toHaveBeenCalledWith({ id: "user-1", roles: ["teacher"] }, "course-1");
    expect(mocks.getActivityForGradebook).toHaveBeenCalledWith({ id: "user-1", roles: ["teacher"] }, "course-1", "activity-1");
    expect(mocks.assertCanManageCourse).not.toHaveBeenCalled();
    expect(mocks.getActivity).not.toHaveBeenCalled();
  });

  it("fails before plugin resolution when the user cannot manage the course", async () => {
    mocks.assertCanManageCourse.mockRejectedValueOnce(new Error("forbidden"));
    await expect(
      POST(new Request("http://test.local", { method: "POST" }) as never, {
        params: Promise.resolve({ courseId: "course-1", activityId: "activity-1", pluginPath: ["fake", "run"] })
      })
    ).rejects.toThrow("forbidden");
    expect(mocks.getActivity).not.toHaveBeenCalled();
    expect(mocks.resolvePluginRoute).not.toHaveBeenCalled();
  });
});
