import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  changeMyPassword: vi.fn(),
  readJson: vi.fn(),
  requireUser: vi.fn()
}));

vi.mock("@cognelo/config", () => ({ getServerEnv: () => ({ JWT_SECRET: "test-secret" }) }));
vi.mock("@cognelo/core", () => ({
  consumeRateLimits: vi.fn(), clearRateLimit: vi.fn(),
  loginWithPassword: vi.fn().mockResolvedValue({ token: "renewed" }),
  changeMyPassword: mocks.changeMyPassword
}));

vi.mock("@/lib/http", () => ({
  authCookie: (token: string) => ({ name: "cognelo_session", value: token }),
  handleRoute: async (handler: () => Promise<Response>) => handler(),
  json: (data: unknown, init?: ResponseInit) => { const response = Response.json(data, init); return Object.assign(response, { cookies: { set: (cookie: { name: string; value: string }) => response.headers.append("set-cookie", `${cookie.name}=${cookie.value}`) } }); },
  options: () => new Response(null, { status: 204 }),
  readJson: mocks.readJson,
  requireUser: mocks.requireUser
}));

const { PUT } = await import("./route");

describe("users/me/password route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireUser.mockResolvedValue({ id: "user-1", roles: ["teacher"] });
    mocks.readJson.mockResolvedValue({
      currentPassword: "OldPassword123!",
      newPassword: "NewPassword456!",
      confirmNewPassword: "NewPassword456!"
    });
    mocks.changeMyPassword.mockResolvedValue({ ok: true });
  });

  it("changes the authenticated user's password", async () => {
    const response = await PUT(new Request("http://test.local") as never);

    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(mocks.requireUser).toHaveBeenCalledWith({
      allowPasswordChangeRequired: true,
      allowEmailVerificationRequired: true
    });
    expect(mocks.changeMyPassword).toHaveBeenCalledWith(
      { id: "user-1", roles: ["teacher"] },
      {
        currentPassword: "OldPassword123!",
        newPassword: "NewPassword456!",
        confirmNewPassword: "NewPassword456!"
      }
    );
  });
});
