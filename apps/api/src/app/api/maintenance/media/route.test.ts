import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getMediaMaintenanceOverview: vi.fn(),
  runMediaMaintenance: vi.fn(),
  requireUser: vi.fn()
}));

vi.mock("@cognelo/core", () => ({
  getMediaMaintenanceOverview: mocks.getMediaMaintenanceOverview,
  runMediaMaintenance: mocks.runMediaMaintenance
}));
vi.mock("@/lib/http", () => ({
  handleRoute: async (handler: () => Promise<Response>) => handler(),
  json: (data: unknown) => Response.json(data),
  options: () => new Response(null, { status: 204 }),
  requireUser: mocks.requireUser
}));

import { GET, POST } from "./route";

describe("media maintenance route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireUser.mockResolvedValue({ id: "admin-1", roles: ["admin"] });
  });

  it("returns the administrator media overview", async () => {
    const overview = { blobCount: 3, storedBytes: 2048 };
    mocks.getMediaMaintenanceOverview.mockResolvedValue(overview);

    const response = await GET();

    expect(await response.json()).toEqual({ overview });
    expect(mocks.getMediaMaintenanceOverview).toHaveBeenCalledWith({ id: "admin-1", roles: ["admin"] });
  });

  it("runs confirmed cleanup through the core maintenance service", async () => {
    const result = { cleanup: { removedAssets: 2 }, overview: { blobCount: 1 } };
    mocks.runMediaMaintenance.mockResolvedValue(result);

    const response = await POST();

    expect(await response.json()).toEqual(result);
    expect(mocks.runMediaMaintenance).toHaveBeenCalledWith({ id: "admin-1", roles: ["admin"] });
  });
});
