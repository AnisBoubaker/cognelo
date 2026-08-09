import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  changeMyPassword: vi.fn(),
  readJson: vi.fn(),
  requireUser: vi.fn()
}));

vi.mock("@cognelo/core", () => ({
  changeMyPassword: mocks.changeMyPassword
}));

vi.mock("@/lib/http", () => ({
  handleRoute: async (handler: () => Promise<Response>) => handler(),
  json: (data: unknown, init?: ResponseInit) => Response.json(data, init),
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
