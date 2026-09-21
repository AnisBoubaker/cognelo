import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  generateAiAgentText: vi.fn(),
  getCourseAssessmentFeedbackAiAgentConnection: vi.fn(),
  hashAiFeedbackValue: vi.fn(),
  recordAiFeedbackResearchEvent: vi.fn(),
  courseFindUnique: vi.fn(),
  referenceFindUnique: vi.fn(),
  executionFindFirst: vi.fn(),
  evaluationFindFirst: vi.fn(),
  evaluationCreate: vi.fn(),
  evaluationUpdate: vi.fn(),
  getLatestTests: vi.fn()
}));

vi.mock("@cognelo/core", async () => {
  const actual = await vi.importActual<typeof import("@cognelo/core")>("@cognelo/core");
  return {
    ...actual,
    generateAiAgentText: mocks.generateAiAgentText,
    getCourseAssessmentFeedbackAiAgentConnection: mocks.getCourseAssessmentFeedbackAiAgentConnection,
    hashAiFeedbackValue: mocks.hashAiFeedbackValue,
    recordAiFeedbackResearchEvent: mocks.recordAiFeedbackResearchEvent
  };
});

vi.mock("@cognelo/db", () => ({
  prisma: {
    course: { findUnique: mocks.courseFindUnique }
  }
}));

vi.mock("./db-client", () => ({
  prisma: {
    pluginCodingExerciseReferenceSolution: { findUnique: mocks.referenceFindUnique },
    pluginCodingExerciseExecution: { findFirst: mocks.executionFindFirst },
    pluginCodingExerciseAiEvaluation: {
      findFirst: mocks.evaluationFindFirst,
      create: mocks.evaluationCreate,
      update: mocks.evaluationUpdate
    }
  }
}));
vi.mock("./executions", () => ({
  getLatestCodingExerciseTestResult: mocks.getLatestTests
}));

const { AppError } = await import("@cognelo/core");
const { evaluateCodingExerciseAttemptWithAi } = await import("./ai-feedback");

function evaluationInput(triggerKind: "teacher_single" | "formative_submission" = "teacher_single") {
  return {
    user: {
      id: "teacher-1",
      email: "teacher@example.test",
      name: null,
      firstName: null,
      lastName: null,
      roles: ["teacher" as const]
    },
    courseId: "course-1",
    activityId: "activity-1",
    executionId: "execution-1",
    activity: {
      id: "activity-1",
      title: "Minimum",
      description: "Comparer des valeurs.",
      lifecycle: "published" as const,
      config: { language: "python", prompt: "Afficher la plus petite valeur." },
      activityType: { key: "coding-exercise", name: "Programmation", description: "" }
    },
    assessmentMode: triggerKind === "formative_submission" ? "formative" as const : "summative" as const,
    triggerKind
  };
}

describe("coding exercise generated feedback language", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCourseAssessmentFeedbackAiAgentConnection.mockResolvedValue({
      id: "connection-1",
      provider: "openai_compatible",
      model: "feedback-model"
    });
    mocks.courseFindUnique.mockResolvedValue({ subject: { teachingLanguage: "fr" } });
    mocks.referenceFindUnique.mockResolvedValue({
      sourceCode: "print('reference')",
      privateConfig: {
        aiFeedback: {
          enabled: true,
          gradingEnabled: true,
          instructions: "Évaluer la solution.",
          testWeightPercent: 60,
          aiWeightPercent: 40,
          criteria: [{ id: "correctness", title: "Exactitude", description: "Évaluer le résultat.", weightPercent: 100 }]
        }
      }
    });
    mocks.executionFindFirst.mockResolvedValue({
      id: "execution-1",
      userId: "student-1",
      sourceCode: "print(1)",
      resultSummary: { earnedWeight: 1, totalWeight: 1, tests: [] },
      aiFeedbackConfigSnapshot: null,
      judge0StatusId: 3
    });
    mocks.evaluationFindFirst.mockResolvedValue(null);
    mocks.getLatestTests.mockImplementation(async (input: { originalResultSummary: unknown }) => ({
      resultSummary: input.originalResultSummary,
      testEvaluationId: null
    }));
    mocks.evaluationCreate.mockResolvedValue({ id: "evaluation-1", version: 1 });
    mocks.evaluationUpdate.mockResolvedValue({ id: "evaluation-1", version: 1 });
    mocks.hashAiFeedbackValue.mockReturnValue("hash");
    mocks.recordAiFeedbackResearchEvent.mockResolvedValue({});
    mocks.generateAiAgentText.mockResolvedValue(JSON.stringify({
      summary: "Bonne solution.",
      strengths: ["Résultat exact."],
      improvements: [],
      criteria: [{ criterionId: "correctness", scorePercent: 100, feedback: "Le résultat est exact." }]
    }));
  });

  it("makes the subject teaching language authoritative", async () => {
    await expect(evaluateCodingExerciseAttemptWithAi(evaluationInput())).resolves.toMatchObject({
      feedback: { summary: "Bonne solution." }
    });

    expect(mocks.generateAiAgentText).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        systemPrompt: expect.stringContaining("French, the subject's teaching language")
      })
    );
    expect(mocks.evaluationCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        requestPayload: expect.objectContaining({
          activity: expect.objectContaining({ teachingLanguage: "fr" })
        })
      })
    }));
  });

  it("uses the current rubric and latest saved tests for a teacher-triggered evaluation", async () => {
    mocks.executionFindFirst.mockResolvedValue({
      id: "execution-1",
      userId: "student-1",
      sourceCode: "print(1)",
      resultSummary: { earnedWeight: 1, totalWeight: 1 },
      aiFeedbackConfigSnapshot: {
        enabled: true,
        gradingEnabled: true,
        instructions: "Old rubric",
        testWeightPercent: 90,
        aiWeightPercent: 10,
        criteria: [{ id: "old", title: "Old", description: "Old", weightPercent: 100 }]
      }
    });
    mocks.getLatestTests.mockResolvedValue({
      resultSummary: { earnedWeight: 1, totalWeight: 2, tests: [{ id: "new-test", passed: false }] },
      testEvaluationId: "test-regrade-1"
    });

    await expect(evaluateCodingExerciseAttemptWithAi(evaluationInput())).resolves.toMatchObject({
      feedback: { deterministicScore: 50, aiScore: 100, combinedScore: 70 }
    });
    expect(mocks.evaluationCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        deterministicScore: 50,
        testWeightPercent: 60,
        aiWeightPercent: 40,
        rubricSnapshot: expect.objectContaining({ criteria: [expect.objectContaining({ id: "correctness" })] }),
        requestPayload: expect.objectContaining({
          activity: expect.objectContaining({ referenceSolution: "print('reference')" }),
          submission: expect.objectContaining({
            testEvaluationId: "test-regrade-1",
            deterministicTests: expect.objectContaining({ earnedWeight: 1, totalWeight: 2 })
          })
        })
      })
    }));
  });

  it("gives teachers an actionable error when the configured model is unavailable", async () => {
    mocks.generateAiAgentText.mockRejectedValue(new AppError(
      404,
      "AI_AGENT_REQUEST_FAILED",
      "The AI agent request failed: model not found"
    ));

    await expect(evaluateCodingExerciseAttemptWithAi(evaluationInput())).rejects.toMatchObject({
      code: "AI_FEEDBACK_MODEL_UNAVAILABLE",
      message: expect.stringContaining('model "feedback-model" is unavailable')
    });
    expect(mocks.evaluationUpdate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: "failed" })
    }));
  });

  it("keeps provider details out of formative learner failures", async () => {
    mocks.generateAiAgentText.mockRejectedValue(new AppError(
      404,
      "AI_AGENT_REQUEST_FAILED",
      "The AI agent request failed: model not found"
    ));

    await expect(evaluateCodingExerciseAttemptWithAi(evaluationInput("formative_submission"))).rejects.toMatchObject({
      code: "AI_FEEDBACK_GENERATION_FAILED",
      message: "Assessment feedback could not be generated. The submission remains available for retry or manual grading."
    });
  });
});
