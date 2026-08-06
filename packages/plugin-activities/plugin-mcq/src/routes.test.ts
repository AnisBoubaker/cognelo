import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  assertCanManageActivityBank: vi.fn(),
  assertCanManageCourse: vi.fn(),
  generateQuestionAuthoringText: vi.fn(),
  getActivityAttemptAvailability: vi.fn(),
  recordActivityAttemptGradingResult: vi.fn(),
  startActivityAttempt: vi.fn(),
  submitActivityAttempt: vi.fn(),
  prisma: {
    activityAttempt: { findFirst: vi.fn(), findMany: vi.fn() },
    activityBank: { findUnique: vi.fn() },
    course: { findUnique: vi.fn() },
    courseGroupParticipant: { findFirst: vi.fn() }
  }
}));

vi.mock("@cognelo/core", async () => {
  const actual = await vi.importActual<typeof import("@cognelo/core")>("@cognelo/core");
  return {
    ...actual,
    assertCanManageActivityBank: mocks.assertCanManageActivityBank,
    assertCanManageCourse: mocks.assertCanManageCourse,
    generateQuestionAuthoringText: mocks.generateQuestionAuthoringText,
    getActivityAttemptAvailability: mocks.getActivityAttemptAvailability,
    recordActivityAttemptGradingResult: mocks.recordActivityAttemptGradingResult,
    startActivityAttempt: mocks.startActivityAttempt,
    submitActivityAttempt: mocks.submitActivityAttempt
  };
});

vi.mock("@cognelo/db", () => ({
  prisma: mocks.prisma
}));

const { mcqGenerateRoute, mcqGradebookAttemptsRoute, mcqSubmissionRoute } = await import("./routes");

const context = {
  user: { id: "teacher-1", email: "teacher@example.test", name: null, firstName: null, lastName: null, roles: ["teacher" as const] },
  courseId: "course-1",
  activityId: "activity-1",
  path: ["mcq", "generate"],
  activity: {
    id: "activity-1",
    title: "MCQ",
    description: "",
    lifecycle: "draft",
    activityType: { key: "mcq", name: "MCQ", description: "" }
  }
};

describe("MCQ generation route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.prisma.course.findUnique.mockResolvedValue({ subject: { title: "Programming", description: "Basics" } });
    mocks.prisma.courseGroupParticipant.findFirst.mockResolvedValue({
      id: "participant-1",
      userId: "student-1",
      firstName: "Student",
      lastName: "One",
      email: "student@example.test"
    });
    mocks.prisma.activityAttempt.findFirst.mockResolvedValue(null);
    mocks.prisma.activityAttempt.findMany.mockResolvedValue([]);
    mocks.getActivityAttemptAvailability.mockResolvedValue({ canStart: true, reason: null });
    mocks.startActivityAttempt.mockResolvedValue({ id: "core-attempt-1" });
    mocks.submitActivityAttempt.mockResolvedValue({
      id: "core-attempt-1",
      attemptNumber: 1,
      lifecycle: "submitted",
      submittedAt: new Date("2026-05-22T12:00:00.000Z"),
      gradedAt: null,
      metadata: { submittedAnswers: { "question-1": ["question-1-choice-1"] } }
    });
    mocks.recordActivityAttemptGradingResult.mockResolvedValue({ id: "grade-1" });
  });

  it("generates valid MCQ source with course permissions", async () => {
    mocks.generateQuestionAuthoringText.mockResolvedValue(`## Question\n\n- [x] Correct\n- [ ] Wrong`);

    await expect(
      mcqGenerateRoute.methods.POST?.({
        request: new Request("http://test.local"),
        context,
        readJson: async () => ({
          description: "A student-facing prompt about programming basics.",
          defaultCodeLanguage: "python",
          instructions: "Focus on common misconceptions.",
          locale: "en",
          questionCount: 1
        })
      })
    ).resolves.toMatchObject({ attempts: 1, source: expect.stringContaining("## Question") });

    expect(mocks.assertCanManageCourse).toHaveBeenCalledWith(context.user, "course-1");
    expect(mocks.generateQuestionAuthoringText).toHaveBeenCalledWith(
      context.user,
      expect.objectContaining({
        userPrompt: expect.stringContaining("Focus on common misconceptions.")
      })
    );
    expect(mocks.generateQuestionAuthoringText.mock.calls[0]?.[1]?.userPrompt).toContain("Generate exactly 1 valid Cognelo multiple-choice question.");
  });

  it("retries when the model returns the wrong number of questions", async () => {
    mocks.generateQuestionAuthoringText
      .mockResolvedValueOnce(`## Question 1\n\n- [x] Correct\n- [ ] Wrong`)
      .mockResolvedValueOnce(`## Question 1\n\n- [x] Correct\n- [ ] Wrong\n\n## Question 2\n\n- [x] Correct\n- [ ] Wrong`);

    await expect(
      mcqGenerateRoute.methods.POST?.({
        request: new Request("http://test.local"),
        context,
        readJson: async () => ({
          description: "A student-facing prompt for two questions.",
          defaultCodeLanguage: "none",
          locale: "en",
          questionCount: 2
        })
      })
    ).resolves.toMatchObject({ attempts: 2, source: expect.stringContaining("## Question 2") });

    expect(mocks.generateQuestionAuthoringText.mock.calls[0]?.[1]?.systemPrompt).toContain("This is not a programming exercise.");
    expect(mocks.generateQuestionAuthoringText.mock.calls[1]?.[1]?.userPrompt).toContain("A student-facing prompt for two questions.");
    expect(mocks.generateQuestionAuthoringText.mock.calls[1]?.[1]?.userPrompt).toContain("exactly 2 questions");
  });

  it("retries until generated code fences explicitly use the selected language", async () => {
    mocks.generateQuestionAuthoringText
      .mockResolvedValueOnce([
        "## Question 1",
        "",
        "What is printed?",
        "",
        "```",
        "print('hello')",
        "```",
        "",
        "- [x] hello",
        "- [ ] goodbye",
        "- [ ] nothing"
      ].join("\n"))
      .mockResolvedValueOnce([
        "## Question 1",
        "",
        "What is printed?",
        "",
        "```python",
        "print('hello')",
        "```",
        "",
        "- [x] hello",
        "- [ ] goodbye",
        "- [ ] nothing"
      ].join("\n"));

    await expect(
      mcqGenerateRoute.methods.POST?.({
        request: new Request("http://test.local"),
        context,
        readJson: async () => ({
          description: "Generate a programming question about output.",
          defaultCodeLanguage: "python",
          locale: "en",
          questionCount: 1
        })
      })
    ).resolves.toMatchObject({ attempts: 2, source: expect.stringContaining("```python") });

    expect(mocks.generateQuestionAuthoringText.mock.calls[0]?.[1]?.systemPrompt).toContain("must open with ```python");
    expect(mocks.generateQuestionAuthoringText.mock.calls[1]?.[1]?.userPrompt).toContain("must include an explicit programming language");
  });

  it("retries malformed source and fails after repeated invalid output", async () => {
    mocks.generateQuestionAuthoringText.mockResolvedValue("not mcq");

    await expect(
      mcqGenerateRoute.methods.POST?.({
        request: new Request("http://test.local"),
        context,
        readJson: async () => ({ description: "Generate a simple programming MCQ.", defaultCodeLanguage: "python", locale: "en", questionCount: 1 })
      })
    ).rejects.toMatchObject({ status: 422, code: "MCQ_AI_GENERATION_INVALID" });
  });

  it("requires a course or bank context", async () => {
    await expect(
      mcqGenerateRoute.methods.POST?.({
        request: new Request("http://test.local"),
        context: { ...context, courseId: undefined },
        readJson: async () => ({ description: "Generate a simple programming MCQ.", defaultCodeLanguage: "python", locale: "en", questionCount: 1 })
      })
    ).rejects.toMatchObject({ status: 400, code: "ACTIVITY_CONTEXT_REQUIRED" });
  });

  it("records a core gradebook attempt for summative MCQ submissions", async () => {
    await expect(
      mcqSubmissionRoute.methods.POST?.({
        request: new Request("http://test.local"),
        context: {
          ...context,
          user: { ...context.user, id: "student-1", roles: ["student" as const] },
          groupId: "group-1",
          activity: {
            ...context.activity,
            config: {
              source: "## Question\n\n- [x] Correct\n- [ ] Wrong"
            },
            assignment: {
              id: "assignment-1",
              metadata: { assessmentMode: "summative" }
            }
          }
        },
        readJson: async () => ({ answers: { "question-1": ["question-1-choice-1"] } })
      })
    ).resolves.toMatchObject({
      submission: {
        id: "core-attempt-1",
        answers: { "question-1": ["question-1-choice-1"] }
      }
    });

    expect(mocks.startActivityAttempt).toHaveBeenCalledWith(
      expect.objectContaining({ id: "student-1" }),
      expect.objectContaining({
        courseId: "course-1",
        groupId: "group-1",
        activityId: "activity-1",
        pluginKey: "mcq"
      })
    );
    expect(mocks.recordActivityAttemptGradingResult).toHaveBeenCalledWith(
      expect.objectContaining({ id: "student-1" }),
      expect.objectContaining({
        attemptId: "core-attempt-1",
        rawScore: 1,
        rawMaxScore: 1,
        source: "auto"
      })
    );
  });

  it("lists MCQ gradebook attempts for teachers", async () => {
    mocks.prisma.activityAttempt.findMany.mockResolvedValueOnce([
      {
        id: "core-attempt-1",
        attemptNumber: 1,
        lifecycle: "graded",
        submittedAt: new Date("2026-05-22T12:00:00.000Z"),
        gradedAt: new Date("2026-05-22T12:00:01.000Z"),
        metadata: { submittedAnswers: { "question-1": ["question-1-choice-1"] } }
      }
    ]);

    await expect(
      mcqGradebookAttemptsRoute.methods.GET?.({
        request: new Request("http://test.local?participantId=participant-1"),
        context: { ...context, groupId: "group-1" },
        readJson: async () => ({})
      })
    ).resolves.toMatchObject({
      attempts: [
        {
          id: "core-attempt-1",
          answers: { "question-1": ["question-1-choice-1"] }
        }
      ]
    });
  });
});
