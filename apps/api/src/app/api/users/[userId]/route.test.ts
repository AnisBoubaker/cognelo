import { describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ updateUser: vi.fn(), readJson: vi.fn(), requireUser: vi.fn() }));
vi.mock("@cognelo/core", () => ({ updateUser: mocks.updateUser }));
vi.mock("@/lib/http", () => ({ handleRoute: async (handler: () => Promise<Response>) => handler(), json: (data: unknown) => Response.json(data), options: () => new Response(null, { status: 204 }), readJson: mocks.readJson, requireUser: mocks.requireUser }));
const { PATCH } = await import("./route");
describe("admin user detail route", () => {
  it("updates the selected user", async () => {
    const actor = { id: "admin-1", roles: ["admin"] }; const input = { roles: ["teacher"] }; mocks.requireUser.mockResolvedValue(actor); mocks.readJson.mockResolvedValue(input); mocks.updateUser.mockResolvedValue({ id: "user-1" });
    const response = await PATCH(new Request("http://localhost/api/users/user-1", { method: "PATCH" }) as never, { params: Promise.resolve({ userId: "user-1" }) });
    await expect(response.json()).resolves.toEqual({ user: { id: "user-1" } }); expect(mocks.updateUser).toHaveBeenCalledWith(actor, "user-1", input);
  });
});
