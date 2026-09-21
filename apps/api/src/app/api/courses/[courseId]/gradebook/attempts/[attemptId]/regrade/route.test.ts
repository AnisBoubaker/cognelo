import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getContext: vi.fn(),
  gradeAttempt: vi.fn(),
  recordGrade: vi.fn(),
  readJson: vi.fn(),
  requireUser: vi.fn()
}));

vi.mock("@cognelo/activity-sdk/server", () => ({ resolvePluginGradingHandler: () => mocks.gradeAttempt }));
vi.mock("@cognelo/core", () => ({
  AppError: class AppError extends Error {},
  getActivityAttemptRegradeContext: mocks.getContext,
  recordActivityAttemptGradingResult: mocks.recordGrade,
  regradeTestAttempt: vi.fn()
}));
vi.mock("@/lib/http", () => ({
  handleRoute: async (handler: () => Promise<Response>) => handler(),
  json: (data: unknown) => Response.json(data),
  options: () => new Response(null, { status: 204 }),
  readJson: mocks.readJson,
  requireUser: mocks.requireUser
}));

const { POST } = await import("./route");
const params = { params: Promise.resolve({ courseId: "course-1", attemptId: "attempt-1" }) };

describe("teacher regrade route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireUser.mockResolvedValue({ id: "teacher-1" });
    mocks.readJson.mockResolvedValue({ reason: "Corrected tests" });
    mocks.getContext.mockResolvedValue({
      activityTypeKey: "coding-exercise",
      courseId: "course-1",
      groupId: "group-1",
      activityId: "activity-1",
      attemptId: "attempt-1",
      pluginAttemptRef: "execution-1",
      activity: { id: "activity-1" }
    });
  });

  it("leaves the grade untouched when the test-only regrade needs a rubric score", async () => {
    mocks.gradeAttempt.mockResolvedValue({ deferred: true, reason: "Rubric score required" });
    const response = await POST(new Request("http://test.local", { method: "POST" }) as never, params);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ result: null, deferred: "Rubric score required" });
    expect(mocks.recordGrade).not.toHaveBeenCalled();
  });

  it("records the recomposed grade as an audited regrade", async () => {
    mocks.gradeAttempt.mockResolvedValue({ rawScore: 73, rawMaxScore: 100, metadata: { studentFeedback: { summary: "Preserved" } } });
    mocks.recordGrade.mockResolvedValue({ grade: { id: "grade-1" }, attempt: { id: "attempt-1" } });
    const response = await POST(new Request("http://test.local", { method: "POST" }) as never, params);
    expect(response.status).toBe(200);
    expect(mocks.recordGrade).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      source: "regrade",
      reason: "Corrected tests",
      normalizedResult: { studentFeedback: { summary: "Preserved" } }
    }));
  });
});
