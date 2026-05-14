import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  listActivityPluginInstallations: vi.fn(),
  requireUser: vi.fn()
}));

vi.mock("@cognelo/core", () => ({
  listActivityPluginInstallations: mocks.listActivityPluginInstallations
}));

vi.mock("@/lib/http", () => ({
  handleRoute: async (handler: () => Promise<Response>) => handler(),
  json: (data: unknown, init?: ResponseInit) => Response.json(data, init),
  options: () => new Response(null, { status: 204 }),
  requireUser: mocks.requireUser
}));

const { GET } = await import("./route");

describe("plugins route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireUser.mockResolvedValue({ id: "admin-1", roles: ["admin"] });
    mocks.listActivityPluginInstallations.mockResolvedValue([{ key: "placeholder", isActivated: false, isEnabled: false }]);
  });

  it("lists plugin installations for the current user", async () => {
    const response = await GET();

    await expect(response.json()).resolves.toEqual({
      plugins: [{ key: "placeholder", isActivated: false, isEnabled: false }]
    });
    expect(mocks.listActivityPluginInstallations).toHaveBeenCalledWith({ id: "admin-1", roles: ["admin"] });
  });
});
