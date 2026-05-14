import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  deleteBankActivity: vi.fn(),
  readJson: vi.fn(),
  requireUser: vi.fn(),
  runBankActivityDeletedHooks: vi.fn(),
  updateBankActivity: vi.fn()
}));

vi.mock("@cognelo/core", () => ({
  deleteBankActivity: mocks.deleteBankActivity,
  updateBankActivity: mocks.updateBankActivity
}));

vi.mock("@cognelo/activity-sdk/server", () => ({
  runBankActivityDeletedHooks: mocks.runBankActivityDeletedHooks
}));

vi.mock("@/lib/http", () => ({
  handleRoute: async (handler: () => Promise<Response>) => handler(),
  json: (data: unknown, init?: ResponseInit) => Response.json(data, init),
  options: () => new Response(null, { status: 204 }),
  readJson: mocks.readJson,
  requireUser: mocks.requireUser
}));

const { DELETE } = await import("./route");

describe("bank activity DELETE route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireUser.mockResolvedValue({ id: "user-1", roles: ["admin"] });
    mocks.readJson.mockResolvedValue({ force: true });
    mocks.deleteBankActivity.mockResolvedValue({
      bankActivityId: "bank-activity-1",
      activityTypeKey: "coding-exercise",
      courseCount: 3
    });
  });

  it("deletes the bank activity and runs plugin cleanup hooks", async () => {
    const response = await DELETE(new Request("http://test.local") as never, {
      params: Promise.resolve({ activityBankId: "bank-1", bankActivityId: "bank-activity-1" })
    });

    await expect(response.json()).resolves.toEqual({ ok: true, courseCount: 3 });
    expect(mocks.deleteBankActivity).toHaveBeenCalledWith(
      { id: "user-1", roles: ["admin"] },
      "bank-1",
      "bank-activity-1",
      { force: true }
    );
    expect(mocks.runBankActivityDeletedHooks).toHaveBeenCalledWith({
      user: { id: "user-1", roles: ["admin"] },
      activityBankId: "bank-1",
      bankActivityId: "bank-activity-1",
      activityTypeKey: "coding-exercise"
    });
  });

  it("propagates plugin cleanup failures after core deletion succeeds", async () => {
    mocks.runBankActivityDeletedHooks.mockRejectedValue(new Error("cleanup failed"));

    await expect(
      DELETE(new Request("http://test.local") as never, {
        params: Promise.resolve({ activityBankId: "bank-1", bankActivityId: "bank-activity-1" })
      })
    ).rejects.toThrow("cleanup failed");

    expect(mocks.deleteBankActivity).toHaveBeenCalled();
    expect(mocks.runBankActivityDeletedHooks).toHaveBeenCalled();
  });
});
