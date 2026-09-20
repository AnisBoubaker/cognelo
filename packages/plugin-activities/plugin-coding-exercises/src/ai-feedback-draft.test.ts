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
});
