import { beforeEach, describe, expect, it, vi } from "vitest";

const coreMocks = vi.hoisted(() => ({
  AppError: class AppError extends Error {
    status: number;
    code: string;
    details?: unknown;
    constructor(status: number, code: string, message: string, details?: unknown) {
      super(message);
      this.status = status;
      this.code = code;
      this.details = details;
    }
  },
  canManageCourse: vi.fn(),
  generateAiAgentText: vi.fn(),
  getCourseTeacherQuestionAuthoringAiAgentConnection: vi.fn(),
  getQuestionAuthoringAiAgentConnection: vi.fn()
}));

const dbMocks = vi.hoisted(() => ({
  pluginCodingHomeworkAssignment: {
    findUnique: vi.fn()
  },
  pluginCodingHomeworkChallengeQuestion: {
    create: vi.fn(),
    deleteMany: vi.fn()
  },
  pluginCodingHomeworkSubmission: {
    findFirst: vi.fn(),
    update: vi.fn()
  },
  pluginCodingHomeworkSubmissionFunction: {
    findMany: vi.fn()
  }
}));

vi.mock("@cognelo/core", () => coreMocks);
vi.mock("./db-client", () => ({
  Prisma: {},
  prisma: dbMocks
}));

const { buildChallengeQuestionPrompt, generateCodingHomeworkChallengeQuestions, generateCodingHomeworkChallengeQuestionsForStudentSubmission } = await import("./generation");

describe("coding homework challenge generation", () => {
  const now = new Date("2026-05-28T12:00:00.000Z");

  beforeEach(() => {
    vi.clearAllMocks();
    coreMocks.canManageCourse.mockResolvedValue(true);
    coreMocks.getCourseTeacherQuestionAuthoringAiAgentConnection.mockResolvedValue(testAiConnection());
    coreMocks.getQuestionAuthoringAiAgentConnection.mockResolvedValue(testAiConnection());
    coreMocks.generateAiAgentText.mockResolvedValue(
      JSON.stringify({
        questionText: "Explain why this function updates the accumulator before returning the result."
      })
    );
    dbMocks.pluginCodingHomeworkAssignment.findUnique.mockResolvedValue({
      generationInstructions: "Focus on reasoning about loops.",
      languageKey: "c",
      promptMarkdown: "Implement the required functions.",
      questionCount: 1
    });
    dbMocks.pluginCodingHomeworkSubmission.findFirst.mockResolvedValue(testSubmission({ status: "structure_valid" }));
    dbMocks.pluginCodingHomeworkSubmissionFunction.findMany.mockResolvedValue([
      testFunction({
        id: "function-1",
        divergenceScore: 0.9,
        functionName: "sum_values"
      }),
      testFunction({
        id: "function-2",
        divergenceScore: 0.7,
        functionName: "print_values"
      })
    ]);
    dbMocks.pluginCodingHomeworkSubmission.update.mockImplementation(async ({ data, where }) => ({
      ...testSubmission({ status: data.status ?? "structure_valid" }),
      id: where.id,
      metadata: data.metadata ?? {},
      processingError: data.processingError ?? null
    }));
    dbMocks.pluginCodingHomeworkChallengeQuestion.deleteMany.mockResolvedValue({ count: 0 });
    dbMocks.pluginCodingHomeworkChallengeQuestion.create.mockImplementation(async ({ data }) => ({
      id: `question-${data.orderIndex}`,
      answerSubmittedAt: null,
      createdAt: now,
      updatedAt: now,
      studentAnswer: null,
      ...data
    }));
  });

  it("generates stored questions for selected candidates through the teacher AI connection", async () => {
    const result = await generateCodingHomeworkChallengeQuestions(
      {
        activityId: "activity-1",
        courseId: "course-1",
        groupId: "group-1",
        user: testUser()
      },
      { locale: "en", submissionId: "submission-1" }
    );

    expect(coreMocks.getQuestionAuthoringAiAgentConnection).toHaveBeenCalledWith(testUser());
    expect(coreMocks.generateAiAgentText).toHaveBeenCalledTimes(1);
    expect(dbMocks.pluginCodingHomeworkSubmission.update).toHaveBeenNthCalledWith(1, {
      where: { id: "submission-1" },
      data: expect.objectContaining({
        metadata: expect.objectContaining({
          currentProcessingStep: "challenge-generation",
          processingTimeline: expect.arrayContaining([
            expect.objectContaining({ stage: "challenge-generation", status: "started" })
          ])
        }),
        status: "processing",
        processingError: null
      })
    });
    expect(dbMocks.pluginCodingHomeworkChallengeQuestion.deleteMany).toHaveBeenCalledWith({ where: { submissionId: "submission-1" } });
    expect(dbMocks.pluginCodingHomeworkChallengeQuestion.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        generationModel: "gpt-test",
        generationPromptVersion: "coding-homework-grader.challenge-question.v1",
        orderIndex: 0,
        questionText: "Explain why this function updates the accumulator before returning the result.",
        submissionFunctionId: "function-1",
        submissionId: "submission-1"
      })
    });
    expect(result.generation).toMatchObject({
      status: "ready",
      model: "gpt-test",
      questionCount: 1,
      candidateCount: 2
    });
    expect(result.questions).toHaveLength(1);
    expect(result.questions[0]?.nearestExamples).toEqual([
      expect.objectContaining({ functionName: "reference_sum", sourceTitle: "Week 1" })
    ]);
    expect(result.submission.status).toBe("challenge_ready");
  });

  it("retries malformed AI JSON before accepting a corrected question", async () => {
    coreMocks.generateAiAgentText
      .mockResolvedValueOnce("not json")
      .mockResolvedValueOnce(JSON.stringify({ questionText: "Explain how the branch changes the returned value for edge cases." }));

    const result = await generateCodingHomeworkChallengeQuestions(
      {
        activityId: "activity-1",
        courseId: "course-1",
        groupId: "group-1",
        user: testUser()
      },
      { submissionId: "submission-1" }
    );

    expect(coreMocks.generateAiAgentText).toHaveBeenCalledTimes(2);
    expect(coreMocks.generateAiAgentText.mock.calls[1]?.[1].userPrompt).toContain("The previous JSON payload was invalid.");
    expect(result.questions[0]?.metadata).toMatchObject({ attempts: 2 });
  });

  it("uses the course teacher AI connection for automatic student submission generation", async () => {
    coreMocks.canManageCourse.mockResolvedValue(false);

    const result = await generateCodingHomeworkChallengeQuestionsForStudentSubmission(
      {
        activityId: "activity-1",
        courseId: "course-1",
        groupId: "group-1",
        user: testStudent()
      },
      { submissionId: "submission-1" }
    );

    expect(coreMocks.getCourseTeacherQuestionAuthoringAiAgentConnection).toHaveBeenCalledWith(testStudent(), "course-1");
    expect(coreMocks.getQuestionAuthoringAiAgentConnection).not.toHaveBeenCalled();
    expect(dbMocks.pluginCodingHomeworkSubmission.findFirst).toHaveBeenCalledWith({
      where: {
        id: "submission-1",
        activityId: "activity-1",
        groupId: "group-1",
        kind: "final",
        userId: "student-1"
      },
      orderBy: { createdAt: "desc" }
    });
    expect(result.submission.status).toBe("challenge_ready");
  });

  it("rejects local AI connections for challenge question generation", async () => {
    coreMocks.getQuestionAuthoringAiAgentConnection.mockResolvedValue({
      ...testAiConnection(),
      provider: "ollama",
      model: "llama3.1",
      apiKey: null
    });

    await expect(
      generateCodingHomeworkChallengeQuestions(
        {
          activityId: "activity-1",
          courseId: "course-1",
          groupId: "group-1",
          user: testUser()
        },
        { submissionId: "submission-1" }
      )
    ).rejects.toMatchObject({ status: 400, code: "AI_AGENT_LOCAL_MODEL_NOT_ALLOWED" });

    expect(coreMocks.generateAiAgentText).not.toHaveBeenCalled();
  });

  it("returns a student-safe challenge generation payload", async () => {
    const { toStudentChallengeGenerationResult } = await import("./generation");
    const generation = await generateCodingHomeworkChallengeQuestions(
      {
        activityId: "activity-1",
        courseId: "course-1",
        groupId: "group-1",
        user: testUser()
      },
      { submissionId: "submission-1" }
    );

    const safe = toStudentChallengeGenerationResult(generation);
    expect(safe.generation).toEqual({
      status: "ready",
      generatedAt: expect.any(String),
      questionCount: 1
    });
    expect(safe.questions[0]).toEqual({
      id: "question-0",
      answerSubmittedAt: null,
      orderIndex: 0,
      questionText: "Explain why this function updates the accumulator before returning the result.",
      studentAnswer: null,
      submissionId: "submission-1"
    });
    expect(safe.questions[0]).not.toHaveProperty("nearestExamples");
    expect(safe.questions[0]).not.toHaveProperty("metadata");
  });

  it("builds prompts that keep nearest examples private", () => {
    const prompt = buildChallengeQuestionPrompt({
      assignment: {
        generationInstructions: "",
        languageKey: "c",
        promptMarkdown: "Write a sum function.",
        questionCount: 1
      },
      candidate: testFunction({ id: "function-1", functionName: "sum_values" }),
      locale: "fr",
      orderIndex: 0
    });

    expect(prompt.systemPrompt).toContain("Do not quote, mention, or reveal the prior reference examples.");
    expect(prompt.systemPrompt).toContain("French");
    expect(prompt.userPrompt).toContain("Nearest prior reference examples for private teacher/model context only");
  });

  it("marks the submission failed when the AI agent cannot produce a valid question", async () => {
    coreMocks.generateAiAgentText.mockResolvedValue(JSON.stringify({ questionText: "Too short." }));

    await expect(
      generateCodingHomeworkChallengeQuestions(
        {
          activityId: "activity-1",
          courseId: "course-1",
          groupId: "group-1",
          user: testUser()
        },
        { submissionId: "submission-1" }
      )
    ).rejects.toMatchObject({ status: 422, code: "CODING_HOMEWORK_CHALLENGE_GENERATION_INVALID" });

    expect(dbMocks.pluginCodingHomeworkSubmission.update).toHaveBeenLastCalledWith({
      where: { id: "submission-1" },
      data: expect.objectContaining({
        metadata: expect.objectContaining({
          currentProcessingStep: null,
          processingError: expect.objectContaining({
            category: "generation",
            code: "CODING_HOMEWORK_CHALLENGE_GENERATION_INVALID",
            retryable: false
          }),
          processingTimeline: expect.arrayContaining([
            expect.objectContaining({ stage: "challenge-generation", status: "failed" })
          ])
        }),
        processingError: "The AI agent could not generate a valid challenge question.",
        status: "failed"
      })
    });
  });
});

function testSubmission(input: { status: string }) {
  return {
    id: "submission-1",
    activityId: "activity-1",
    groupId: "group-1",
    userId: "student-1",
    coreAttemptId: null,
    documentationSnapshotId: "snapshot-1",
    zipAttachmentId: "zip-1",
    kind: "final",
    status: input.status,
    structureValidationSummary: {},
    processingError: null,
    metadata: {},
    createdAt: new Date("2026-05-28T12:00:00.000Z"),
    updatedAt: new Date("2026-05-28T12:00:00.000Z")
  };
}

function testAiConnection() {
  return {
    provider: "openai" as const,
    model: "gpt-test",
    baseUrl: null,
    apiKey: "key"
  };
}

function testFunction(input: { divergenceScore?: number; functionName: string; id: string }) {
  return {
    id: input.id,
    submissionId: "submission-1",
    fileId: "file-1",
    functionName: input.functionName,
    functionCode: "int sum_values(int values[], int count) { int total = 0; return total; }",
    astText: `c-ast-v1:function:${input.functionName}`,
    embedding: [0.1, 0.2],
    nearestExamples: [
      {
        referenceId: "reference-1",
        documentId: "document-1",
        functionName: "reference_sum",
        functionCode: "int reference_sum(int values[], int count) { return 0; }",
        sourceTitle: "Week 1",
        score: 0.4,
        distance: 0.6
      }
    ],
    divergenceScore: input.divergenceScore ?? 0.8,
    selectedForQuestion: true,
    createdAt: new Date("2026-05-28T12:00:00.000Z"),
    updatedAt: new Date("2026-05-28T12:00:00.000Z")
  };
}

function testUser() {
  return {
    id: "teacher-1",
    email: "teacher@example.test",
    name: null,
    firstName: null,
    lastName: null,
    roles: ["teacher" as const]
  };
}

function testStudent() {
  return {
    id: "student-1",
    email: "student@example.test",
    name: null,
    firstName: null,
    lastName: null,
    roles: ["student" as const]
  };
}
