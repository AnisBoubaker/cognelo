import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findTest: vi.fn(),
  duplicateTest: vi.fn(),
  duplicateActivity: vi.fn(),
  deleteActivity: vi.fn(),
  duplicateHook: vi.fn(),
  deleteHook: vi.fn(),
  readJson: vi.fn(),
  requireUser: vi.fn()
}));

vi.mock("@cognelo/core", () => ({
  findBankTestByShellActivityId: mocks.findTest,
  duplicateBankTest: mocks.duplicateTest,
  duplicateBankActivity: mocks.duplicateActivity,
  deleteBankActivity: mocks.deleteActivity
}));
vi.mock("@cognelo/activity-sdk/server", () => ({
  runBankActivityDuplicatedHooks: mocks.duplicateHook,
  runBankActivityDeletedHooks: mocks.deleteHook
}));
vi.mock("@/lib/http", () => ({
  handleRoute: async (handler: () => Promise<Response>) => handler(),
  json: (data: unknown, init?: ResponseInit) => Response.json(data, init),
  options: () => new Response(null, { status: 204 }),
  readJson: mocks.readJson,
  requireUser: mocks.requireUser
}));

const { POST } = await import("./route");

describe("duplicate reusable bank Test route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireUser.mockResolvedValue({ id: "teacher-1", roles: ["teacher"] });
    mocks.readJson.mockResolvedValue({ title: "Reusable Test copy" });
    mocks.findTest.mockResolvedValue({ id: "bank-test-1" });
    mocks.duplicateTest.mockResolvedValue({
      test: { bankActivityId: "copy-shell-1", activity: { id: "copy-shell-1" } },
      activityCopies: [{
        sourceBankActivityId: "source-child-1",
        bankActivity: { id: "copy-child-1", activityType: { key: "coding-exercise" } }
      }]
    });
    mocks.duplicateHook.mockResolvedValue(undefined);
    mocks.deleteHook.mockResolvedValue(undefined);
    mocks.deleteActivity.mockResolvedValue({
      deletedActivities: [{ bankActivityId: "copy-child-1", activityTypeKey: "coding-exercise" }]
    });
  });

  it("duplicates private data for each independently owned child", async () => {
    const response = await POST(new Request("http://test.local", { method: "POST", body: "{}" }) as never, {
      params: Promise.resolve({ activityBankId: "bank-1", bankActivityId: "test-shell-1" })
    });

    expect(response.status).toBe(201);
    expect(mocks.duplicateHook).toHaveBeenCalledWith(expect.objectContaining({
      sourceBankActivityId: "source-child-1",
      bankActivityId: "copy-child-1",
      activityTypeKey: "coding-exercise"
    }));
  });

  it("removes the copied graph if a child private-data hook fails", async () => {
    mocks.duplicateHook.mockRejectedValue(new Error("private copy failed"));

    await expect(POST(new Request("http://test.local", { method: "POST", body: "{}" }) as never, {
      params: Promise.resolve({ activityBankId: "bank-1", bankActivityId: "test-shell-1" })
    })).rejects.toThrow("private copy failed");

    expect(mocks.deleteActivity).toHaveBeenCalledWith(expect.anything(), "bank-1", "copy-shell-1", { force: true });
    expect(mocks.deleteHook).toHaveBeenCalledWith(expect.objectContaining({ bankActivityId: "copy-child-1" }));
  });
});
