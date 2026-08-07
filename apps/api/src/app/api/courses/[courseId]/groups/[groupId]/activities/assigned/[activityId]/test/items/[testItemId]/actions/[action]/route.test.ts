import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  assertActivityTypePluginEnabled: vi.fn(),
  getTestItemExecutionContext: vi.fn(),
  handler: vi.fn(),
  readJson: vi.fn(),
  requireUser: vi.fn()
}));

vi.mock("@cognelo/activity-sdk/server", () => ({ resolveCompositeExecutionActionHandler: () => mocks.handler }));
vi.mock("@cognelo/core", () => ({
  AppError: class AppError extends Error {},
  assertActivityTypePluginEnabled: mocks.assertActivityTypePluginEnabled,
  getTestItemExecutionContext: mocks.getTestItemExecutionContext
}));
vi.mock("@/lib/http", () => ({
  handleRoute: async (handler: () => Promise<Response>) => handler(),
  json: (data: unknown, init?: ResponseInit) => Response.json(data, init),
  options: () => new Response(null, { status: 204 }),
  readJson: mocks.readJson,
  requireUser: mocks.requireUser
}));

const { POST } = await import("./route");

describe("Test item action route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireUser.mockResolvedValue({ id: "student-1", roles: ["student"] });
    mocks.readJson.mockResolvedValue({ parentAttemptId: "attempt-1", sessionId: "session-1", payload: { sourceCode: "print(1)" } });
    mocks.getTestItemExecutionContext.mockResolvedValue({
      item: {
        activity: {
          id: "coding-1",
          title: "Code",
          description: "",
          lifecycle: "published",
          config: {},
          metadata: {},
          activityType: { key: "coding-exercise", name: "Coding exercise", description: "" }
        }
      }
    });
    mocks.handler.mockResolvedValue({ execution: { id: "run-1" } });
  });

  it("dispatches only a registered composite action in the active Test session", async () => {
    const response = await POST(new Request("http://test.local", { method: "POST" }) as never, {
      params: Promise.resolve({
        courseId: "course-1",
        groupId: "group-1",
        activityId: "test-1",
        testItemId: "item-1",
        action: "run"
      })
    });

    expect(mocks.getTestItemExecutionContext).toHaveBeenCalledWith(
      { id: "student-1", roles: ["student"] },
      "course-1",
      "group-1",
      "test-1",
      "attempt-1",
      "item-1",
      { sessionId: "session-1" }
    );
    expect(mocks.handler).toHaveBeenCalledWith(expect.objectContaining({
      parentAttemptId: "attempt-1",
      testItemId: "item-1",
      payload: { sourceCode: "print(1)" }
    }));
    await expect(response.json()).resolves.toEqual({ execution: { id: "run-1" } });
  });
});
