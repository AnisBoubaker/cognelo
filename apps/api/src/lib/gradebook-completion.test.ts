import { beforeEach, describe, expect, it, vi } from "vitest";

const sdkMocks = vi.hoisted(() => ({
  resolvePluginGradeCompletionHandler: vi.fn()
}));

vi.mock("@cognelo/activity-sdk/server", () => sdkMocks);

const { resolveCourseGradebookCompletions } = await import("./gradebook-completion");

const user = {
  id: "teacher-1",
  email: "teacher@example.test",
  name: "Teacher",
  firstName: "Ada",
  lastName: "Teacher",
  roles: ["teacher" as const]
};

describe("gradebook completion resolution", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("marks plugin grades partial, submitted grades ungraded, and non-submissions as releasable", async () => {
    sdkMocks.resolvePluginGradeCompletionHandler.mockImplementation((activityTypeKey: string) =>
      activityTypeKey === "coding-exercise"
        ? async ({ rows }: { rows: Array<{ participantId: string }> }) => Object.fromEntries(rows.map((row) => [
            row.participantId,
            { status: "partial", completedComponentCount: 1, requiredComponentCount: 2 }
          ]))
        : null
    );
    const gradebook = {
      filters: { groupId: null, activityId: null, status: "all" },
      groups: [{ id: "group-1", title: "Group" }],
      activities: [{ id: "activity-1", title: "Loops" }],
      items: [{
        gradebookItemId: "item-1",
        groupId: "group-1",
        groupTitle: "Group",
        activityId: "activity-1",
        activityTitle: "Loops",
        activityTypeKey: "coding-exercise",
        activityTypeName: "Programming exercise",
        assessmentMode: "summative",
        gradesReleased: false,
        pointsPossible: 100,
        studentCount: 3
      }],
      rows: [
        row({ participantId: "participant-1", score: 60, submittedAttemptCount: 1 }),
        row({ participantId: "participant-2", score: null, submittedAttemptCount: 1, needsGradingCount: 1 }),
        row({ participantId: "participant-3", score: null, submittedAttemptCount: 0 })
      ]
    };

    const result = await resolveCourseGradebookCompletions(user, "course-1", gradebook as never);

    expect(result.rows.map((entry) => entry.gradeCompletion)).toEqual([
      { status: "partial", completedComponentCount: 1, requiredComponentCount: 2 },
      { status: "ungraded", completedComponentCount: 0, requiredComponentCount: 1 },
      null
    ]);
    expect(result.rows[0]).not.toHaveProperty("gradeCompletionContext");
    expect(result.items[0]).toMatchObject({ incompleteGradeCount: 2, canReleaseGrades: false });
  });

  it("keeps formative submissions outside grade-completion and release readiness", async () => {
    const gradebook = {
      filters: { groupId: null, activityId: null, status: "all" },
      groups: [{ id: "group-1", title: "Group" }],
      activities: [{ id: "activity-1", title: "Practice" }],
      items: [{
        gradebookItemId: "item-1",
        groupId: "group-1",
        groupTitle: "Group",
        activityId: "activity-1",
        activityTitle: "Practice",
        activityTypeKey: "coding-exercise",
        activityTypeName: "Programming exercise",
        assessmentMode: "formative",
        gradesReleased: false,
        pointsPossible: 100,
        studentCount: 1
      }],
      rows: [row({ assessmentMode: "formative", score: null, submittedAttemptCount: 2, needsGradingCount: 0 })]
    };

    const result = await resolveCourseGradebookCompletions(user, "course-1", gradebook as never);

    expect(result.rows[0]?.gradeCompletion).toBeNull();
    expect(result.items[0]).toMatchObject({ incompleteGradeCount: 0, canReleaseGrades: true });
    expect(sdkMocks.resolvePluginGradeCompletionHandler).not.toHaveBeenCalled();
  });
});

function row(overrides: Record<string, unknown>) {
  return {
    gradebookItemId: "item-1",
    groupId: "group-1",
    groupTitle: "Group",
    activityId: "activity-1",
    activityTitle: "Loops",
    activityTypeKey: "coding-exercise",
    activityTypeName: "Programming exercise",
    assessmentMode: "summative",
    gradesReleased: false,
    participantId: "participant-1",
    participantName: "Student",
    participantEmail: "student@example.test",
    externalId: null,
    status: "graded",
    score: 60,
    maxScore: 100,
    gradeSource: "auto",
    isPass: true,
    latePenaltyApplied: false,
    latePenaltyPercent: null,
    feedback: null,
    gradeCompletionContext: { gradingResult: { kind: "coding-exercise" } },
    selectedAttemptNumber: 1,
    attemptCount: 1,
    lateAttemptCount: 0,
    submittedAttemptCount: 1,
    needsGradingCount: 0,
    deletedSubmissions: [],
    attempts: [],
    ...overrides
  };
}
