import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getMe: vi.fn(),
  readJson: vi.fn(),
  requireUser: vi.fn(),
  updateMyProfile: vi.fn()
}));

vi.mock("@cognelo/core", () => ({
  getMe: mocks.getMe,
  updateMyProfile: mocks.updateMyProfile
}));

vi.mock("@/lib/http", () => ({
  handleRoute: async (handler: () => Promise<Response>) => handler(),
  json: (data: unknown, init?: ResponseInit) => Response.json(data, init),
  options: () => new Response(null, { status: 204 }),
  readJson: mocks.readJson,
  requireUser: mocks.requireUser
}));

const { GET, PATCH } = await import("./route");

describe("users/me route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireUser.mockResolvedValue({ id: "user-1", roles: ["teacher"] });
    mocks.getMe.mockResolvedValue({ id: "user-1", email: "teacher@example.test" });
    mocks.readJson.mockResolvedValue({ firstName: "Ada", lastName: "Lovelace" });
    mocks.updateMyProfile.mockResolvedValue({ id: "user-1", firstName: "Ada", lastName: "Lovelace" });
  });

  it("returns the current user profile", async () => {
    const response = await GET();

    await expect(response.json()).resolves.toEqual({ user: { id: "user-1", email: "teacher@example.test" } });
    expect(mocks.requireUser).toHaveBeenCalledWith({ allowPasswordChangeRequired: true });
    expect(mocks.getMe).toHaveBeenCalledWith({ id: "user-1", roles: ["teacher"] });
  });

  it("updates the current user profile", async () => {
    const response = await PATCH(new Request("http://test.local") as never);

    await expect(response.json()).resolves.toEqual({ user: { id: "user-1", firstName: "Ada", lastName: "Lovelace" } });
    expect(mocks.updateMyProfile).toHaveBeenCalledWith({ id: "user-1", roles: ["teacher"] }, { firstName: "Ada", lastName: "Lovelace" });
  });
});
