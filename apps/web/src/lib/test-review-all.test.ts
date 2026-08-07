import { describe, expect, it } from "vitest";
import type { CourseGradebookRow, CourseTestAttemptReview } from "./api";
import { latestCompletedTestAttempt, respondentsForMcqChoice, type TestReviewAllResponse } from "./test-review-all";

describe("Test Review all aggregation", () => {
  it("selects the highest numbered completed attempt regardless of row ordering", () => {
    const row = {
      attempts: [
        { id: "attempt-3", attemptNumber: 3, lifecycle: "started" },
        { id: "attempt-2", attemptNumber: 2, lifecycle: "graded" },
        { id: "attempt-1", attemptNumber: 1, lifecycle: "submitted" }
      ]
    } as CourseGradebookRow;

    expect(latestCompletedTestAttempt(row)?.id).toBe("attempt-2");
  });

  it("returns only students who selected the requested MCQ choice", () => {
    const responses = [
      response("student-1", "Sam Student", { question1: ["choice-a", "choice-b"] }),
      response("student-2", "Alex Student", { question1: ["choice-b"] }),
      response("student-3", "Jo Student", { question1: [] })
    ];

    expect(respondentsForMcqChoice(responses, "question1", "choice-b").map((item) => item.participantName)).toEqual([
      "Sam Student",
      "Alex Student"
    ]);
    expect(respondentsForMcqChoice(responses, "question1", "choice-c")).toEqual([]);
  });
});

function response(participantId: string, participantName: string, answers: Record<string, string[]>): TestReviewAllResponse {
  return {
    participantId,
    participantName,
    groupTitle: "Saturday 3PM",
    item: {
      testItemId: "item-1",
      activityId: "activity-1",
      activityTypeKey: "mcq",
      title: "Questions",
      pointsPossible: 10,
      activity: {} as CourseTestAttemptReview["items"][number]["activity"],
      itemAttempt: {
        id: `item-attempt-${participantId}`,
        lifecycle: "graded",
        rawScore: null,
        rawMaxScore: null,
        normalizedScore: null,
        normalizedMaxScore: null,
        state: { answers },
        feedback: {}
      }
    }
  };
}
