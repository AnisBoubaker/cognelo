import type { CourseGradebookRow, CourseTestAttemptReview } from "@/lib/api";

export type TestReviewAllSubmission = {
  participantId: string;
  participantName: string;
  groupTitle: string;
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

export function latestCompletedTestAttempt(row: CourseGradebookRow) {
  return row.attempts.reduce<(typeof row.attempts)[number] | null>((latest, attempt) => {
    if (attempt.lifecycle !== "graded" && attempt.lifecycle !== "submitted") return latest;
    return !latest || attempt.attemptNumber > latest.attemptNumber ? attempt : latest;
  }, null);
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
