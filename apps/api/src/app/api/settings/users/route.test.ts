import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ requireUser: vi.fn(), readJson: vi.fn(), getUserProfilePolicy: vi.fn(), updateUserProfilePolicy: vi.fn() }));
vi.mock("@cognelo/core", () => ({ getUserProfilePolicy: mocks.getUserProfilePolicy, updateUserProfilePolicy: mocks.updateUserProfilePolicy }));
vi.mock("@/lib/http", () => ({
  requireUser: mocks.requireUser, readJson: mocks.readJson,
  handleRoute: (handler: () => Promise<Response>) => handler(),
  json: (data: unknown) => Response.json(data), options: () => new Response(null, { status: 204 })
}));
const { GET, PUT } = await import("./route");

describe("user profile policy route", () => {
  beforeEach(() => { vi.resetAllMocks(); });
  it("requires authentication before reading the policy", async () => {
    mocks.requireUser.mockRejectedValue(new Error("unauthorized"));
    await expect(GET()).rejects.toThrow("unauthorized");
    expect(mocks.getUserProfilePolicy).not.toHaveBeenCalled();
  });
  it("returns the name policy to an authenticated learner", async () => {
    mocks.requireUser.mockResolvedValue({ id: "student", roles: ["student"] });
    mocks.getUserProfilePolicy.mockResolvedValue({ allowUserNameChanges: false });
    expect(await (await GET()).json()).toEqual({ allowUserNameChanges: false });
  });
  it("passes the authenticated actor and bounded body to the administrator-only mutation", async () => {
    const actor = { id: "admin", roles: ["admin"] }, input = { allowUserNameChanges: false };
    mocks.requireUser.mockResolvedValue(actor); mocks.readJson.mockResolvedValue(input);
    mocks.updateUserProfilePolicy.mockResolvedValue(input);
    expect(await (await PUT(new Request("http://localhost/api/settings/users") as never)).json()).toEqual(input);
    expect(mocks.updateUserProfilePolicy).toHaveBeenCalledWith(actor, input);
  });
});
