import { beforeEach, describe, expect, it, vi } from "vitest";

const coreMocks = vi.hoisted(() => ({
  AppError: class AppError extends Error {
    status: number;
    code: string;
    constructor(status: number, code: string, message: string) {
      super(message);
      this.status = status;
      this.code = code;
    }
  },
  startActivityAttempt: vi.fn(),
  submitActivityAttempt: vi.fn()
}));

const dbMocks = vi.hoisted(() => ({
  pluginCodingHomeworkChallengeQuestion: {
    update: vi.fn()
  },
  pluginCodingHomeworkSubmission: {
    findFirst: vi.fn(),
    update: vi.fn()
  }
}));

vi.mock("@cognelo/core", () => coreMocks);
vi.mock("./db-client", () => ({
  Prisma: {},
  prisma: dbMocks
}));

const { saveCodingHomeworkChallengeAnswers } = await import("./challenge-answers");

describe("coding homework challenge answers", () => {
  const now = new Date("2026-05-29T12:00:00.000Z");

  beforeEach(() => {
    vi.clearAllMocks();
    dbMocks.pluginCodingHomeworkSubmission.findFirst.mockResolvedValue(testSubmission({ status: "challenge_ready" }));
    dbMocks.pluginCodingHomeworkChallengeQuestion.update.mockImplementation(async ({ data, where }) => ({
      ...testQuestion(where.id, where.id === "question-1" ? 0 : 1),
      ...data
    }));
    dbMocks.pluginCodingHomeworkSubmission.update.mockImplementation(async ({ data, where }) => ({
      ...testSubmission({ status: data.status }),
      coreAttemptId: data.coreAttemptId ?? null,
      id: where.id,
      metadata: data.metadata,
      processingError: data.processingError
    }));
    coreMocks.startActivityAttempt.mockResolvedValue({ id: "core-attempt-1" });
    coreMocks.submitActivityAttempt.mockResolvedValue({ id: "core-attempt-1" });
  });

  it("saves draft answers without completing the submission", async () => {
    const result = await saveCodingHomeworkChallengeAnswers(
      {
        activityId: "activity-1",
        courseId: "course-1",
        groupId: "group-1",
        user: testUser()
      },
      {
        answers: [{ questionId: "question-1", answer: "The loop accumulates values before returning." }],
        submissionId: "submission-1"
      },
      { finalize: false }
    );

    expect(dbMocks.pluginCodingHomeworkChallengeQuestion.update).toHaveBeenCalledTimes(1);
    expect(dbMocks.pluginCodingHomeworkChallengeQuestion.update).toHaveBeenCalledWith({
      where: { id: "question-1" },
      data: {
        answerSubmittedAt: null,
        studentAnswer: "The loop accumulates values before returning."
      }
    });
    expect(result.submission.status).toBe("challenge_ready");
    expect(result.questions[0]).toMatchObject({ id: "question-1", studentAnswer: "The loop accumulates values before returning." });
  });

  it("requires every answer before marking the submission ready for grading", async () => {
    await expect(
      saveCodingHomeworkChallengeAnswers(
        {
          activityId: "activity-1",
          courseId: "course-1",
          groupId: "group-1",
          user: testUser()
        },
        {
          answers: [{ questionId: "question-1", answer: "Only one answer." }],
          submissionId: "submission-1"
        },
        { finalize: true }
      )
    ).rejects.toMatchObject({ status: 400, code: "CODING_HOMEWORK_CHALLENGE_ANSWERS_INCOMPLETE" });

    expect(dbMocks.pluginCodingHomeworkChallengeQuestion.update).not.toHaveBeenCalled();

    const result = await saveCodingHomeworkChallengeAnswers(
      {
        activityId: "activity-1",
        courseId: "course-1",
        groupId: "group-1",
        user: testUser()
      },
      {
        answers: [
          { questionId: "question-1", answer: "The loop accumulates values before returning." },
          { questionId: "question-2", answer: "The base case decides the edge behavior." }
        ],
        submissionId: "submission-1"
      },
      { finalize: true }
    );

    expect(dbMocks.pluginCodingHomeworkChallengeQuestion.update).toHaveBeenCalledTimes(2);
    expect(result.submission.status).toBe("ready_for_grading");
    expect(result.questions.every((question) => question.answerSubmittedAt)).toBe(true);
  });

  it("creates a core gradebook attempt when finalized in summative mode", async () => {
    const result = await saveCodingHomeworkChallengeAnswers(
      {
        activityId: "activity-1",
        courseId: "course-1",
        groupId: "group-1",
        user: testUser()
      },
      {
        answers: [
          { questionId: "question-1", answer: "The loop accumulates values before returning." },
          { questionId: "question-2", answer: "The base case decides the edge behavior." }
        ],
        submissionId: "submission-1"
      },
      { finalize: true, gradebook: { assessmentMode: "summative", pluginVersion: "0.1.0" } }
    );

    expect(coreMocks.startActivityAttempt).toHaveBeenCalledWith(
      testUser(),
      expect.objectContaining({
        activityId: "activity-1",
        courseId: "course-1",
        groupId: "group-1",
        pluginAttemptRef: "submission-1",
        pluginKey: "coding-homework-grader"
      })
    );
    expect(coreMocks.submitActivityAttempt).toHaveBeenCalledWith(testUser(), expect.objectContaining({ attemptId: "core-attempt-1" }));
    expect(result.submission.coreAttemptId).toBe("core-attempt-1");
  });

  it("locks completed submissions", async () => {
    dbMocks.pluginCodingHomeworkSubmission.findFirst.mockResolvedValue(testSubmission({ status: "ready_for_grading" }));

    await expect(
      saveCodingHomeworkChallengeAnswers(
        {
          activityId: "activity-1",
          courseId: "course-1",
          groupId: "group-1",
          user: testUser()
        },
        { answers: [], submissionId: "submission-1" },
        { finalize: false }
      )
    ).rejects.toMatchObject({ status: 409, code: "CODING_HOMEWORK_SUBMISSION_LOCKED" });
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
      createdAt: now,
      updatedAt: now,
      questions: [testQuestion("question-1", 0), testQuestion("question-2", 1)]
    };
  }

  function testQuestion(id: string, orderIndex: number) {
    return {
      id,
      submissionId: "submission-1",
      submissionFunctionId: `function-${orderIndex}`,
      orderIndex,
      questionText: `Question ${orderIndex + 1}?`,
      studentAnswer: null,
      answerSubmittedAt: null,
      generationModel: "gpt-test",
      generationPromptVersion: "coding-homework-grader.challenge-question.v1",
      nearestExamples: [],
      metadata: {},
      createdAt: now,
      updatedAt: now
    };
  }
});

function testUser() {
  return {
    id: "student-1",
    email: "student@example.test",
    name: null,
    firstName: null,
    lastName: null,
    roles: ["student" as const]
  };
}
