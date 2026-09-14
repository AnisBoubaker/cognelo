import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  deleteActivityBankFolder: vi.fn(),
  readJson: vi.fn(),
  requireUser: vi.fn(),
  updateActivityBankFolder: vi.fn()
}));

vi.mock("@cognelo/core", () => ({
  deleteActivityBankFolder: mocks.deleteActivityBankFolder,
  updateActivityBankFolder: mocks.updateActivityBankFolder
}));
vi.mock("@/lib/http", () => ({
  handleRoute: async (handler: () => Promise<Response>) => handler(),
  json: (data: unknown, init?: ResponseInit) => Response.json(data, init),
  options: () => new Response(null, { status: 204 }),
  readJson: mocks.readJson,
  requireUser: mocks.requireUser
}));

const { DELETE, PATCH } = await import("./route");

describe("activity bank folder detail route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireUser.mockResolvedValue({ id: "teacher-1", roles: ["teacher"] });
    mocks.readJson.mockResolvedValue({ title: "Renamed" });
    mocks.updateActivityBankFolder.mockResolvedValue({ id: "folder-1", title: "Renamed" });
    mocks.deleteActivityBankFolder.mockResolvedValue({ activityCount: 2 });
  });

  it("updates a folder", async () => {
    const response = await PATCH(new Request("http://test.local", { method: "PATCH" }) as never, {
      params: Promise.resolve({ activityBankId: "bank-1", folderId: "folder-1" })
    });
    await expect(response.json()).resolves.toEqual({ folder: { id: "folder-1", title: "Renamed" } });
    expect(mocks.updateActivityBankFolder).toHaveBeenCalledWith(
      { id: "teacher-1", roles: ["teacher"] }, "bank-1", "folder-1", { title: "Renamed" }
    );
  });

  it("deletes a folder while reporting how many activities were moved to root", async () => {
    const response = await DELETE(new Request("http://test.local", { method: "DELETE" }) as never, {
      params: Promise.resolve({ activityBankId: "bank-1", folderId: "folder-1" })
    });
    await expect(response.json()).resolves.toEqual({ ok: true, activityCount: 2 });
  });
});
