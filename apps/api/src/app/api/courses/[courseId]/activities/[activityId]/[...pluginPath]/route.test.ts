import { beforeEach, describe, expect, it, vi } from "vitest";

const routeHandler = vi.hoisted(() => vi.fn());

const mocks = vi.hoisted(() => ({
  assertActivityTypePluginEnabled: vi.fn(),
  getActivity: vi.fn(),
  requireUser: vi.fn(),
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
  getActivity: mocks.getActivity
}));

vi.mock("@cognelo/activity-sdk/server", () => ({
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
    mocks.getActivity.mockResolvedValue({
      id: "activity-1",
      bankActivityId: "bank-activity-1",
      activityVersionId: "version-1",
      title: "Activity",
      description: "",
      lifecycle: "draft",
      config: { prompt: "Solve it" },
      metadata: {},
      activityType: { key: "coding-exercise", name: "Coding exercise", description: "" }
    });
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
});
