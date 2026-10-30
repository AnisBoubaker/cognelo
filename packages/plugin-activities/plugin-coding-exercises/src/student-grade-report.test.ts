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
  it("resolves only the selected learner-owned Test child and validates legacy execution source", async () => {
    const input = { user: student, courseId: "course-1", groupId: "group-1", activityId: "program-1",
      gradebookItemId: "test-grade", selectedAttemptId: "parent-1", testItemId: "child-1" };
    const submittedAt = new Date("2026-10-01T12:00:00Z");
    mocks.attemptFindMany.mockResolvedValue([{ id: "parent-1", attemptNumber: 2, submittedAt, pluginAttemptRef: "parent-1",
      testItemAttempts: [{ pluginAttemptRef: null, result: { state: { executionId: "execution-1", sourceCode: "print(1)" } } }] }]);
    mocks.executionFindMany.mockResolvedValue([{ id: "execution-1", sourceCode: "print(1)", languageKey: "python", resultSummary: {}, updatedAt: submittedAt }]);
    mocks.latestTests.mockResolvedValue({ resultSummary: { earnedWeight: 1, totalWeight: 1,
      tests: [{ id: "test", passed: true, weight: 1, stdin: "secret-input", expectedOutput: "secret-output" }] } });
    const report = await getCodingExerciseStudentGradeReport(input);
    expect(report?.attempts).toEqual([expect.objectContaining({ attemptId: "parent-1", sourceCode: "print(1)", testScore: 1 })]);
    expect(JSON.stringify(report)).not.toContain("secret-");
    expect(mocks.gradebookItemFindFirst).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({
      id: "test-grade", gradesReleased: true, activity: { activityType: { key: "test" } }, grades: { some: { participantId: "participant-1", isActive: true } }
    }) }));
    expect(mocks.attemptFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: "parent-1", participantId: "participant-1", assessmentMode: "summative", gradebookItemId: "gradebook-item-1" }),
      select: expect.objectContaining({ testItemAttempts: expect.objectContaining({ where: { testItemId: "child-1", activityId: "program-1", lifecycle: { in: ["submitted", "graded"] } } }) })
    }));
    mocks.executionFindMany.mockResolvedValue([{ id: "execution-1", sourceCode: "different source", updatedAt: submittedAt }]);
    expect((await getCodingExerciseStudentGradeReport(input))?.attempts).toEqual([]);
    mocks.attemptFindMany.mockResolvedValue([{ id: "parent-1", testItemAttempts: [] }]);
    expect((await getCodingExerciseStudentGradeReport(input))?.attempts).toEqual([]);
    mocks.gradebookItemFindFirst.mockResolvedValue(null);
    expect(await getCodingExerciseStudentGradeReport(input)).toBeNull();
  });

});
