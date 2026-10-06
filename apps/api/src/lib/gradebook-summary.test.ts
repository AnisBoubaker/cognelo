import { describe, expect, it } from "vitest";
import { summarizeCourseGradebook } from "./gradebook-summary";

describe("summarizeCourseGradebook", () => {
  it("returns course and group aggregates without detailed learner rows or attempts", () => {
    const summary = summarizeCourseGradebook({
      filters: { groupId: null, activityId: null, status: "all" },
      groups: [
        { id: "group-b", title: "Section B" },
        { id: "group-a", title: "Section A" }
      ],
      activities: [{ id: "activity-1", title: "Loops" }],
      items: [
        {
          gradebookItemId: "item-b",
          groupId: "group-b",
          groupTitle: "Section B",
          activityId: "activity-1",
          activityTitle: "Loops",
          activityTypeKey: "coding-exercise",
          activityTypeName: "Programming exercise",
          assessmentMode: "summative",
          gradesReleased: false,
          pointsPossible: 20,
          studentCount: 1,
          incompleteGradeCount: 1,
          canReleaseGrades: false
        },
        {
          gradebookItemId: "item-a",
          groupId: "group-a",
          groupTitle: "Section A",
          activityId: "activity-1",
          activityTitle: "Loops",
          activityTypeKey: "coding-exercise",
          activityTypeName: "Programming exercise",
          assessmentMode: "summative",
          gradesReleased: true,
          pointsPossible: 20,
          studentCount: 2,
          incompleteGradeCount: 0,
          canReleaseGrades: true
        }
      ],
      rows: [
        gradebookRow({
          gradebookItemId: "item-a",
          groupId: "group-a",
          groupTitle: "Section A",
          participantId: "participant-1",
          score: 18,
          submittedAttemptCount: 2
        }),
        gradebookRow({
          gradebookItemId: "item-a",
          groupId: "group-a",
          groupTitle: "Section A",
          participantId: "participant-2",
          score: null,
          submittedAttemptCount: 0
        }),
        gradebookRow({
          gradebookItemId: "item-b",
          groupId: "group-b",
          groupTitle: "Section B",
          participantId: "participant-3",
          score: 10,
          submittedAttemptCount: 1,
          gradeCompletion: { status: "partial", completedComponentCount: 1, requiredComponentCount: 2 }
        })
      ]
    } as Parameters<typeof summarizeCourseGradebook>[0]);

    expect(summary.overview).toEqual({
      activityCount: 1,
      submissionCount: 3,
      gradedCount: 2,
      meanScore: 14,
      meanMaxScore: 20
    });
    expect(summary.activitySummaries).toEqual([
      expect.objectContaining({
        activityId: "activity-1",
        gradebookItemIds: ["item-b", "item-a"],
        allGradesReleased: false,
        submissionCount: 3,
        gradedCount: 2,
        incompleteGradeCount: 1,
        meanScore: 14,
        meanMaxScore: 20,
        groups: [
          expect.objectContaining({ groupId: "group-a", submissionCount: 2, gradedCount: 1, meanScore: 18 }),
          expect.objectContaining({ groupId: "group-b", submissionCount: 1, gradedCount: 1, meanScore: 10 })
        ]
      })
    ]);
    expect(JSON.stringify(summary)).not.toContain("participant-1");
    expect(JSON.stringify(summary)).not.toContain("attempt-secret");
  });
});

function gradebookRow(overrides: {
  gradebookItemId: string;
  groupId: string;
  groupTitle: string;
  participantId: string;
  score: number | null;
  submittedAttemptCount: number;
  gradeCompletion?: { status: "complete" | "partial" | "ungraded"; completedComponentCount: number; requiredComponentCount: number };
}) {
  return {
    gradebookItemId: overrides.gradebookItemId,
    groupId: overrides.groupId,
    groupTitle: overrides.groupTitle,
    activityId: "activity-1",
    activityTitle: "Loops",
    activityTypeKey: "coding-exercise",
    activityTypeName: "Programming exercise",
    assessmentMode: "summative" as const,
    gradesReleased: overrides.groupId === "group-a",
    participantId: overrides.participantId,
    participantName: "Private learner",
    participantEmail: "private@example.invalid",
    participantFirstName: "Private",
    participantLastName: "Learner",
    externalId: null,
    status: overrides.score === null ? "missing" as const : "graded" as const,
    score: overrides.score,
    maxScore: 20,
    gradeSource: overrides.score === null ? null : "auto" as const,
    isPass: overrides.score === null ? null : true,
    latePenaltyApplied: false,
    latePenaltyPercent: null,
    feedback: null,
    selectedAttemptNumber: overrides.score === null ? null : 1,
    attemptCount: overrides.submittedAttemptCount,
    lateAttemptCount: 0,
    submittedAttemptCount: overrides.submittedAttemptCount,
    needsGradingCount: 0,
    deletedSubmissions: [],
    attempts: overrides.submittedAttemptCount
      ? [{
          id: "attempt-secret",
          attemptNumber: 1,
          lifecycle: "graded" as const,
          pluginAttemptRef: "plugin-secret",
          assessmentMode: "summative" as const,
          startedAt: "2026-10-03T00:00:00.000Z",
          submittedAt: "2026-10-03T00:01:00.000Z",
          gradedAt: "2026-10-03T00:01:01.000Z",
          isLate: false,
          lateBySeconds: null,
          durationSeconds: 60
        }]
      : [],
    gradeCompletion: overrides.gradeCompletion ?? (overrides.score === null
      ? null
      : { status: "complete" as const, completedComponentCount: 1, requiredComponentCount: 1 })
  };
}
