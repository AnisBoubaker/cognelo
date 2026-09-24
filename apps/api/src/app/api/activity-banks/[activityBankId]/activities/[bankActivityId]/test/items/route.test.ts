import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  discard: vi.fn(),
  duplicateHook: vi.fn(),
  deleteHook: vi.fn(),
  readJson: vi.fn(),
  requireUser: vi.fn()
}));

vi.mock("@cognelo/core", () => ({
  createBankTestItem: mocks.create,
  discardBankTestItem: mocks.discard
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

describe("create reusable bank Test item route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireUser.mockResolvedValue({ id: "teacher-1", roles: ["teacher"] });
    mocks.readJson.mockResolvedValue({ source: "bank", bankActivityId: "source-1" });
    mocks.create.mockResolvedValue({
      sourceBankActivityId: "source-1",
      item: { id: "item-1" },
      activity: { id: "owned-child-1", activityType: { key: "coding-exercise" } }
    });
    mocks.duplicateHook.mockResolvedValue(undefined);
    mocks.deleteHook.mockResolvedValue(undefined);
    mocks.discard.mockResolvedValue({ bankActivityId: "owned-child-1", activityTypeKey: "coding-exercise" });
  });

  it("copies plugin-private bank data into the Test-owned child", async () => {
    const response = await POST(new Request("http://test.local", { method: "POST", body: "{}" }) as never, {
      params: Promise.resolve({ activityBankId: "bank-1", bankActivityId: "test-shell-1" })
    });

    expect(response.status).toBe(201);
    expect(mocks.duplicateHook).toHaveBeenCalledWith({
      user: { id: "teacher-1", roles: ["teacher"] },
      activityBankId: "bank-1",
      sourceBankActivityId: "source-1",
      bankActivityId: "owned-child-1",
      activityTypeKey: "coding-exercise"
    });
  });

  it("discards the new child and cleans private data when copying fails", async () => {
    mocks.duplicateHook.mockRejectedValue(new Error("private copy failed"));

    await expect(POST(new Request("http://test.local", { method: "POST", body: "{}" }) as never, {
      params: Promise.resolve({ activityBankId: "bank-1", bankActivityId: "test-shell-1" })
    })).rejects.toThrow("private copy failed");

    expect(mocks.discard).toHaveBeenCalledWith(expect.anything(), "bank-1", "test-shell-1", "item-1");
    expect(mocks.deleteHook).toHaveBeenCalledWith(expect.objectContaining({ bankActivityId: "owned-child-1" }));
  });
});
