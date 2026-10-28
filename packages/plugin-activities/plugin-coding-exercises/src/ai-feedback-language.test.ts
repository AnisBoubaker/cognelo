import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  generateAiAgentText: vi.fn(),
  getCourseAssessmentFeedbackAiAgentConnection: vi.fn(),
  getCourseAssessmentFeedbackPolicy: vi.fn(),
  hashAiFeedbackValue: vi.fn(),
  recordAiFeedbackResearchEvent: vi.fn(),
  courseFindUnique: vi.fn(),
  attemptFindFirst: vi.fn(),
  childFindFirst: vi.fn(),
  referenceFindUnique: vi.fn(),
  referenceUpdate: vi.fn(),
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
    getCourseAssessmentFeedbackPolicy: mocks.getCourseAssessmentFeedbackPolicy,
    hashAiFeedbackValue: mocks.hashAiFeedbackValue,
    recordAiFeedbackResearchEvent: mocks.recordAiFeedbackResearchEvent
  };
});

vi.mock("@cognelo/db", () => ({
  prisma: {
    course: { findUnique: mocks.courseFindUnique },
    activityAttempt: { findFirst: mocks.attemptFindFirst },
    testItemAttempt: { findFirst: mocks.childFindFirst }
  }
}));

vi.mock("./db-client", () => ({
  prisma: {
    pluginCodingExerciseReferenceSolution: { findUnique: mocks.referenceFindUnique, update: mocks.referenceUpdate },
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
const { evaluateCodingExerciseAttemptWithAi, updateCodingExerciseAiGradingInstructions } = await import("./ai-feedback");

function evaluationInput(triggerKind: "teacher_single" | "formative_submission" | "test_child" = "teacher_single") {
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
    vi.resetAllMocks();
    mocks.getCourseAssessmentFeedbackPolicy.mockResolvedValue({ automaticFeedbackEnabled: true, enabled: true });
    mocks.getCourseAssessmentFeedbackAiAgentConnection.mockResolvedValue({
      id: "connection-1",
      provider: "openai_compatible",
      model: "feedback-model"
    });
    mocks.courseFindUnique.mockResolvedValue({ subject: { teachingLanguage: "fr" } });
    mocks.attemptFindFirst.mockResolvedValue({ userId: "student-1", participantId: "participant", gradebookItemId: "item" });
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

  it.each([
    ["en", "No answer provided", ""],
    ["fr", "Aucune réponse fournie", " \n\t"],
    ["zh", "未提供答案", "\r\n"],
    ["ar", "لم تُقدَّم إجابة", "  "]
  ])("grades empty %s responses without resolving or calling a model", async (language, message, sourceCode) => {
    mocks.courseFindUnique.mockResolvedValue({ subject: { teachingLanguage: language } });
    const execution = await mocks.executionFindFirst();
    execution.sourceCode = sourceCode;
    // No saved test result or working provider is needed to identify a blank response.
    execution.resultSummary = {};
    mocks.getCourseAssessmentFeedbackAiAgentConnection.mockRejectedValue(new Error("No model configured"));
    const result = await evaluateCodingExerciseAttemptWithAi(evaluationInput());
    expect(result).toMatchObject({
      feedback: { summary: message, strengths: [message], improvements: [message], aiScore: 0,
        criteria: [{ id: "correctness", scorePercent: 0, feedback: message }] },
      gradingResult: { rawScore: 0, rawMaxScore: 100 }
    });
    expect(mocks.getCourseAssessmentFeedbackAiAgentConnection).not.toHaveBeenCalled();
    expect(mocks.generateAiAgentText).not.toHaveBeenCalled();
    expect(mocks.getLatestTests).not.toHaveBeenCalled();
    expect(mocks.evaluationCreate).not.toHaveBeenCalled();
    expect(mocks.recordAiFeedbackResearchEvent).toHaveBeenCalledWith(expect.objectContaining({
      feedbackRef: result.feedbackRef, feedbackHash: result.feedbackHash, aiContribution: 0,
      metadata: expect.objectContaining({ rule: "empty-response-v1", feedback: result.feedback })
    }));
  });

  it.each([{}, { sourceCode: " \n" }])("grades a persisted unanswered Test question without execution evidence: %j", async (state) => {
    mocks.childFindFirst.mockResolvedValue({ pluginAttemptRef: null, result: { state }, parentAttempt: { userId: "student-1" } });
    const result = await evaluateCodingExerciseAttemptWithAi({ ...evaluationInput("test_child"),
      coreAttemptId: "parent", testItemAttemptId: "child", executionId: null });
    expect(result.gradingResult?.rawScore).toBe(0);
    expect(result.feedback.summary).toBe("Aucune réponse fournie");
    expect(mocks.executionFindFirst).not.toHaveBeenCalled();
    expect(mocks.generateAiAgentText).not.toHaveBeenCalled();
  });

  it("preserves course and activity feedback gates for empty responses", async () => {
    const execution = await mocks.executionFindFirst();
    execution.sourceCode = "";
    mocks.getCourseAssessmentFeedbackPolicy.mockResolvedValue({ automaticFeedbackEnabled: false });
    await expect(evaluateCodingExerciseAttemptWithAi(evaluationInput())).rejects.toMatchObject({ code: "AI_FEEDBACK_DISABLED" });
    const reference = await mocks.referenceFindUnique();
    reference.privateConfig.aiFeedback.enabled = false;
    await expect(evaluateCodingExerciseAttemptWithAi(evaluationInput())).rejects.toMatchObject({ code: "ACTIVITY_AI_FEEDBACK_DISABLED" });
    expect(mocks.generateAiAgentText).not.toHaveBeenCalled();
    expect(mocks.recordAiFeedbackResearchEvent).not.toHaveBeenCalled();
  });

  it("rejects missing or nonempty Test evidence instead of inventing an empty answer", async () => {
    const input = { ...evaluationInput("test_child"), coreAttemptId: "parent", testItemAttemptId: "child", executionId: null };
    mocks.childFindFirst.mockResolvedValue(null);
    await expect(evaluateCodingExerciseAttemptWithAi(input)).rejects.toMatchObject({ code: "CODING_EXERCISE_SUBMISSION_REQUIRED" });
    mocks.childFindFirst.mockResolvedValue({ pluginAttemptRef: null, result: { state: { sourceCode: "print(1)" } }, parentAttempt: { userId: "student-1" } });
    await expect(evaluateCodingExerciseAttemptWithAi(input)).rejects.toMatchObject({ code: "CODING_EXERCISE_SUBMISSION_REQUIRED" });
    expect(mocks.recordAiFeedbackResearchEvent).not.toHaveBeenCalled();
    expect(mocks.generateAiAgentText).not.toHaveBeenCalled();
  });

  it("grades a finalized standalone blank but rejects retained nonempty work without execution evidence", async () => {
    const attempt = { userId: "student-1", participantId: "participant", gradebookItemId: "item", groupActivityId: "assignment",
      activityId: "activity-1", lifecycle: "submitted", metadata: { timedOut: true, savedResponse: { sourceCode: "  " } } };
    mocks.attemptFindFirst.mockResolvedValue(attempt);
    const input = { ...evaluationInput(), coreAttemptId: "attempt", executionId: null };
    await expect(evaluateCodingExerciseAttemptWithAi(input)).resolves.toMatchObject({ gradingResult: { rawScore: 0 } });
    attempt.metadata.savedResponse.sourceCode = "print(1)";
    await expect(evaluateCodingExerciseAttemptWithAi(input)).rejects.toMatchObject({ code: "CODING_EXERCISE_SUBMISSION_REQUIRED" });
    expect(mocks.generateAiAgentText).not.toHaveBeenCalled();
  });

  it("enforces zero scores and fixed comments when the model identifies prototype-only work", async () => {
    mocks.courseFindUnique.mockResolvedValue({ subject: { teachingLanguage: "en" } });
    const reference = await mocks.referenceFindUnique();
    reference.privateConfig.aiFeedback.criteria = [
      { id: "correctness", title: "Correctness", description: "Correct result", weightPercent: 70 },
      { id: "clarity", title: "Clarity", description: "Clear implementation", weightPercent: 30 }
    ];
    const execution = await mocks.executionFindFirst();
    execution.sourceCode = "def minimum(a, b):\n    pass";
    execution.resultSummary = { earnedWeight: 0, totalWeight: 1 };
    mocks.generateAiAgentText.mockResolvedValue(JSON.stringify({ noAnswerProvided: true,
      summary: "Good structure", strengths: ["Nice name"], improvements: ["Implement the solution"],
      criteria: [{ criterionId: "correctness", scorePercent: 10, feedback: "An attempt" },
        { criterionId: "clarity", scorePercent: 80, feedback: "Clear name" }] }));
    const input = evaluationInput("test_child");
    input.activity.config = { ...input.activity.config, starterCode: "def minimum(a, b):\n    pass" } as typeof input.activity.config;
    const result = await evaluateCodingExerciseAttemptWithAi(input);
    expect(result.feedback).toMatchObject({ summary: "No answer provided", strengths: ["No answer provided"],
      improvements: ["No answer provided"], aiScore: 0, combinedScore: 0,
      criteria: [{ id: "correctness", scorePercent: 0, feedback: "No answer provided" },
        { id: "clarity", scorePercent: 0, feedback: "No answer provided" }] });
    expect(mocks.generateAiAgentText).toHaveBeenCalledTimes(1);
    const request = mocks.generateAiAgentText.mock.calls[0][1];
    expect(JSON.parse(request.userPrompt).activity.starterCode).toBe(execution.sourceCode);
    expect(request.systemPrompt).toContain("short but genuine solution attempt");
    expect(request.systemPrompt).toContain("noAnswerProvided=true");
    expect(mocks.evaluationUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({
      rawResponse: expect.stringContaining("Good structure"), aiScore: 0,
      sanitizedFeedback: expect.objectContaining({ summary: "No answer provided" })
    }) }));
  });

  it("keeps normal rubric assessment for genuine short or unsuccessful answers", async () => {
    mocks.generateAiAgentText.mockResolvedValue(JSON.stringify({ noAnswerProvided: false,
      summary: "Incomplete solution", strengths: ["Compares values"], improvements: ["Handle equality"],
      criteria: [{ criterionId: "correctness", scorePercent: 30, feedback: "Some logic is present" }] }));
    mocks.getLatestTests.mockResolvedValue({ resultSummary: { earnedWeight: 0, totalWeight: 1 }, testEvaluationId: null });
    await expect(evaluateCodingExerciseAttemptWithAi(evaluationInput())).resolves.toMatchObject({
      feedback: { summary: "Incomplete solution", aiScore: 30, combinedScore: 12 }, gradingResult: { rawScore: 12 }
    });
    expect(mocks.generateAiAgentText).toHaveBeenCalledTimes(1);
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

  it("uses criteria added after a Test submission while retaining the original snapshot", async () => {
    const execution = await mocks.executionFindFirst();
    execution.aiFeedbackConfigSnapshot = { enabled: false, gradingEnabled: false, criteria: [] };
    await expect(evaluateCodingExerciseAttemptWithAi(evaluationInput("test_child"))).resolves.toMatchObject({
      gradingResult: { rawScore: 100, rawMaxScore: 100 }, feedback: { criteria: [expect.objectContaining({ id: "correctness" })] }
    });
    expect(execution.aiFeedbackConfigSnapshot).toEqual({ enabled: false, gradingEnabled: false, criteria: [] });
  });

  it("rejects mismatched parent learner evidence before calling the model", async () => {
    mocks.attemptFindFirst.mockResolvedValue({ userId: "other-learner" });
    await expect(evaluateCodingExerciseAttemptWithAi({ ...evaluationInput("test_child"), coreAttemptId: "parent" }))
      .rejects.toMatchObject({ code: "CODING_EXERCISE_EXECUTION_NOT_FOUND" });
    expect(mocks.generateAiAgentText).not.toHaveBeenCalled();
    expect(mocks.evaluationCreate).not.toHaveBeenCalled();
  });

  it("grades rubric-only work without inventing a deterministic score", async () => {
    const reference = await mocks.referenceFindUnique();
    Object.assign(reference.privateConfig.aiFeedback, { testWeightPercent: 0, aiWeightPercent: 100 });
    mocks.getLatestTests.mockResolvedValue({ resultSummary: { earnedWeight: 0, totalWeight: 0, tests: [] }, testEvaluationId: null });
    await expect(evaluateCodingExerciseAttemptWithAi(evaluationInput("test_child"))).resolves.toMatchObject({
      feedback: { deterministicScore: null, aiScore: 100, combinedScore: 100 }, gradingResult: { rawScore: 100, rawMaxScore: 100 }
    });
    expect(mocks.evaluationCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ deterministicScore: null }) }));
  });

  it("refuses weighted automatic grading without a test score before invoking the model", async () => {
    mocks.getLatestTests.mockResolvedValue({ resultSummary: { earnedWeight: 0, totalWeight: 0 }, testEvaluationId: null });
    await expect(evaluateCodingExerciseAttemptWithAi(evaluationInput("test_child"))).rejects.toMatchObject({ code: "CODING_EXERCISE_TEST_RESULT_REQUIRED" });
    expect(mocks.generateAiAgentText).not.toHaveBeenCalled();
    expect(mocks.evaluationCreate).not.toHaveBeenCalled();
  });

  it("uses batch instructions and reviewed examples without sending learner identity to the model", async () => {
    await evaluateCodingExerciseAttemptWithAi({
      ...evaluationInput(),
      triggerKind: "teacher_batch",
      batchGuidance: {
        instructions: "Apply the teacher's calibration consistently.",
        templates: [{
          coreAttemptId: "template-attempt-1",
          submission: { kind: "coding-exercise", sourceCode: "print(2)", resultSummary: { earnedWeight: 1, totalWeight: 2 } },
          feedback: { summary: "Partially correct", criteria: [{ id: "correctness", scorePercent: 50, feedback: "One case is missing." }] }
        }]
      }
    });

    expect(mocks.evaluationCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        rubricSnapshot: expect.objectContaining({
          instructions: "Apply the teacher's calibration consistently.",
          configuredInstructions: "Évaluer la solution.",
          templateAttemptIds: ["template-attempt-1"]
        }),
        requestPayload: expect.objectContaining({
          gradingTemplates: [{
            submission: expect.objectContaining({ sourceCode: "print(2)" }),
            feedback: expect.objectContaining({ summary: "Partially correct" })
          }]
        })
      })
    }));
    const requestPayload = mocks.generateAiAgentText.mock.calls[0]?.[1]?.userPrompt ?? "";
    expect(requestPayload).not.toContain("template-attempt-1");
    expect(requestPayload).not.toContain("student@example");
  });

  it("updates only the course activity instructions while preserving the private rubric configuration", async () => {
    mocks.referenceFindUnique.mockResolvedValueOnce({
      privateConfig: {
        hiddenSupportCode: "private helper",
        aiFeedback: {
          enabled: true,
          gradingEnabled: true,
          instructions: "Old guidance",
          testWeightPercent: 60,
          aiWeightPercent: 40,
          criteria: [{ id: "correctness", title: "Exactitude", description: "Évaluer le résultat.", weightPercent: 100 }]
        }
      }
    });

    await updateCodingExerciseAiGradingInstructions("activity-1", "Updated guidance");

    expect(mocks.referenceUpdate).toHaveBeenCalledWith({
      where: { activityId: "activity-1" },
      data: {
        privateConfig: expect.objectContaining({
          hiddenSupportCode: "private helper",
          aiFeedback: expect.objectContaining({
            instructions: "Updated guidance",
            testWeightPercent: 60,
            aiWeightPercent: 40,
            criteria: [expect.objectContaining({ id: "correctness" })]
          })
        })
      }
    });
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
