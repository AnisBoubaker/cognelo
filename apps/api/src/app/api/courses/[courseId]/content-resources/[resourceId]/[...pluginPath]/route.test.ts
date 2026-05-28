import { beforeEach, describe, expect, it, vi } from "vitest";

const routeHandler = vi.hoisted(() => vi.fn());

const mocks = vi.hoisted(() => ({
  getContentResourceForPluginRoute: vi.fn(),
  requireUser: vi.fn(),
  resolveContentTypePluginRoute: vi.fn()
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
  getContentResourceForPluginRoute: mocks.getContentResourceForPluginRoute
}));

vi.mock("@cognelo/content-type-sdk/server", () => ({
  resolveContentTypePluginRoute: mocks.resolveContentTypePluginRoute
}));

vi.mock("@/lib/http", () => ({
  handleRoute: async (handler: () => Promise<Response>) => handler(),
  json: (data: unknown, init?: ResponseInit) => Response.json(data, init),
  options: () => new Response(null, { status: 204 }),
  requireUser: mocks.requireUser
}));

const { GET, POST } = await import("./route");

describe("course content resource plugin dispatch route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireUser.mockResolvedValue({ id: "user-1", roles: ["student"] });
    mocks.getContentResourceForPluginRoute.mockResolvedValue({
      id: "resource-1",
      courseId: "course-1",
      groupId: null,
      contentTypeKey: "github-repo",
      pluginKey: "github-repo-content",
      title: "Examples",
      metadata: { url: "https://github.com/org/repo" }
    });
    routeHandler.mockResolvedValue({ ok: true });
    mocks.resolveContentTypePluginRoute.mockReturnValue({ methods: { POST: routeHandler } });
  });

  it("dispatches supported content type plugin methods with resource context", async () => {
    const response = await POST(new Request("http://test.local", { method: "POST", body: "{\"run\":true}" }) as never, {
      params: Promise.resolve({ courseId: "course-1", resourceId: "resource-1", pluginPath: ["sync"] })
    });

    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(mocks.getContentResourceForPluginRoute).toHaveBeenCalledWith({ id: "user-1", roles: ["student"] }, "course-1", "resource-1", {
      groupId: undefined
    });
    expect(mocks.resolveContentTypePluginRoute).toHaveBeenCalledWith("github-repo-content", "github-repo", ["sync"]);
    expect(routeHandler).toHaveBeenCalledWith(
      expect.objectContaining({
        context: expect.objectContaining({
          courseId: "course-1",
          contentTypeKey: "github-repo",
          resourceId: "resource-1",
          resource: expect.objectContaining({
            id: "resource-1",
            pluginKey: "github-repo-content"
          })
        }),
        readJson: expect.any(Function)
      })
    );
  });

  it("uses core visibility enforcement for plugin routes and rejects unsupported methods", async () => {
    mocks.resolveContentTypePluginRoute.mockReturnValue({ methods: { POST: routeHandler } });

    await expect(
      GET(new Request("http://test.local", { method: "GET" }) as never, {
        params: Promise.resolve({ courseId: "course-1", resourceId: "resource-1", pluginPath: ["sync"] })
      })
    ).rejects.toMatchObject({ status: 405, code: "METHOD_NOT_ALLOWED" });
    expect(mocks.getContentResourceForPluginRoute).toHaveBeenCalledWith({ id: "user-1", roles: ["student"] }, "course-1", "resource-1", {
      groupId: undefined
    });
  });
});
