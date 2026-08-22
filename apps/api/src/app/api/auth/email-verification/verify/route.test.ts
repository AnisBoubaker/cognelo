import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getServerEnv: vi.fn(),
  readJson: vi.fn(),
  requireUser: vi.fn(),
  verifyEmailAddress: vi.fn()
}));

vi.mock("@cognelo/config", () => ({ getServerEnv: mocks.getServerEnv }));
vi.mock("@cognelo/core", () => ({ verifyEmailAddress: mocks.verifyEmailAddress }));
vi.mock("@/lib/http", () => ({
  handleRoute: async (handler: () => Promise<Response>) => handler(),
  json: (data: unknown, init?: ResponseInit) => Response.json(data, init),
  options: () => new Response(null, { status: 204 }),
  readJson: mocks.readJson,
  requireUser: mocks.requireUser
}));

const { POST } = await import("./route");

describe("email verification verify route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireUser.mockResolvedValue({ id: "user-1", email: "student@example.test", emailVerified: false });
    mocks.getServerEnv.mockReturnValue({ EMAIL_CREDENTIALS_ENCRYPTION_KEY: "55".repeat(32) });
    mocks.readJson.mockResolvedValue({ code: "123456" });
    mocks.verifyEmailAddress.mockResolvedValue({ verified: true });
  });

  it("verifies a code for the restricted session", async () => {
    const response = await POST(new Request("http://test.local", { method: "POST" }) as never);
    await expect(response.json()).resolves.toEqual({ verified: true });
    expect(mocks.verifyEmailAddress).toHaveBeenCalledWith(
      { id: "user-1", email: "student@example.test", emailVerified: false },
      { code: "123456" },
      "55".repeat(32)
    );
  });
});
