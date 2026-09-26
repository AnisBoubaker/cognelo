import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  participantFindFirst: vi.fn(),
  gradebookItemFindFirst: vi.fn(),
  attemptFindMany: vi.fn(),
  executionFindMany: vi.fn(),
  latestTests: vi.fn()
}));

vi.mock("@cognelo/db", () => ({
  prisma: {
    courseGroupParticipant: { findFirst: mocks.participantFindFirst },
    gradebookItem: { findFirst: mocks.gradebookItemFindFirst },
    activityAttempt: { findMany: mocks.attemptFindMany }
  }
}));
vi.mock("./db-client", () => ({
  prisma: {
    pluginCodingExerciseExecution: { findMany: mocks.executionFindMany }
  }
}));
vi.mock("./executions", () => ({
  getLatestCodingExerciseTestResult: mocks.latestTests
}));

const { getCodingExerciseStudentGradeReport } = await import("./student-grade-report");

const student = {
  id: "student-1",
  email: "student@example.test",
  name: null,
  firstName: null,
  lastName: null,
  roles: ["student" as const]
};

describe("coding exercise student grade report", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.participantFindFirst.mockResolvedValue({ id: "participant-1" });
    mocks.gradebookItemFindFirst.mockResolvedValue({ id: "gradebook-item-1" });
  });

  it("returns every active graded attempt with latest test outcomes and points", async () => {
    const submittedAt = new Date("2026-09-26T12:00:00.000Z");
    mocks.attemptFindMany.mockResolvedValue([
      { id: "attempt-1", attemptNumber: 1, pluginAttemptRef: "execution-1", submittedAt },
      { id: "attempt-2", attemptNumber: 2, pluginAttemptRef: "execution-2", submittedAt }
    ]);
    mocks.executionFindMany.mockResolvedValue([
      { id: "execution-1", sourceCode: "print(1)", languageKey: "python", resultSummary: {}, updatedAt: submittedAt },
      { id: "execution-2", sourceCode: "print(2)", languageKey: "python", resultSummary: {}, updatedAt: submittedAt }
    ]);
    mocks.latestTests.mockImplementation(async ({ executionId }: { executionId: string }) => ({
      resultSummary: {
        earnedWeight: executionId === "execution-1" ? 0 : 2,
        totalWeight: 2,
        tests: [{ id: "test-1", name: "Produces output", passed: executionId === "execution-2", weight: 2 }]
      },
      testEvaluationId: null
    }));

    await expect(getCodingExerciseStudentGradeReport({
      user: student,
      courseId: "course-1",
      groupId: "group-1",
      activityId: "activity-1",
      gradebookItemId: "gradebook-item-1",
      selectedAttemptId: "attempt-2"
    })).resolves.toEqual({
      kind: "coding-exercise",
      attempts: [
        expect.objectContaining({ attemptNumber: 1, isSelected: false, sourceCode: "print(1)", testScore: 0 }),
        expect.objectContaining({
          attemptNumber: 2,
          isSelected: true,
          sourceCode: "print(2)",
          testScore: 2,
          tests: [expect.objectContaining({ passed: true, score: 2, maxScore: 2 })]
        })
      ]
    });
  });

  it("does not expose a report unless the student's gradebook item is released", async () => {
    mocks.gradebookItemFindFirst.mockResolvedValue(null);

    await expect(getCodingExerciseStudentGradeReport({
      user: student,
      courseId: "course-1",
      groupId: "group-1",
      activityId: "activity-1",
      gradebookItemId: "gradebook-item-1",
      selectedAttemptId: null
    })).resolves.toBeNull();
    expect(mocks.attemptFindMany).not.toHaveBeenCalled();
    expect(mocks.executionFindMany).not.toHaveBeenCalled();
  });
});
