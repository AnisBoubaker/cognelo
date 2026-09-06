import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ confirmUserEmail: vi.fn(), requireUser: vi.fn() }));
vi.mock("@cognelo/core", () => ({ confirmUserEmail: mocks.confirmUserEmail }));
vi.mock("@/lib/http", () => ({
  handleRoute: async (handler: () => Promise<Response>) => handler(),
  json: (data: unknown) => Response.json(data),
  options: () => new Response(null, { status: 204 }),
  requireUser: mocks.requireUser
}));

const { PUT } = await import("./route");

describe("administrator email confirmation route", () => {
  it("confirms the selected account without a verification code", async () => {
    const actor = { id: "admin-1", roles: ["admin"] };
    const confirmedUser = { id: "user-1", emailVerified: true };
    mocks.requireUser.mockResolvedValue(actor);
    mocks.confirmUserEmail.mockResolvedValue(confirmedUser);

    const response = await PUT(new Request("http://localhost/api/users/user-1/email-verification", { method: "PUT" }), {
      params: Promise.resolve({ userId: "user-1" })
    });

    await expect(response.json()).resolves.toEqual({ user: confirmedUser });
    expect(mocks.confirmUserEmail).toHaveBeenCalledWith(actor, "user-1");
  });
});
