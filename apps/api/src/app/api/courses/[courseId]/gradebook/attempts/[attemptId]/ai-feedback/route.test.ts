import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getContext: vi.fn(),
  getReview: vi.fn(),
  recordGrading: vi.fn(),
  recordResearch: vi.fn(),
  reviseCoreFeedback: vi.fn(),
  revisePluginFeedback: vi.fn(),
  resolveTeacherReview: vi.fn(),
  readJson: vi.fn(),
  requireUser: vi.fn()
}));

vi.mock("@cognelo/activity-sdk/server", () => ({
  resolvePluginAiFeedbackHandler: vi.fn(),
  resolvePluginAiFeedbackTeacherReviewHandler: mocks.resolveTeacherReview
}));
vi.mock("@cognelo/core", () => ({
  AppError: class AppError extends Error {},
  getActivityAttemptRegradeContext: mocks.getContext,
  getTeacherAttemptAiFeedbackReview: mocks.getReview,
  getTestAttemptReview: vi.fn(),
  recordActivityAttemptAiFeedback: vi.fn(),
  recordActivityAttemptGradingResult: mocks.recordGrading,
  recordAiFeedbackResearchEvent: mocks.recordResearch,
  recordTestItemAiFeedback: vi.fn(),
  regradeTestAttempt: vi.fn(),
  reviseTeacherAttemptAiFeedback: mocks.reviseCoreFeedback
}));
vi.mock("@/lib/http", () => ({
  handleRoute: async (handler: () => Promise<Response>) => handler(),
  json: (data: unknown) => Response.json(data),
  options: () => new Response(null, { status: 204 }),
  readJson: mocks.readJson,
  requireUser: mocks.requireUser
}));

const { PATCH } = await import("./route");
const params = { params: Promise.resolve({ courseId: "course-1", attemptId: "attempt-1" }) };

describe("teacher feedback revision route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireUser.mockResolvedValue({ id: "teacher-1", roles: ["teacher"] });
    mocks.readJson.mockResolvedValue({ feedback: { summary: "Reviewed" } });
    mocks.getContext.mockResolvedValue({
      attemptId: "attempt-1",
      lifecycle: "graded",
      courseId: "course-1",
      groupId: "group-1",
      activityId: "activity-1",
      pluginAttemptRef: "execution-1",
      activityTypeKey: "coding-exercise",
      activity: {
        id: "activity-1",
        title: "Exercise",
        description: "",
        lifecycle: "published",
        assignment: { id: "assignment-1" },
        activityType: { key: "coding-exercise", name: "Programming Exercise", description: "" }
      }
    });
    mocks.getReview.mockResolvedValue({ feedback: { feedbackRef: "evaluation-1", feedbackVersion: 1 } });
    mocks.resolveTeacherReview.mockReturnValue({
      createFeedbackDraft: vi.fn(),
      getSubmission: vi.fn(),
      reviseFeedback: mocks.revisePluginFeedback
    });
    mocks.revisePluginFeedback.mockResolvedValue({
      feedback: { summary: "Reviewed", combinedScore: 82 },
      gradingResult: {
        rawScore: 82,
        rawMaxScore: 100,
        analyticsPayload: { aiScore: 70 },
        metadata: { kind: "coding-exercise", combinedScore: 82 }
      }
    });
    mocks.reviseCoreFeedback.mockResolvedValue({
      feedback: { summary: "Reviewed", feedbackRef: "evaluation-1", feedbackVersion: 1 },
      teacherRevision: 1,
      feedbackHash: "revised-hash"
    });
    mocks.recordGrading.mockResolvedValue({
      attempt: { id: "attempt-1" },
      grade: { id: "grade-1", gradebookItemId: "item-1", normalizedScore: 82, normalizedMaxScore: 100 }
    });
    mocks.recordResearch.mockResolvedValue({ id: "research-1" });
  });

  it("regrades through core when rubric scores change", async () => {
    const response = await PATCH(new Request("http://test.local", { method: "PATCH" }) as never, params);

    expect(response.status).toBe(200);
    expect(mocks.recordGrading).toHaveBeenCalledWith(
      { id: "teacher-1", roles: ["teacher"] },
      expect.objectContaining({
        attemptId: "attempt-1",
        rawScore: 82,
        rawMaxScore: 100,
        source: "regrade",
        reason: "Teacher rubric review"
      })
    );
    expect(mocks.recordResearch).toHaveBeenCalledWith(expect.objectContaining({
      eventType: "feedback_teacher_grade_adjusted",
      feedbackHash: "revised-hash",
      outcome: "graded"
    }));
    await expect(response.json()).resolves.toMatchObject({
      feedback: { summary: "Reviewed" },
      grade: { id: "grade-1", normalizedScore: 82 }
    });
  });
});
