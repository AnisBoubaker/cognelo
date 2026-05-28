import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  readJson: vi.fn(),
  requireUser: vi.fn(),
  updateContentTypePluginInstallation: vi.fn()
}));

vi.mock("@cognelo/core", () => ({
  updateContentTypePluginInstallation: mocks.updateContentTypePluginInstallation
}));

vi.mock("@/lib/http", () => ({
  handleRoute: async (handler: () => Promise<Response>) => handler(),
  json: (data: unknown, init?: ResponseInit) => Response.json(data, init),
  options: () => new Response(null, { status: 204 }),
  readJson: mocks.readJson,
  requireUser: mocks.requireUser
}));

const { PATCH } = await import("./route");

describe("content type plugin installation route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireUser.mockResolvedValue({ id: "admin-1", roles: ["admin"] });
    mocks.readJson.mockResolvedValue({ action: "activate" });
    mocks.updateContentTypePluginInstallation.mockResolvedValue({ key: "file-content", isActivated: true, isEnabled: false });
  });

  it("updates the selected content type plugin installation", async () => {
    const response = await PATCH(new Request("http://test.local", { method: "PATCH" }) as never, {
      params: Promise.resolve({ pluginKey: "file-content" })
    });

    await expect(response.json()).resolves.toEqual({
      plugin: { key: "file-content", isActivated: true, isEnabled: false }
    });
    expect(mocks.updateContentTypePluginInstallation).toHaveBeenCalledWith(
      { id: "admin-1", roles: ["admin"] },
      "file-content",
      { action: "activate" }
    );
  });
});
