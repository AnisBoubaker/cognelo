import type { CourseGradebookRow } from "./api";

export function deletableSubmissions(row: Pick<CourseGradebookRow, "attempts" | "assessmentMode">) {
  return row.attempts
    .filter((attempt) => attempt.assessmentMode === row.assessmentMode && (attempt.lifecycle === "submitted" || attempt.lifecycle === "graded"))
    .sort((left, right) => right.attemptNumber - left.attemptNumber);
}
