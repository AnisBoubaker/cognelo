import { describe, expect, it } from "vitest";
import type { CourseGradebookRow, CourseTestAttemptReview } from "./api";
import {
  buildTestReportSummary,
  latestCompletedTestAttempt,
  respondentsForMcqChoice,
  summarizeMcqQuestionResponses,
  summarizeNumbers,
  type TestReviewAllResponse,
  type TestReviewAllSubmission
} from "./test-review-all";

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

  it("calculates descriptive statistics, including the population standard deviation", () => {
    expect(summarizeNumbers([90, 50, 70, Number.NaN])).toEqual({
      count: 3,
      mean: 70,
      median: 70,
      minimum: 50,
      maximum: 90,
      standardDeviation: 16.32993161855452
    });
    expect(summarizeNumbers([])).toEqual({
      count: 0,
      mean: null,
      median: null,
      minimum: null,
      maximum: null,
      standardDeviation: null
    });
  });

  it("summarizes exact MCQ answers and treats partial multiple-choice selections as incorrect", () => {
    const responses = [
      response("student-1", "Sam Student", { question1: ["choice-a", "choice-b"] }),
      response("student-2", "Alex Student", { question1: ["choice-a"] }),
      response("student-3", "Jo Student", { question1: [] })
    ];

    const summary = summarizeMcqQuestionResponses(responses, "question1", ["choice-a", "choice-b"]);
    expect(summary).toMatchObject({
      responseCount: 3,
      answeredCount: 2,
      correctCount: 1,
      incorrectCount: 1,
      unansweredCount: 1
    });
    expect(summary.correctRate).toBeCloseTo(100 / 3);
  });

  it("builds a plugin-neutral Test report from latest completed submissions", () => {
    const submissions = [
      testSubmission("student-1", 8, 10, 300, false),
      testSubmission("student-2", 5, 10, 420, true),
      testSubmission("student-3", null, 10, null, false)
    ];

    expect(buildTestReportSummary(submissions, 4)).toMatchObject({
      participantCount: 4,
      submissionCount: 3,
      completionRate: 75,
      gradedCount: 2,
      scores: { count: 2, mean: 65, median: 65, minimum: 50, maximum: 80, standardDeviation: 15 },
      durations: { count: 2, mean: 360, median: 360, minimum: 300, maximum: 420, standardDeviation: 60 },
      lateSubmissionCount: 1,
      activities: [{ responseCount: 3, scores: { count: 2, mean: 65 } }]
    });
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

function testSubmission(
  participantId: string,
  normalizedScore: number | null,
  normalizedMaxScore: number,
  durationSeconds: number | null,
  isLate: boolean
): TestReviewAllSubmission {
  const item = response(participantId, `Student ${participantId}`, {}).item;
  return {
    participantId,
    participantName: `Student ${participantId}`,
    groupTitle: "Saturday 3PM",
    durationSeconds,
    isLate,
    review: {
      id: `attempt-${participantId}`,
      attemptNumber: 1,
      lifecycle: normalizedScore === null ? "submitted" : "graded",
      submittedAt: "2026-08-07T12:00:00.000Z",
      gradedAt: normalizedScore === null ? null : "2026-08-07T12:01:00.000Z",
      items: [{
        ...item,
        itemAttempt: {
          ...item.itemAttempt,
          normalizedScore,
          normalizedMaxScore
        }
      }]
    }
  };
}
