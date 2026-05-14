import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  readJson: vi.fn(),
  requireUser: vi.fn(),
  updateActivityPluginInstallation: vi.fn()
}));

vi.mock("@cognelo/core", () => ({
  updateActivityPluginInstallation: mocks.updateActivityPluginInstallation
}));

vi.mock("@/lib/http", () => ({
  handleRoute: async (handler: () => Promise<Response>) => handler(),
  json: (data: unknown, init?: ResponseInit) => Response.json(data, init),
  options: () => new Response(null, { status: 204 }),
  readJson: mocks.readJson,
  requireUser: mocks.requireUser
}));

const { PATCH } = await import("./route");

describe("plugin installation route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireUser.mockResolvedValue({ id: "admin-1", roles: ["admin"] });
    mocks.readJson.mockResolvedValue({ action: "activate" });
    mocks.updateActivityPluginInstallation.mockResolvedValue({ key: "placeholder", isActivated: true, isEnabled: false });
  });

  it("updates the selected plugin installation", async () => {
    const response = await PATCH(new Request("http://test.local") as never, {
      params: Promise.resolve({ pluginKey: "placeholder" })
    });

    await expect(response.json()).resolves.toEqual({
      plugin: { key: "placeholder", isActivated: true, isEnabled: false }
    });
    expect(mocks.updateActivityPluginInstallation).toHaveBeenCalledWith(
      { id: "admin-1", roles: ["admin"] },
      "placeholder",
      { action: "activate" }
    );
  });
});
