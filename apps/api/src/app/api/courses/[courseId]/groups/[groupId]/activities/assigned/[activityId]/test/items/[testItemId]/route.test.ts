import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getTestItemExecutionContext: vi.fn(),
  readJson: vi.fn(),
  requireUser: vi.fn(),
  saveTestItemAttemptState: vi.fn()
}));

vi.mock("@cognelo/core", () => ({
  AppError: class AppError extends Error {},
  getTestItemExecutionContext: mocks.getTestItemExecutionContext,
  saveTestItemAttemptState: mocks.saveTestItemAttemptState
}));

vi.mock("@/lib/http", () => ({
  handleRoute: async (handler: () => Promise<Response>) => handler(),
  json: (data: unknown, init?: ResponseInit) => Response.json(data, init),
  options: () => new Response(null, { status: 204 }),
  readJson: mocks.readJson,
  requireUser: mocks.requireUser
}));

const { GET, PUT } = await import("./route");

describe("Test child state route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireUser.mockResolvedValue({ id: "student-1", roles: ["student"] });
    mocks.readJson.mockResolvedValue({
      parentAttemptId: "parent-attempt-1",
      state: { answers: { "question-1": ["choice-1"] } }
    });
    mocks.saveTestItemAttemptState.mockResolvedValue({
      id: "item-attempt-1",
      lifecycle: "started",
      rawScore: null,
      rawMaxScore: null,
      normalizedScore: null,
      normalizedMaxScore: null,
      result: { state: { answers: { "question-1": ["choice-1"] } } },
      submittedAt: null,
      gradedAt: null
    });
    mocks.getTestItemExecutionContext.mockResolvedValue({
      itemAttempt: {
        id: "item-attempt-1",
        lifecycle: "graded",
        rawScore: 1,
        rawMaxScore: 1,
        normalizedScore: 10,
        normalizedMaxScore: 10,
        result: { state: { answers: { "question-1": ["choice-1"] } } },
        submittedAt: new Date("2026-08-07T10:00:00.000Z"),
        gradedAt: new Date("2026-08-07T10:00:00.000Z")
      }
    });
  });

  it("loads saved child state from a completed parent attempt for Previous attempts", async () => {
    const response = await GET(
      new Request("http://test.local?parentAttemptId=parent-attempt-1") as never,
      {
        params: Promise.resolve({
          courseId: "course-1",
          groupId: "group-1",
          activityId: "test-activity-1",
          testItemId: "item-1"
        })
      }
    );

    expect(mocks.getTestItemExecutionContext).toHaveBeenCalledWith(
      { id: "student-1", roles: ["student"] },
      "course-1",
      "group-1",
      "test-activity-1",
      "parent-attempt-1",
      "item-1",
      { allowCompletedParent: true }
    );
    await expect(response.json()).resolves.toMatchObject({
      itemAttempt: { lifecycle: "graded", state: { answers: { "question-1": ["choice-1"] } } }
    });
  });

  it("autosaves child state without submitting the child activity", async () => {
    const response = await PUT(new Request("http://test.local", { method: "PUT" }) as never, {
      params: Promise.resolve({
        courseId: "course-1",
        groupId: "group-1",
        activityId: "test-activity-1",
        testItemId: "item-1"
      })
    });

    expect(mocks.saveTestItemAttemptState).toHaveBeenCalledWith(
      { id: "student-1", roles: ["student"] },
      "course-1",
      "group-1",
      "test-activity-1",
      "parent-attempt-1",
      "item-1",
      { answers: { "question-1": ["choice-1"] } }
    );
    await expect(response.json()).resolves.toMatchObject({
      itemAttempt: {
        id: "item-attempt-1",
        lifecycle: "started",
        state: { answers: { "question-1": ["choice-1"] } }
      }
    });
  });
});
