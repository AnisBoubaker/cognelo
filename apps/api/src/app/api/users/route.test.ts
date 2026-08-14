import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ createUser: vi.fn(), listRoles: vi.fn(), listUsers: vi.fn(), readJson: vi.fn(), requireUser: vi.fn() }));
vi.mock("@cognelo/core", () => ({ createUser: mocks.createUser, listRoles: mocks.listRoles, listUsers: mocks.listUsers }));
vi.mock("@/lib/http", () => ({ handleRoute: async (handler: () => Promise<Response>) => handler(), json: (data: unknown, init?: ResponseInit) => Response.json(data, init), options: () => new Response(null, { status: 204 }), readJson: mocks.readJson, requireUser: mocks.requireUser }));
const { GET, POST } = await import("./route");

describe("admin users route", () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.requireUser.mockResolvedValue({ id: "admin-1", roles: ["admin"] }); });
  it("lists filtered users and available roles", async () => {
    mocks.listUsers.mockResolvedValue({ users: [{ id: "user-1" }], pagination: { page: 1, pageSize: 10, total: 1, totalPages: 1 } }); mocks.listRoles.mockResolvedValue([{ key: "teacher" }]);
    const response = await GET({ nextUrl: new URL("http://localhost/api/users?role=teacher&firstName=ada") } as never);
    await expect(response.json()).resolves.toEqual({ users: [{ id: "user-1" }], roles: [{ key: "teacher" }], pagination: { page: 1, pageSize: 10, total: 1, totalPages: 1 } });
    expect(mocks.listUsers).toHaveBeenCalledWith({ id: "admin-1", roles: ["admin"] }, { role: "teacher", firstName: "ada" });
  });
  it("creates a user", async () => {
    const input = { email: "new@example.test" }; mocks.readJson.mockResolvedValue(input); mocks.createUser.mockResolvedValue({ id: "user-2" });
    const response = await POST(new Request("http://localhost/api/users", { method: "POST" }) as never);
    expect(response.status).toBe(201); expect(mocks.createUser).toHaveBeenCalledWith({ id: "admin-1", roles: ["admin"] }, input);
  });
});
