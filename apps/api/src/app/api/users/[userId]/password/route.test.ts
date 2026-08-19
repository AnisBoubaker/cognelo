import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ resetUserPassword: vi.fn(), readJson: vi.fn(), requireUser: vi.fn() }));
vi.mock("@cognelo/core", () => ({ resetUserPassword: mocks.resetUserPassword }));
vi.mock("@/lib/http", () => ({
  handleRoute: async (handler: () => Promise<Response>) => handler(),
  json: (data: unknown) => Response.json(data),
  options: () => new Response(null, { status: 204 }),
  readJson: mocks.readJson,
  requireUser: mocks.requireUser
}));

const { PUT } = await import("./route");

describe("administrator user password route", () => {
  it("sets a temporary password for the selected user", async () => {
    const actor = { id: "admin-1", roles: ["admin"] };
    const input = { password: "Temporary123!", confirmPassword: "Temporary123!" };
    mocks.requireUser.mockResolvedValue(actor);
    mocks.readJson.mockResolvedValue(input);
    mocks.resetUserPassword.mockResolvedValue({ ok: true });

    const response = await PUT(new Request("http://localhost/api/users/user-1/password", { method: "PUT" }) as never, {
      params: Promise.resolve({ userId: "user-1" })
    });

    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(mocks.resetUserPassword).toHaveBeenCalledWith(actor, "user-1", input);
  });
});
