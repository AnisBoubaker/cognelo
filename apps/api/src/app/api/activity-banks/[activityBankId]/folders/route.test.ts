import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createActivityBankFolder: vi.fn(),
  readJson: vi.fn(),
  requireUser: vi.fn()
}));

vi.mock("@cognelo/core", () => ({ createActivityBankFolder: mocks.createActivityBankFolder }));
vi.mock("@/lib/http", () => ({
  handleRoute: async (handler: () => Promise<Response>) => handler(),
  json: (data: unknown, init?: ResponseInit) => Response.json(data, init),
  options: () => new Response(null, { status: 204 }),
  readJson: mocks.readJson,
  requireUser: mocks.requireUser
}));

const { POST } = await import("./route");

describe("activity bank folder collection route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireUser.mockResolvedValue({ id: "teacher-1", roles: ["teacher"] });
    mocks.readJson.mockResolvedValue({ title: "Week 1", parentId: null });
    mocks.createActivityBankFolder.mockResolvedValue({ id: "folder-1", title: "Week 1" });
  });

  it("creates a folder in an activity bank", async () => {
    const response = await POST(new Request("http://test.local", { method: "POST" }) as never, {
      params: Promise.resolve({ activityBankId: "bank-1" })
    });
    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({ folder: { id: "folder-1", title: "Week 1" } });
    expect(mocks.createActivityBankFolder).toHaveBeenCalledWith(
      { id: "teacher-1", roles: ["teacher"] },
      "bank-1",
      { title: "Week 1", parentId: null }
    );
  });
});
