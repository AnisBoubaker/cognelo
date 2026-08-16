import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getActivityBank: vi.fn(),
  deleteActivityBank: vi.fn(),
  runBankActivityDeletedHooks: vi.fn(),
  readJson: vi.fn(),
  requireUser: vi.fn(),
  updateActivityBank: vi.fn()
}));

vi.mock("@cognelo/core", () => ({
  deleteActivityBank: mocks.deleteActivityBank,
  getActivityBank: mocks.getActivityBank,
  updateActivityBank: mocks.updateActivityBank
}));

vi.mock("@cognelo/activity-sdk/server", () => ({ runBankActivityDeletedHooks: mocks.runBankActivityDeletedHooks }));

vi.mock("@/lib/http", () => ({
  handleRoute: async (handler: () => Promise<Response>) => handler(),
  json: (data: unknown, init?: ResponseInit) => Response.json(data, init),
  options: () => new Response(null, { status: 204 }),
  readJson: mocks.readJson,
  requireUser: mocks.requireUser
}));

const { DELETE, GET, PATCH } = await import("./route");

describe("activity bank detail route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireUser.mockResolvedValue({ id: "teacher-1", roles: ["teacher"] });
    mocks.getActivityBank.mockResolvedValue({ id: "bank-1", title: "Programming" });
    mocks.readJson.mockResolvedValue({ title: "Programming updated" });
    mocks.updateActivityBank.mockResolvedValue({ id: "bank-1", title: "Programming updated" });
    mocks.deleteActivityBank.mockResolvedValue({ activityCount: 1, deletedActivities: [{ bankActivityId: "activity-1", activityTypeKey: "mcq" }] });
  });

  it("deletes a bank and runs cleanup hooks for deleted activity contents", async () => {
    mocks.readJson.mockResolvedValue({ action: "delete", force: true });
    const response = await DELETE(new Request("http://test.local", { method: "DELETE" }) as never, {
      params: Promise.resolve({ activityBankId: "bank-1" })
    });

    await expect(response.json()).resolves.toEqual({ ok: true, activityCount: 1 });
    expect(mocks.deleteActivityBank).toHaveBeenCalledWith({ id: "teacher-1", roles: ["teacher"] }, "bank-1", { action: "delete", force: true });
    expect(mocks.runBankActivityDeletedHooks).toHaveBeenCalledWith({
      user: { id: "teacher-1", roles: ["teacher"] },
      activityBankId: "bank-1",
      bankActivityId: "activity-1",
      activityTypeKey: "mcq"
    });
  });

  it("returns one activity bank", async () => {
    const response = await GET(new Request("http://test.local") as never, {
      params: Promise.resolve({ activityBankId: "bank-1" })
    });

    await expect(response.json()).resolves.toEqual({ activityBank: { id: "bank-1", title: "Programming" } });
    expect(mocks.getActivityBank).toHaveBeenCalledWith({ id: "teacher-1", roles: ["teacher"] }, "bank-1");
  });

  it("updates one activity bank", async () => {
    const response = await PATCH(new Request("http://test.local") as never, {
      params: Promise.resolve({ activityBankId: "bank-1" })
    });

    await expect(response.json()).resolves.toEqual({ activityBank: { id: "bank-1", title: "Programming updated" } });
    expect(mocks.updateActivityBank).toHaveBeenCalledWith({ id: "teacher-1", roles: ["teacher"] }, "bank-1", {
      title: "Programming updated"
    });
  });
});
