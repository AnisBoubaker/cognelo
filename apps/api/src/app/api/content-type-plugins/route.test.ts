import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  listContentTypePluginInstallations: vi.fn(),
  requireUser: vi.fn()
}));

vi.mock("@cognelo/core", () => ({
  listContentTypePluginInstallations: mocks.listContentTypePluginInstallations
}));

vi.mock("@/lib/http", () => ({
  handleRoute: async (handler: () => Promise<Response>) => handler(),
  json: (data: unknown, init?: ResponseInit) => Response.json(data, init),
  options: () => new Response(null, { status: 204 }),
  requireUser: mocks.requireUser
}));

const { GET } = await import("./route");

describe("content type plugins route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireUser.mockResolvedValue({ id: "admin-1", roles: ["admin"] });
    mocks.listContentTypePluginInstallations.mockResolvedValue([{ key: "file-content", isActivated: false, isEnabled: false }]);
  });

  it("lists content type plugin installations for the current user", async () => {
    const response = await GET();

    await expect(response.json()).resolves.toEqual({
      plugins: [{ key: "file-content", isActivated: false, isEnabled: false }]
    });
    expect(mocks.listContentTypePluginInstallations).toHaveBeenCalledWith({ id: "admin-1", roles: ["admin"] });
  });
});
