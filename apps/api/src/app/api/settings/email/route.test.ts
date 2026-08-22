import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getEmailDeliveryConfiguration: vi.fn(),
  updateEmailDeliveryConfiguration: vi.fn(),
  getServerEnv: vi.fn(),
  readJson: vi.fn(),
  requireUser: vi.fn()
}));

vi.mock("@cognelo/core", () => ({
  getEmailDeliveryConfiguration: mocks.getEmailDeliveryConfiguration,
  updateEmailDeliveryConfiguration: mocks.updateEmailDeliveryConfiguration
}));
vi.mock("@cognelo/config", () => ({ getServerEnv: mocks.getServerEnv }));
vi.mock("@/lib/http", () => ({
  handleRoute: async (handler: () => Promise<Response>) => handler(),
  json: (data: unknown, init?: ResponseInit) => Response.json(data, init),
  options: () => new Response(null, { status: 204 }),
  readJson: mocks.readJson,
  requireUser: mocks.requireUser
}));

const { GET, PUT } = await import("./route");

describe("email settings route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireUser.mockResolvedValue({ id: "admin-1", roles: ["admin"] });
    mocks.getServerEnv.mockReturnValue({ EMAIL_CREDENTIALS_ENCRYPTION_KEY: "11".repeat(32) });
  });

  it("returns the admin-visible configuration", async () => {
    mocks.getEmailDeliveryConfiguration.mockResolvedValue({ configured: false, transport: "smtp" });
    const response = await GET();
    await expect(response.json()).resolves.toEqual({ configuration: { configured: false, transport: "smtp" } });
    expect(mocks.getEmailDeliveryConfiguration).toHaveBeenCalledWith({ id: "admin-1", roles: ["admin"] });
  });

  it("updates configuration with the server encryption key", async () => {
    const input = { transport: "smtp" };
    mocks.readJson.mockResolvedValue(input);
    mocks.updateEmailDeliveryConfiguration.mockResolvedValue({ configured: true, transport: "smtp" });
    const response = await PUT(new Request("http://localhost/api/settings/email", { method: "PUT" }) as never);
    expect(response.status).toBe(200);
    expect(mocks.updateEmailDeliveryConfiguration).toHaveBeenCalledWith(
      { id: "admin-1", roles: ["admin"] },
      input,
      "11".repeat(32)
    );
  });
});
