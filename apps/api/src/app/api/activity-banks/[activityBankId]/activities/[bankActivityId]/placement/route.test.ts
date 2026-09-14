import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  readJson: vi.fn(),
  requireUser: vi.fn(),
  updateBankActivityPlacement: vi.fn()
}));

vi.mock("@cognelo/core", () => ({ updateBankActivityPlacement: mocks.updateBankActivityPlacement }));
vi.mock("@/lib/http", () => ({
  handleRoute: async (handler: () => Promise<Response>) => handler(),
  json: (data: unknown, init?: ResponseInit) => Response.json(data, init),
  options: () => new Response(null, { status: 204 }),
  readJson: mocks.readJson,
  requireUser: mocks.requireUser
}));

const { PATCH } = await import("./route");

describe("bank activity placement route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireUser.mockResolvedValue({ id: "teacher-1", roles: ["teacher"] });
    mocks.readJson.mockResolvedValue({ folderId: "folder-1", position: 3 });
    mocks.updateBankActivityPlacement.mockResolvedValue({ id: "activity-1", folderId: "folder-1", position: 3 });
  });

  it("moves an activity within its bank tree", async () => {
    const response = await PATCH(new Request("http://test.local", { method: "PATCH" }) as never, {
      params: Promise.resolve({ activityBankId: "bank-1", bankActivityId: "activity-1" })
    });
    await expect(response.json()).resolves.toEqual({ activity: { id: "activity-1", folderId: "folder-1", position: 3 } });
    expect(mocks.updateBankActivityPlacement).toHaveBeenCalledWith(
      { id: "teacher-1", roles: ["teacher"] },
      "bank-1",
      "activity-1",
      { folderId: "folder-1", position: 3 }
    );
  });
});
