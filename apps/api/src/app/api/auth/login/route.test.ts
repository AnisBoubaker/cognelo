import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getServerEnv: vi.fn(),
  loginWithPassword: vi.fn(),
  readJson: vi.fn()
}));

vi.mock("@cognelo/config", () => ({
  getServerEnv: mocks.getServerEnv
}));

vi.mock("@cognelo/core", () => ({
  loginWithPassword: mocks.loginWithPassword
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

describe("login route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getServerEnv.mockReturnValue({ JWT_SECRET: "secret" });
    mocks.readJson.mockResolvedValue({ email: "teacher@example.test", password: "Password123!" });
    mocks.loginWithPassword.mockResolvedValue({ user: { id: "user-1" }, token: "signed-token" });
  });

  it("validates credentials, logs in, and sets the auth cookie", async () => {
    const response = await POST(new Request("http://test.local") as never);

    await expect(response.json()).resolves.toEqual({ user: { id: "user-1" } });
    expect(response.headers.get("set-cookie")).toContain("cognelo_session=signed-token");
    expect(mocks.loginWithPassword).toHaveBeenCalledWith("teacher@example.test", "Password123!", "secret");
  });
});
