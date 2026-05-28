import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createPluginContentResource: vi.fn(),
  listContentResources: vi.fn(),
  readJson: vi.fn(),
  requireUser: vi.fn()
}));

vi.mock("@cognelo/core", () => ({
  createPluginContentResource: mocks.createPluginContentResource,
  listContentResources: mocks.listContentResources
}));

vi.mock("@/lib/http", () => ({
  handleRoute: async (handler: () => Promise<Response>) => handler(),
  json: (data: unknown, init?: ResponseInit) => Response.json(data, init),
  options: () => new Response(null, { status: 204 }),
  readJson: mocks.readJson,
  requireUser: mocks.requireUser
}));

const { GET, POST } = await import("./route");

describe("course content resources route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireUser.mockResolvedValue({ id: "teacher-1", roles: ["teacher"] });
    mocks.listContentResources.mockResolvedValue([{ id: "resource-1" }]);
    mocks.readJson.mockResolvedValue({ contentTypeKey: "github-repo", payload: { url: "https://github.com/org/repo" } });
    mocks.createPluginContentResource.mockResolvedValue({ resource: { id: "resource-1" }, contentItem: { id: "item-1" } });
  });

  it("lists and creates plugin-backed content resources", async () => {
    const listResponse = await GET(new Request("http://test.local", { method: "GET" }) as never, {
      params: Promise.resolve({ courseId: "course-1" })
    });
    const createResponse = await POST(new Request("http://test.local", { method: "POST" }) as never, {
      params: Promise.resolve({ courseId: "course-1" })
    });

    await expect(listResponse.json()).resolves.toEqual({ resources: [{ id: "resource-1" }] });
    await expect(createResponse.json()).resolves.toEqual({ resource: { id: "resource-1" }, contentItem: { id: "item-1" } });
    expect(mocks.listContentResources).toHaveBeenCalledWith({ id: "teacher-1", roles: ["teacher"] }, "course-1");
    expect(mocks.createPluginContentResource).toHaveBeenCalledWith(
      { id: "teacher-1", roles: ["teacher"] },
      "course-1",
      { contentTypeKey: "github-repo", payload: { url: "https://github.com/org/repo" } }
    );
  });
});
