import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  regradeTests: vi.fn(),
  getReview: vi.fn(),
  findEvaluation: vi.fn(),
  hash: vi.fn(),
  recordResearch: vi.fn()
}));

vi.mock("./executions", () => ({
  regradeCodingExerciseTests: mocks.regradeTests
}));
vi.mock("./db-client", () => ({
  prisma: { pluginCodingExerciseAiEvaluation: { findFirst: mocks.findEvaluation } }
}));
vi.mock("@cognelo/core", () => ({
  AppError: class AppError extends Error {},
  getTeacherAttemptAiFeedbackReview: mocks.getReview,
  hashAiFeedbackValue: mocks.hash,
  recordAiFeedbackResearchEvent: mocks.recordResearch
}));

const { regradeCodingExerciseAttempt } = await import("./regrading");

function input() {
  return {
    user: {
      id: "teacher-1", email: "teacher@example.test", name: null,
      firstName: null, lastName: null, roles: ["teacher" as const]
    },
    courseId: "course-1",
    groupId: "group-1",
    activityId: "activity-1",
    coreAttemptId: "attempt-1",
    executionId: "submission-1",
    activity: {
      id: "activity-1",
      title: "Exercise",
      description: "",
      lifecycle: "published",
      config: { language: "c" },
      assignment: { id: "assignment-1" },
      activityType: { key: "coding-exercise", name: "Programming Exercise", description: "" }
    }
  } satisfies Parameters<typeof regradeCodingExerciseAttempt>[0];
}

describe("programming exercise test-only regrading", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.regradeTests.mockResolvedValue({
      testEvaluationId: "test-evaluation-2",
      resultSummary: { earnedWeight: 2, totalWeight: 5, tests: [{ id: "new-test", passed: false }] },
      feedbackConfig: { gradingEnabled: true, testWeightPercent: 70, aiWeightPercent: 30 }
    });
    mocks.getReview.mockResolvedValue({
      feedback: {
        kind: "ai_assessment_feedback",
        summary: "Teacher-edited feedback",
        aiScore: 90,
        feedbackRef: "evaluation-1",
        feedbackVersion: 1,
        challengeAllowed: true
      }
    });
    mocks.findEvaluation.mockResolvedValue({ id: "evaluation-1", version: 1, aiScore: 80 });
    mocks.hash.mockReturnValue("new-feedback-hash");
    mocks.recordResearch.mockResolvedValue({});
  });

  it("reruns tests and combines their new score with the latest reviewed rubric score using current weights", async () => {
    const result = await regradeCodingExerciseAttempt(input());

    expect(mocks.regradeTests).toHaveBeenCalledWith(expect.objectContaining({
      executionId: "submission-1",
      actorUserId: "teacher-1"
    }));
    expect(result).toMatchObject({
      rawScore: 55,
      rawMaxScore: 100,
      metadata: {
        testEvaluationId: "test-evaluation-2",
        deterministicScore: 40,
        aiScore: 90,
        studentFeedback: {
          summary: "Teacher-edited feedback",
          feedbackRef: "test-regrade:test-evaluation-2",
          sourceFeedbackRef: "evaluation-1",
          deterministicScore: 40,
          combinedScore: 55,
          feedbackHash: "new-feedback-hash"
        }
      }
    });
    expect(mocks.recordResearch).toHaveBeenCalledWith(expect.objectContaining({
      eventType: "coding_tests_regraded",
      outcome: "completed"
    }));
  });

  it("records the new test result but defers the final grade when a rubric score is absent", async () => {
    mocks.getReview.mockResolvedValue({ feedback: null });
    mocks.findEvaluation.mockResolvedValue(null);

    await expect(regradeCodingExerciseAttempt(input())).resolves.toMatchObject({
      deferred: true,
      metadata: { testEvaluationId: "test-evaluation-2", deterministicScore: 40 }
    });
    expect(mocks.recordResearch).toHaveBeenCalledWith(expect.objectContaining({ outcome: "awaiting_rubric" }));
  });

  it("uses only tests when rubric grading is disabled", async () => {
    mocks.regradeTests.mockResolvedValue({
      testEvaluationId: "test-evaluation-2",
      resultSummary: { earnedWeight: 2, totalWeight: 5 },
      feedbackConfig: { gradingEnabled: false }
    });
    await expect(regradeCodingExerciseAttempt(input())).resolves.toMatchObject({ rawScore: 40, rawMaxScore: 100 });
  });
});
