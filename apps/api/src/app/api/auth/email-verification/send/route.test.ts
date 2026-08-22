import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getServerEnv: vi.fn(),
  requestEmailVerification: vi.fn(),
  readJson: vi.fn(),
  requireUser: vi.fn()
}));

vi.mock("@cognelo/config", () => ({ getServerEnv: mocks.getServerEnv }));
vi.mock("@cognelo/core", () => ({ requestEmailVerification: mocks.requestEmailVerification }));
vi.mock("@/lib/http", () => ({
  handleRoute: async (handler: () => Promise<Response>) => handler(),
  json: (data: unknown, init?: ResponseInit) => Response.json(data, init),
  options: () => new Response(null, { status: 204 }),
  readJson: mocks.readJson,
  requireUser: mocks.requireUser
}));

const { POST } = await import("./route");

describe("email verification send route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireUser.mockResolvedValue({ id: "user-1", email: "student@example.test", emailVerified: false });
    mocks.getServerEnv.mockReturnValue({ EMAIL_CREDENTIALS_ENCRYPTION_KEY: "44".repeat(32) });
    mocks.readJson.mockResolvedValue({ locale: "fr" });
    mocks.requestEmailVerification.mockResolvedValue({ required: true, sent: true, retryAfterSeconds: 60, expiresInSeconds: 600 });
  });

  it("allows a restricted session to request its code", async () => {
    const response = await POST(new Request("http://test.local", { method: "POST" }) as never);
    await expect(response.json()).resolves.toMatchObject({ sent: true, retryAfterSeconds: 60 });
    expect(mocks.requireUser).toHaveBeenCalledWith({ allowPasswordChangeRequired: true, allowEmailVerificationRequired: true });
    expect(mocks.requestEmailVerification).toHaveBeenCalledWith(
      { id: "user-1", email: "student@example.test", emailVerified: false },
      { locale: "fr" },
      "44".repeat(32)
    );
  });
});
