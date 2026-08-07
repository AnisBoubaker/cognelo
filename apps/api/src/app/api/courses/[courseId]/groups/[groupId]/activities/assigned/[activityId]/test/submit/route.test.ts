import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  assertActivityTypePluginEnabled: vi.fn(),
  getTestItemExecutionContext: vi.fn(),
  getTestRuntime: vi.fn(),
  handler: vi.fn(),
  readJson: vi.fn(),
  requireUser: vi.fn(),
  submitTestAttempt: vi.fn(),
  submitTestItemAttemptResult: vi.fn()
}));

vi.mock("@cognelo/activity-sdk/server", () => ({
  resolveCompositeExecutionSubmissionHandler: () => mocks.handler
}));

vi.mock("@cognelo/core", () => ({
  AppError: class AppError extends Error {},
  assertActivityTypePluginEnabled: mocks.assertActivityTypePluginEnabled,
  getTestItemExecutionContext: mocks.getTestItemExecutionContext,
  getTestRuntime: mocks.getTestRuntime,
  submitTestAttempt: mocks.submitTestAttempt,
  submitTestItemAttemptResult: mocks.submitTestItemAttemptResult
}));

vi.mock("@/lib/http", () => ({
  handleRoute: async (handler: () => Promise<Response>) => handler(),
  json: (data: unknown, init?: ResponseInit) => Response.json(data, init),
  options: () => new Response(null, { status: 204 }),
  readJson: mocks.readJson,
  requireUser: mocks.requireUser
}));

const { POST } = await import("./route");

describe("whole Test submission route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireUser.mockResolvedValue({ id: "student-1", roles: ["student"] });
    mocks.readJson.mockResolvedValue({ parentAttemptId: "parent-attempt-1" });
    mocks.getTestRuntime.mockResolvedValue({
      attempt: { id: "parent-attempt-1", lifecycle: "started" },
      test: {
        items: [
          { id: "item-1", itemAttempt: { lifecycle: "started", state: { answers: { "question-1": ["choice-1"] } } } },
          { id: "item-2", itemAttempt: null }
        ]
      }
    });
    mocks.getTestItemExecutionContext.mockImplementation(async (_user, _courseId, _groupId, _activityId, _attemptId, testItemId) => ({
      item: {
        activity: {
          id: `activity-${testItemId}`,
          bankActivityId: null,
          activityVersionId: null,
          title: `Activity ${testItemId}`,
          description: "",
          lifecycle: "published",
          config: {},
          metadata: {},
          activityType: { key: "mcq", name: "MCQ", description: "" }
        }
      }
    }));
    mocks.handler.mockImplementation(async ({ payload }) => ({
      state: payload,
      gradingResult: { rawScore: 1, rawMaxScore: 1 }
    }));
    mocks.submitTestItemAttemptResult.mockResolvedValue({ id: "item-attempt" });
    mocks.submitTestAttempt.mockResolvedValue({ attempt: { id: "parent-attempt-1", lifecycle: "submitted" } });
  });

  it("submits every saved or unanswered child before finalizing the parent Test", async () => {
    const response = await POST(new Request("http://test.local", { method: "POST" }) as never, {
      params: Promise.resolve({ courseId: "course-1", groupId: "group-1", activityId: "test-activity-1" })
    });

    expect(mocks.handler).toHaveBeenCalledTimes(2);
    expect(mocks.handler).toHaveBeenNthCalledWith(1, expect.objectContaining({
      testItemId: "item-1",
      payload: { answers: { "question-1": ["choice-1"] } }
    }));
    expect(mocks.handler).toHaveBeenNthCalledWith(2, expect.objectContaining({ testItemId: "item-2", payload: {} }));
    expect(mocks.submitTestItemAttemptResult).toHaveBeenCalledTimes(2);
    expect(mocks.submitTestAttempt).toHaveBeenCalledWith(
      { id: "student-1", roles: ["student"] },
      "course-1",
      "group-1",
      "test-activity-1",
      "parent-attempt-1"
    );
    await expect(response.json()).resolves.toEqual({
      runtime: { attempt: { id: "parent-attempt-1", lifecycle: "submitted" } }
    });
  });
});
