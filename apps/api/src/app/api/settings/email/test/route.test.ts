import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  sendEmailDeliveryTest: vi.fn(),
  getServerEnv: vi.fn(),
  readJson: vi.fn(),
  requireUser: vi.fn()
}));

vi.mock("@cognelo/core", () => ({ sendEmailDeliveryTest: mocks.sendEmailDeliveryTest }));
vi.mock("@cognelo/config", () => ({ getServerEnv: mocks.getServerEnv }));
vi.mock("@/lib/http", () => ({
  handleRoute: async (handler: () => Promise<Response>) => handler(),
  json: (data: unknown, init?: ResponseInit) => Response.json(data, init),
  options: () => new Response(null, { status: 204 }),
  readJson: mocks.readJson,
  requireUser: mocks.requireUser
}));

const { POST } = await import("./route");

describe("email test route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireUser.mockResolvedValue({ id: "admin-1", roles: ["admin"] });
    mocks.getServerEnv.mockReturnValue({ EMAIL_CREDENTIALS_ENCRYPTION_KEY: "22".repeat(32) });
    mocks.sendEmailDeliveryTest.mockResolvedValue({ ok: true });
  });

  it("allows an admin to request a test to any submitted address", async () => {
    const input = { recipientEmail: "outside@gmail.com" };
    mocks.readJson.mockResolvedValue(input);
    const response = await POST(new Request("http://localhost/api/settings/email/test", { method: "POST" }) as never);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(mocks.sendEmailDeliveryTest).toHaveBeenCalledWith(
      { id: "admin-1", roles: ["admin"] },
      input,
      "22".repeat(32)
    );
  });
});
