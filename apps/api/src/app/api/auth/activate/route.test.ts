import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  activatePendingAccount: vi.fn(),
  getServerEnv: vi.fn(),
  readJson: vi.fn()
}));

vi.mock("@cognelo/config", () => ({
  getServerEnv: mocks.getServerEnv
}));

vi.mock("@cognelo/core", () => ({
  activatePendingAccount: mocks.activatePendingAccount
}));

vi.mock("@/lib/http", () => ({
  authCookie: (token: string) => ({ name: "cognelo_session", value: token, path: "/" }),
  handleRoute: async (handler: () => Promise<Response>) => handler(),
  json: (data: unknown, init?: ResponseInit) => {
    const response = Response.json(data, init);
    return Object.assign(response, {
      cookies: {
        set: (cookie: { name: string; value: string }) => {
          response.headers.append("set-cookie", `${cookie.name}=${cookie.value}`);
        }
      }
    });
  },
  options: () => new Response(null, { status: 204 }),
  readJson: mocks.readJson
}));

const { POST } = await import("./route");

describe("account activation route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getServerEnv.mockReturnValue({ JWT_SECRET: "secret" });
    mocks.readJson.mockResolvedValue({ token: "activation-token", password: "Password123!", confirmPassword: "Password123!" });
    mocks.activatePendingAccount.mockResolvedValue({ user: { id: "user-1" }, token: "signed-token" });
  });

  it("activates the pending account and sets the auth cookie", async () => {
    const response = await POST(new Request("http://test.local") as never);

    await expect(response.json()).resolves.toEqual({ user: { id: "user-1" } });
    expect(response.headers.get("set-cookie")).toContain("cognelo_session=signed-token");
    expect(mocks.activatePendingAccount).toHaveBeenCalledWith(
      { token: "activation-token", password: "Password123!", confirmPassword: "Password123!" },
      "secret"
    );
  });
});
