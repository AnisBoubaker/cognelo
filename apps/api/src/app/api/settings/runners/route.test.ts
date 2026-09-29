import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  listExecutionRunnerConfigurations: vi.fn(),
  requireUser: vi.fn()
}));

vi.mock("@cognelo/core", () => ({
  listExecutionRunnerConfigurations: mocks.listExecutionRunnerConfigurations
}));
vi.mock("@/lib/http", () => ({
  handleRoute: async (handler: () => Promise<Response>) => handler(),
  json: (data: unknown, init?: ResponseInit) => Response.json(data, init),
  options: () => new Response(null, { status: 204 }),
  requireUser: mocks.requireUser
}));

const { GET } = await import("./route");

describe("runner settings route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireUser.mockResolvedValue({ id: "admin-1", roles: ["admin"] });
  });

  it("returns the admin-visible runner registry", async () => {
    mocks.listExecutionRunnerConfigurations.mockResolvedValue([{ runnerType: "judge0", configured: false }]);
    const response = await GET();
    await expect(response.json()).resolves.toEqual({
      configurations: [{ runnerType: "judge0", configured: false }]
    });
    expect(mocks.listExecutionRunnerConfigurations).toHaveBeenCalledWith({ id: "admin-1", roles: ["admin"] });
  });
});
