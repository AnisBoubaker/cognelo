import { beforeEach, describe, expect, it, vi } from "vitest";

const pluginPrismaMocks = vi.hoisted(() => ({
  executionFindFirst: vi.fn(),
  referenceFindUnique: vi.fn()
}));

vi.mock("./db-client", () => ({
  prisma: {
    pluginCodingExerciseExecution: { findFirst: pluginPrismaMocks.executionFindFirst },
    pluginCodingExerciseReferenceSolution: { findUnique: pluginPrismaMocks.referenceFindUnique }
  }
}));
vi.mock("@cognelo/db", () => ({ prisma: {} }));
vi.mock("@cognelo/core", () => ({
  AppError: class AppError extends Error {},
  generateAiAgentText: vi.fn(),
  getCourseAssessmentFeedbackAiAgentConnection: vi.fn(),
  hashAiFeedbackValue: vi.fn(),
  recordAiFeedbackResearchEvent: vi.fn()
}));
vi.mock("./executions", () => ({
  getLatestCodingExerciseTestResult: vi.fn(async (input: { originalResultSummary: unknown }) => ({
    resultSummary: input.originalResultSummary,
    testEvaluationId: null
  }))
}));

const { createCodingExerciseTeacherFeedbackDraft } = await import("./ai-feedback");

describe("coding exercise teacher feedback drafts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    pluginPrismaMocks.referenceFindUnique.mockResolvedValue(null);
  });

  it("copies the submission rubric into a manual feedback draft even when automatic feedback is disabled", async () => {
    pluginPrismaMocks.executionFindFirst.mockResolvedValue({
      resultSummary: { earnedWeight: 3, totalWeight: 4 },
      aiFeedbackConfigSnapshot: {
        enabled: false,
        gradingEnabled: true,
        instructions: "",
        testWeightPercent: 60,
        aiWeightPercent: 40,
        criteria: [{ id: "quality", title: "Code quality", description: "Evaluate clarity.", weightPercent: 100 }]
      }
    });

    await expect(createCodingExerciseTeacherFeedbackDraft({ activityId: "activity-1", executionId: "execution-1" })).resolves.toMatchObject({
      kind: "assessment_feedback",
      deterministicScore: 75,
      aiScore: 0,
      combinedScore: 45,
      gradingEnabled: true,
      criteria: [{ id: "quality", title: "Code quality", weightPercent: 100, scorePercent: 0, feedback: "" }]
    });
  });

  it("uses the current rubric for development submissions whose snapshot predates rubric grading", async () => {
    pluginPrismaMocks.executionFindFirst.mockResolvedValue({
      resultSummary: { earnedWeight: 1, totalWeight: 2 },
      aiFeedbackConfigSnapshot: {
        enabled: false,
        gradingEnabled: false,
        instructions: "",
        testWeightPercent: 60,
        aiWeightPercent: 40,
        criteria: []
      }
    });
    pluginPrismaMocks.referenceFindUnique.mockResolvedValue({
      privateConfig: {
        aiFeedback: {
          enabled: false,
          gradingEnabled: true,
          instructions: "",
          testWeightPercent: 50,
          aiWeightPercent: 50,
          criteria: [{ id: "quality", title: "Quality", description: "Evaluate quality.", weightPercent: 100 }]
        }
      }
    });

    await expect(createCodingExerciseTeacherFeedbackDraft({ activityId: "activity-1", executionId: "execution-1" })).resolves.toMatchObject({
      deterministicScore: 50,
      combinedScore: 25,
      criteria: [{ id: "quality", scorePercent: 0 }]
    });
  });

  it("creates a usable rubric-only manual draft without a test score", async () => {
    pluginPrismaMocks.executionFindFirst.mockResolvedValue({ resultSummary: { earnedWeight: 0, totalWeight: 0 }, aiFeedbackConfigSnapshot: null });
    pluginPrismaMocks.referenceFindUnique.mockResolvedValue({ privateConfig: { aiFeedback: {
      enabled: false, gradingEnabled: true, testWeightPercent: 0, aiWeightPercent: 100,
      criteria: [{ id: "quality", title: "Quality", description: "Evaluate quality.", weightPercent: 100 }]
    } } });
    const draft = await createCodingExerciseTeacherFeedbackDraft({ activityId: "activity-1", executionId: "execution-1" });
    expect(draft).toMatchObject({ aiScore: 0, combinedScore: 0, testWeightPercent: 0, aiWeightPercent: 100 });
    expect(draft).not.toHaveProperty("deterministicScore");
  });

  it("loads the current rubric for a recovered answer without requiring an execution", async () => {
    pluginPrismaMocks.referenceFindUnique.mockResolvedValue({ privateConfig: { aiFeedback: {
      enabled: false, gradingEnabled: true, testWeightPercent: 0, aiWeightPercent: 100,
      criteria: [{ id: "quality", title: "Quality", description: "Evaluate quality.", weightPercent: 100 }]
    } } });
    const draft = await createCodingExerciseTeacherFeedbackDraft({ activityId: "activity-1", executionId: null });
    expect(draft).toMatchObject({ combinedScore: 0, criteria: [{ id: "quality" }] });
    expect(pluginPrismaMocks.executionFindFirst).not.toHaveBeenCalled();
  });
});
