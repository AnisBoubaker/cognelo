import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getContext: vi.fn(),
  gradeAttempt: vi.fn(),
  recordGrade: vi.fn(),
  regradeTest: vi.fn(),
  stream: vi.fn(),
  readJson: vi.fn(),
  requireUser: vi.fn()
}));

vi.mock("@cognelo/activity-sdk/server", () => ({ resolvePluginGradingHandler: () => mocks.gradeAttempt }));
vi.mock("@cognelo/core", () => ({
  AppError: class AppError extends Error {},
  getActivityAttemptRegradeContext: mocks.getContext,
  recordActivityAttemptGradingResult: mocks.recordGrade,
  regradeTestAttempt: mocks.regradeTest
}));
vi.mock("@/lib/http", () => ({
  handleRoute: async (handler: () => Promise<Response>) => handler(),
  json: (data: unknown) => Response.json(data),
  progressJson: mocks.stream,
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

  it("streams the Test batch only after authorization and keeps JSON callers compatible", async () => {
    mocks.getContext.mockResolvedValue({ activityTypeKey: "test" });
    const outcome = { result: { grade: { id: "grade" } }, items: [{ status: "graded" }] };
    mocks.regradeTest.mockResolvedValue(outcome);
    const report = vi.fn();
    mocks.stream.mockImplementation(async run => Response.json(await run(report)));
    const streamed = await POST(new Request("http://test.local", { method: "POST", headers: { Accept: "application/x-ndjson" } }) as never, params);
    await expect(streamed.json()).resolves.toEqual(outcome);
    expect(mocks.regradeTest).toHaveBeenCalledWith({ id: "teacher-1" }, "course-1", "attempt-1", "Corrected tests", report);
    const plain = await POST(new Request("http://test.local", { method: "POST" }) as never, params);
    await expect(plain.json()).resolves.toEqual(outcome);
    expect(mocks.stream).toHaveBeenCalledTimes(1);
    mocks.getContext.mockRejectedValueOnce(new Error("Forbidden"));
    await expect(POST(new Request("http://test.local", { method: "POST", headers: { Accept: "application/x-ndjson" } }) as never, params)).rejects.toThrow("Forbidden");
    expect(mocks.stream).toHaveBeenCalledTimes(1);
  });
});
