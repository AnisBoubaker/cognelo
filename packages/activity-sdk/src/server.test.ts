import { describe, expect, it, vi } from "vitest";
import { listPluginRoutes, resolvePluginRoute, runBankActivityDeletedHooks } from "./server";

describe("server activity SDK", () => {
  it("resolves plugin routes by normalized path and activity type", () => {
    expect(resolvePluginRoute("coding-exercise", ["coding-exercises", "run"])?.path).toBe("coding-exercises/run");
    expect(resolvePluginRoute("mcq", ["coding-exercises", "run"])).toBeNull();
  });

  it("lists registered plugin routes for API dispatch introspection", () => {
    const routes = listPluginRoutes();
    expect(routes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          pluginKey: "coding-exercises",
          path: "coding-exercises/run"
        })
      ])
    );
  });

  it("runs bank deletion hooks without requiring every plugin to implement one", async () => {
    await expect(
      runBankActivityDeletedHooks({
        user: {
          id: "user-1",
          email: "teacher@example.test",
          name: null,
          firstName: null,
          lastName: null,
          roles: ["teacher"]
        },
        activityBankId: "bank-1",
        bankActivityId: "bank-activity-1",
        activityTypeKey: "placeholder"
      })
    ).resolves.toBeUndefined();
  });

});
