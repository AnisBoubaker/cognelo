import type { CourseGradebookRow, CourseTestAttemptReview } from "@/lib/api";

export type TestReviewAllSubmission = {
  participantId: string;
  participantName: string;
  groupTitle: string;
  durationSeconds: number | null;
  isLate: boolean;
  review: CourseTestAttemptReview;
};

export type TestReviewAllResponse = {
  participantId: string;
  participantName: string;
  groupTitle: string;
  item: CourseTestAttemptReview["items"][number];
};

export type TestReviewAllItemContext = {
  item: CourseTestAttemptReview["items"][number];
  responses: TestReviewAllResponse[];
  t: (key: string, params?: Record<string, string | number>) => string;
};

export type NumericSummary = {
  count: number;
  mean: number | null;
  median: number | null;
  minimum: number | null;
  maximum: number | null;
  standardDeviation: number | null;
};

export type TestActivityReportSummary = {
  testItemId: string;
  title: string;
  activityTypeKey: string;
  responseCount: number;
  scores: NumericSummary;
};

export type TestReportSummary = {
  participantCount: number;
  submissionCount: number;
  completionRate: number | null;
  gradedCount: number;
  scores: NumericSummary;
  durations: NumericSummary;
  lateSubmissionCount: number;
  activities: TestActivityReportSummary[];
};

export type McqQuestionResponseSummary = {
  responseCount: number;
  answeredCount: number;
  correctCount: number;
  incorrectCount: number;
  unansweredCount: number;
  correctRate: number | null;
};

export function latestCompletedTestAttempt(row: CourseGradebookRow) {
  return row.attempts.reduce<(typeof row.attempts)[number] | null>((latest, attempt) => {
    if (attempt.lifecycle !== "graded" && attempt.lifecycle !== "submitted") return latest;
    return !latest || attempt.attemptNumber > latest.attemptNumber ? attempt : latest;
  }, null);
}

export function summarizeNumbers(values: number[]): NumericSummary {
  const finiteValues = values.filter(Number.isFinite).sort((left, right) => left - right);
  if (!finiteValues.length) {
    return { count: 0, mean: null, median: null, minimum: null, maximum: null, standardDeviation: null };
  }
  const sum = finiteValues.reduce((total, value) => total + value, 0);
  const mean = sum / finiteValues.length;
  const middle = Math.floor(finiteValues.length / 2);
  const median = finiteValues.length % 2
    ? finiteValues[middle]
    : (finiteValues[middle - 1] + finiteValues[middle]) / 2;
  const variance = finiteValues.reduce((total, value) => total + (value - mean) ** 2, 0) / finiteValues.length;
  return {
    count: finiteValues.length,
    mean,
    median,
    minimum: finiteValues[0],
    maximum: finiteValues[finiteValues.length - 1],
    standardDeviation: Math.sqrt(variance)
  };
}

export function buildTestReportSummary(
  submissions: TestReviewAllSubmission[],
  participantCount: number
): TestReportSummary {
  const referenceItems = submissions[0]?.review.items ?? [];
  const scorePercentages = submissions.flatMap((submission) => {
    const percentage = testScorePercentage(submission.review);
    return percentage === null ? [] : [percentage];
  });
  return {
    participantCount,
    submissionCount: submissions.length,
    completionRate: participantCount > 0 ? (submissions.length / participantCount) * 100 : null,
    gradedCount: scorePercentages.length,
    scores: summarizeNumbers(scorePercentages),
    durations: summarizeNumbers(submissions.flatMap((submission) => submission.durationSeconds === null ? [] : [submission.durationSeconds])),
    lateSubmissionCount: submissions.filter((submission) => submission.isLate).length,
    activities: referenceItems.map((item) => {
      const responseItems = submissions.flatMap((submission) => {
        const responseItem = submission.review.items.find((candidate) => candidate.testItemId === item.testItemId);
        return responseItem ? [responseItem] : [];
      });
      return {
        testItemId: item.testItemId,
        title: item.title,
        activityTypeKey: item.activityTypeKey,
        responseCount: responseItems.length,
        scores: summarizeNumbers(responseItems.flatMap((responseItem) => {
          const percentage = itemScorePercentage(responseItem);
          return percentage === null ? [] : [percentage];
        }))
      };
    })
  };
}

export function itemScorePercentage(item: CourseTestAttemptReview["items"][number]) {
  const score = item.itemAttempt.normalizedScore;
  const maximum = item.itemAttempt.normalizedMaxScore;
  return score !== null && maximum !== null && maximum > 0 ? (score / maximum) * 100 : null;
}

export function testScorePercentage(review: CourseTestAttemptReview) {
  if (!review.items.length) return null;
  let score = 0;
  let maximum = 0;
  for (const item of review.items) {
    if (item.itemAttempt.normalizedScore === null || item.itemAttempt.normalizedMaxScore === null) return null;
    score += item.itemAttempt.normalizedScore;
    maximum += item.itemAttempt.normalizedMaxScore;
  }
  return maximum > 0 ? (score / maximum) * 100 : null;
}

export function summarizeMcqQuestionResponses(
  responses: TestReviewAllResponse[],
  questionId: string,
  correctChoiceIds: string[]
): McqQuestionResponseSummary {
  const expected = [...new Set(correctChoiceIds)].sort();
  let answeredCount = 0;
  let correctCount = 0;
  for (const response of responses) {
    const selected = [...new Set(asStudentAnswers(response.item.itemAttempt.state.answers)[questionId] ?? [])].sort();
    if (selected.length) answeredCount += 1;
    if (expected.length > 0 && selected.length === expected.length && selected.every((choiceId, index) => choiceId === expected[index])) {
      correctCount += 1;
    }
  }
  const unansweredCount = responses.length - answeredCount;
  return {
    responseCount: responses.length,
    answeredCount,
    correctCount,
    incorrectCount: responses.length - correctCount - unansweredCount,
    unansweredCount,
    correctRate: responses.length ? (correctCount / responses.length) * 100 : null
  };
}

export function respondentsForMcqChoice(
  responses: TestReviewAllResponse[],
  questionId: string,
  choiceId: string
) {
  return responses.filter((response) => {
    const answers = asStudentAnswers(response.item.itemAttempt.state.answers);
    return answers[questionId]?.includes(choiceId) === true;
  });
}

function asStudentAnswers(value: unknown): Record<string, string[]> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value).flatMap(([questionId, choiceIds]) =>
      Array.isArray(choiceIds) && choiceIds.every((choiceId) => typeof choiceId === "string")
        ? [[questionId, choiceIds as string[]]]
        : []
    )
  );
}
