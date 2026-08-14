import { beforeEach, describe, expect, it, vi } from "vitest";

const routeHandler = vi.hoisted(() => vi.fn());

const mocks = vi.hoisted(() => ({
  assertActivityTypePluginEnabled: vi.fn(),
  assertCanManageActivityBank: vi.fn(),
  getActivityBank: vi.fn(),
  requireUser: vi.fn(),
  resolvePluginRoute: vi.fn()
}));

vi.mock("@cognelo/core", () => ({
  AppError: class AppError extends Error {
    constructor(
      public status: number,
      public code: string,
      message: string,
      public details?: unknown
    ) {
      super(message);
    }
  },
  assertActivityTypePluginEnabled: mocks.assertActivityTypePluginEnabled,
  assertCanManageActivityBank: mocks.assertCanManageActivityBank,
  getActivityBank: mocks.getActivityBank
}));

vi.mock("@cognelo/activity-sdk/server", () => ({
  resolvePluginRoute: mocks.resolvePluginRoute
}));

vi.mock("@/lib/http", () => ({
  handleRoute: async (handler: () => Promise<Response>) => handler(),
  json: (data: unknown, init?: ResponseInit) => Response.json(data, init),
  options: () => new Response(null, { status: 204 }),
  requireUser: mocks.requireUser
}));

const { PATCH, POST } = await import("./route");

describe("bank activity plugin dispatch route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireUser.mockResolvedValue({ id: "user-1", roles: ["teacher"] });
    mocks.getActivityBank.mockResolvedValue({
      id: "bank-1",
      activities: [
        {
          id: "bank-activity-1",
          title: "Activity",
          description: "",
          lifecycle: "draft",
          config: { prompt: "Solve it" },
          metadata: {},
          activityType: { key: "coding-exercise", name: "Coding exercise", description: "" }
        }
      ]
    });
    routeHandler.mockResolvedValue({ ok: true });
    mocks.resolvePluginRoute.mockReturnValue({ methods: { POST: routeHandler } });
  });

  it("dispatches supported plugin methods with bank activity context", async () => {
    const response = await POST(new Request("http://test.local", { method: "POST", body: "{}" }) as never, {
      params: Promise.resolve({ activityBankId: "bank-1", bankActivityId: "bank-activity-1", pluginPath: ["tests"] })
    });

    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(mocks.getActivityBank).toHaveBeenCalledWith({ id: "user-1", roles: ["teacher"] }, "bank-1");
    expect(mocks.assertActivityTypePluginEnabled).toHaveBeenCalledWith("coding-exercise");
    expect(routeHandler).toHaveBeenCalledWith(
      expect.objectContaining({
        context: expect.objectContaining({
          activityBankId: "bank-1",
          activityId: "bank-activity-1",
          activity: expect.objectContaining({ id: "bank-activity-1" })
        })
      })
    );
  });

  it("rejects missing bank activities before dispatching to plugins", async () => {
    mocks.getActivityBank.mockResolvedValue({ id: "bank-1", activities: [] });

    await expect(
      PATCH(new Request("http://test.local", { method: "PATCH" }) as never, {
        params: Promise.resolve({ activityBankId: "bank-1", bankActivityId: "missing", pluginPath: ["tests"] })
      })
    ).rejects.toMatchObject({ status: 404, code: "BANK_ACTIVITY_NOT_FOUND" });

    expect(mocks.resolvePluginRoute).not.toHaveBeenCalled();
  });

  it("fails before loading private plugin data when the user cannot manage the bank", async () => {
    mocks.assertCanManageActivityBank.mockRejectedValueOnce(new Error("forbidden"));
    await expect(
      POST(new Request("http://test.local", { method: "POST" }) as never, {
        params: Promise.resolve({ activityBankId: "bank-1", bankActivityId: "bank-activity-1", pluginPath: ["fake", "run"] })
      })
    ).rejects.toThrow("forbidden");
    expect(mocks.getActivityBank).not.toHaveBeenCalled();
    expect(mocks.resolvePluginRoute).not.toHaveBeenCalled();
  });
});
