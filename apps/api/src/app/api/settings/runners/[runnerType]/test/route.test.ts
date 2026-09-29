import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getServerEnv: vi.fn(),
  requireUser: vi.fn(),
  testExecutionRunnerConnection: vi.fn()
}));

vi.mock("@cognelo/core", () => ({
  testExecutionRunnerConnection: mocks.testExecutionRunnerConnection
}));
vi.mock("@cognelo/config", () => ({ getServerEnv: mocks.getServerEnv }));
vi.mock("@/lib/http", () => ({
  handleRoute: async (handler: () => Promise<Response>) => handler(),
  json: (data: unknown, init?: ResponseInit) => Response.json(data, init),
  options: () => new Response(null, { status: 204 }),
  requireUser: mocks.requireUser
}));

const { POST } = await import("./route");

describe("runner capability test route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireUser.mockResolvedValue({ id: "admin-1", roles: ["admin"] });
    mocks.getServerEnv.mockReturnValue({ EMAIL_CREDENTIALS_ENCRYPTION_KEY: "44".repeat(32) });
  });

  it("returns each required capability result", async () => {
    mocks.testExecutionRunnerConnection.mockResolvedValue({
      ok: true,
      capabilities: [{ key: "run", label: "Browser tests", ok: true, detail: "Available." }]
    });
    const response = await POST(
      new Request("http://localhost/api/settings/runners/web_design/test", { method: "POST" }) as never,
      { params: Promise.resolve({ runnerType: "web_design" }) }
    );
    await expect(response.json()).resolves.toMatchObject({ ok: true });
    expect(mocks.testExecutionRunnerConnection).toHaveBeenCalledWith(
      { id: "admin-1", roles: ["admin"] },
      "web_design",
      "44".repeat(32)
    );
  });
});
