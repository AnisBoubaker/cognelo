export function isCodingExerciseOperationalFailure(execution: {
  judge0StatusId?: number | null;
  resultSummary: unknown;
}) {
  if (execution.judge0StatusId === 13) return true;
  if (!execution.resultSummary || typeof execution.resultSummary !== "object" || Array.isArray(execution.resultSummary)) {
    return false;
  }

  const summary = execution.resultSummary as Record<string, unknown>;
  if (summary.phase === "failed-before-result") return true;
  if (!Array.isArray(summary.tests)) return false;
  return summary.tests.some(
    (test) => test !== null && typeof test === "object" && !Array.isArray(test) && (test as Record<string, unknown>).statusId === 13
  );
}
