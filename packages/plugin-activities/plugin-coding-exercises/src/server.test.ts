import { beforeEach, describe, expect, it, vi } from "vitest";

const hiddenTestMocks = vi.hoisted(() => ({
  copyBankCodingExerciseData: vi.fn(),
  copyBankCodingExerciseDataToCourseActivity: vi.fn(),
  copyCourseCodingExerciseData: vi.fn(),
  deleteBankCodingExerciseData: vi.fn(),
  deleteCourseCodingExerciseData: vi.fn()
}));
const executionMocks = vi.hoisted(() => ({
  codingExerciseRunInputSchema: { parse: vi.fn((value) => value) },
  codingExerciseSubmitInputSchema: { parse: vi.fn((value) => value) },
  runCodingExercise: vi.fn(),
  submitCodingExercise: vi.fn()
}));
const aiFeedbackMocks = vi.hoisted(() => ({
  createCodingExerciseTeacherFeedbackDraft: vi.fn(),
  evaluateCodingExerciseAttemptWithAi: vi.fn(),
  reviseCodingExerciseAiFeedback: vi.fn(),
  snapshotCodingExerciseAiFeedbackConfig: vi.fn()
}));

vi.mock("./hidden-tests", () => hiddenTestMocks);
vi.mock("./executions", () => executionMocks);
vi.mock("./ai-feedback", () => aiFeedbackMocks);
vi.mock("./routes", () => ({
  codingExerciseGeneratePromptRoute: { path: "generate-prompt", methods: {} },
  codingExerciseGenerateSolutionRoute: { path: "generate-solution", methods: {} },
  codingExerciseGenerateTestsRoute: { path: "generate-tests", methods: {} },
  codingExerciseHistoryRoute: { path: "history", methods: {} },
  codingExerciseHiddenTestsRoute: { path: "hidden-tests", methods: {} },
  codingExerciseRunRoute: { path: "run", methods: {} },
  codingExerciseReviewAllRoute: { path: "review-all", methods: {} },
  codingExerciseSubmitRoute: { path: "submit", methods: {} }
}));

const { codingExercisesServerPlugin } = await import("./server");

describe("coding exercises server plugin lifecycle hooks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    aiFeedbackMocks.snapshotCodingExerciseAiFeedbackConfig.mockResolvedValue({ enabled: false });
    aiFeedbackMocks.createCodingExerciseTeacherFeedbackDraft.mockResolvedValue({ kind: "assessment_feedback", criteria: [] });
  });

  it("copies bank-owned data when a coding exercise is assigned to a course", async () => {
    await codingExercisesServerPlugin.hooks?.onCourseActivityCreatedFromBankVersion?.({
      user: testUser(),
      courseId: "course-1",
      bankActivityId: "bank-activity-1",
      activityVersionId: "activity-version-1",
      activity: testActivity("coding-exercise")
    });

    expect(hiddenTestMocks.copyBankCodingExerciseDataToCourseActivity).toHaveBeenCalledWith({
      bankActivityId: "bank-activity-1",
      activityId: "activity-1"
    });
  });

  it("copies private authoring data when a coding exercise is duplicated", async () => {
    await codingExercisesServerPlugin.hooks?.onCourseActivityDuplicated?.({
      user: testUser(),
      courseId: "course-1",
      sourceActivityId: "source-1",
      activity: testActivity("coding-exercise")
    });
    expect(hiddenTestMocks.copyCourseCodingExerciseData).toHaveBeenCalledWith({ sourceActivityId: "source-1", activityId: "activity-1" });
  });

  it("deletes only bank-owned coding exercise data when a bank activity is deleted", async () => {
    await codingExercisesServerPlugin.hooks?.onBankActivityDeleted?.({
      user: testUser(),
      activityBankId: "bank-1",
      bankActivityId: "bank-activity-1",
      activityTypeKey: "coding-exercise"
    });

    expect(hiddenTestMocks.deleteBankCodingExerciseData).toHaveBeenCalledWith({
      bankActivityId: "bank-activity-1"
    });
  });

  it("copies private bank data when a bank activity is duplicated", async () => {
    await codingExercisesServerPlugin.hooks?.onBankActivityDuplicated?.({ user: testUser(), activityBankId: "bank-1", sourceBankActivityId: "source-1", bankActivityId: "copy-1", activityTypeKey: "coding-exercise" });
    expect(hiddenTestMocks.copyBankCodingExerciseData).toHaveBeenCalledWith({ sourceBankActivityId: "source-1", bankActivityId: "copy-1" });
  });

  it("ignores lifecycle hooks for other activity types", async () => {
    await codingExercisesServerPlugin.hooks?.onCourseActivityCreatedFromBankVersion?.({
      user: testUser(),
      courseId: "course-1",
      bankActivityId: "bank-activity-1",
      activityVersionId: "activity-version-1",
      activity: testActivity("mcq")
    });
    await codingExercisesServerPlugin.hooks?.onBankActivityDeleted?.({
      user: testUser(),
      activityBankId: "bank-1",
      bankActivityId: "bank-activity-1",
      activityTypeKey: "mcq"
    });

    expect(hiddenTestMocks.copyBankCodingExerciseDataToCourseActivity).not.toHaveBeenCalled();
    expect(hiddenTestMocks.deleteBankCodingExerciseData).not.toHaveBeenCalled();
  });

  it("runs and grades coding exercises through the composite contract", async () => {
    executionMocks.runCodingExercise.mockResolvedValue({ id: "run-1" });
    executionMocks.submitCodingExercise.mockResolvedValue({
      id: "submit-1",
      resultSummary: { earnedWeight: 3, totalWeight: 4 }
    });
    const activity = testActivity("coding-exercise");
    const user = testUser();

    await expect(codingExercisesServerPlugin.compositeExecution?.actions?.run?.({
      user,
      courseId: "course-1",
      groupId: "group-1",
      parentAttemptId: "attempt-1",
      testItemId: "item-1",
      activity,
      payload: { sourceCode: "print(1)" }
    })).resolves.toEqual({ execution: { id: "run-1" } });
    await expect(codingExercisesServerPlugin.compositeExecution?.submit({
      user,
      courseId: "course-1",
      groupId: "group-1",
      parentAttemptId: "attempt-1",
      testItemId: "item-1",
      activity,
      payload: { sourceCode: "print(1)" }
    })).resolves.toEqual(expect.objectContaining({
      state: { sourceCode: "print(1)", executionId: "submit-1" },
      gradingResult: expect.objectContaining({ rawScore: 3, rawMaxScore: 4 })
    }));
    expect(aiFeedbackMocks.snapshotCodingExerciseAiFeedbackConfig).toHaveBeenCalledWith({
      activityId: "activity-1",
      executionId: "submit-1"
    });
  });

  it("returns a grading result when a teacher changes an AI-graded rubric", async () => {
    aiFeedbackMocks.reviseCodingExerciseAiFeedback.mockReturnValue({
      kind: "ai_assessment_feedback",
      feedbackRef: "evaluation-1",
      gradingEnabled: true,
      deterministicScore: 80,
      aiScore: 90,
      combinedScore: 84,
      criteria: [{ id: "correctness", scorePercent: 90 }]
    });

    const revision = await codingExercisesServerPlugin.aiFeedback?.teacherReview?.reviseFeedback({
      user: testUser(),
      courseId: "course-1",
      groupId: "group-1",
      activityId: "activity-1",
      coreAttemptId: "attempt-1",
      pluginAttemptRef: "execution-1",
      activity: testActivity("coding-exercise"),
      currentFeedback: { criteria: [{ id: "correctness", scorePercent: 70 }] },
      feedback: {}
    });
    expect(revision).toMatchObject({
      feedback: { combinedScore: 84 },
      gradingResult: {
        rawScore: 84,
        rawMaxScore: 100,
        metadata: {
          executionId: "execution-1",
          deterministicScore: 80,
          aiScore: 90,
          combinedScore: 84
        }
      }
    });
  });

  it("builds teacher feedback drafts from the submission rubric", async () => {
    await expect(codingExercisesServerPlugin.aiFeedback?.teacherReview?.createFeedbackDraft({
      user: testUser(),
      courseId: "course-1",
      groupId: "group-1",
      activityId: "activity-1",
      coreAttemptId: "attempt-1",
      pluginAttemptRef: "execution-1",
      activity: testActivity("coding-exercise")
    })).resolves.toEqual({ kind: "assessment_feedback", criteria: [] });
    expect(aiFeedbackMocks.createCodingExerciseTeacherFeedbackDraft).toHaveBeenCalledWith({
      activityId: "activity-1",
      executionId: "execution-1"
    });
  });

  it("does not regrade when a teacher changes narrative feedback only", async () => {
    aiFeedbackMocks.reviseCodingExerciseAiFeedback.mockReturnValue({
      kind: "ai_assessment_feedback",
      gradingEnabled: true,
      deterministicScore: 80,
      aiScore: 70,
      combinedScore: 76,
      criteria: [{ id: "correctness", scorePercent: 70 }]
    });

    const revision = await codingExercisesServerPlugin.aiFeedback?.teacherReview?.reviseFeedback({
      user: testUser(),
      courseId: "course-1",
      groupId: "group-1",
      activityId: "activity-1",
      coreAttemptId: "attempt-1",
      pluginAttemptRef: "execution-1",
      activity: testActivity("coding-exercise"),
      currentFeedback: { criteria: [{ id: "correctness", scorePercent: 70 }] },
      feedback: { summary: "Narrative only" }
    });

    expect(revision).not.toHaveProperty("gradingResult");
  });
});

function testUser() {
  return {
    id: "user-1",
    email: "teacher@example.test",
    name: null,
    firstName: null,
    lastName: null,
    roles: ["teacher" as const]
  };
}

function testActivity(activityTypeKey: string) {
  return {
    id: "activity-1",
    title: "Activity",
    description: "",
    lifecycle: "draft",
    activityType: {
      key: activityTypeKey,
      name: activityTypeKey,
      description: ""
    }
  };
}
