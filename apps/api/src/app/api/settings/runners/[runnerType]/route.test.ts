import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getServerEnv: vi.fn(),
  readJson: vi.fn(),
  requireUser: vi.fn(),
  updateExecutionRunnerConfiguration: vi.fn()
}));

vi.mock("@cognelo/core", () => ({
  updateExecutionRunnerConfiguration: mocks.updateExecutionRunnerConfiguration
}));
vi.mock("@cognelo/config", () => ({ getServerEnv: mocks.getServerEnv }));
vi.mock("@/lib/http", () => ({
  handleRoute: async (handler: () => Promise<Response>) => handler(),
  json: (data: unknown, init?: ResponseInit) => Response.json(data, init),
  options: () => new Response(null, { status: 204 }),
  readJson: mocks.readJson,
  requireUser: mocks.requireUser
}));

const { PUT } = await import("./route");

describe("runner configuration route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireUser.mockResolvedValue({ id: "admin-1", roles: ["admin"] });
    mocks.getServerEnv.mockReturnValue({ EMAIL_CREDENTIALS_ENCRYPTION_KEY: "33".repeat(32) });
  });

  it("updates a runner using the server-held encryption key", async () => {
    const input = { displayName: "Sage", baseUrl: "https://sage.example.test" };
    mocks.readJson.mockResolvedValue(input);
    mocks.updateExecutionRunnerConfiguration.mockResolvedValue({ runnerType: "sagemath", configured: true });
    const response = await PUT(
      new Request("http://localhost/api/settings/runners/sagemath", { method: "PUT" }) as never,
      { params: Promise.resolve({ runnerType: "sagemath" }) }
    );
    expect(response.status).toBe(200);
    expect(mocks.updateExecutionRunnerConfiguration).toHaveBeenCalledWith(
      { id: "admin-1", roles: ["admin"] },
      "sagemath",
      input,
      "33".repeat(32)
    );
  });
});
