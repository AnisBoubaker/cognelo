type TestFeedbackAttempt = {
  metadata: unknown;
  testItemAttempts?: Array<{
    testItemId: string;
    normalizedScore: number | null;
    normalizedMaxScore: number | null;
    feedback: unknown;
    result: unknown;
  }>;
};

// Project only the submitted manifest and explicitly student-facing feedback.
// This also restores details for grades released before the richer report existed.
export function studentTestFeedback(normalizedResult: unknown, attempt: TestFeedbackAttempt | null) {
  if (!attempt?.testItemAttempts) return normalizedResult;
  const metadata = record(attempt.metadata);
  const manifest = record(metadata.submissionManifest ?? metadata.manifest);
  if (!Array.isArray(manifest.items)) return normalizedResult;
  const previous = record(record(normalizedResult).studentFeedback);
  const children = new Map(attempt.testItemAttempts.map((child) => [child.testItemId, child]));
  const items = manifest.items.flatMap((value) => {
    const item = record(value);
    if (typeof item.testItemId !== "string") return [];
    const child = children.get(item.testItemId);
    return [{
      testItemId: item.testItemId,
      activityId: item.activityId,
      activityTypeKey: item.activityTypeKey,
      title: item.title,
      pointsEarned: child?.normalizedScore ?? null,
      pointsPossible: child?.normalizedMaxScore ?? item.pointsPossible,
      feedback: {
        studentFeedback: record(record(child?.result).metadata).studentFeedback,
        ...record(child?.feedback)
      }
    }];
  });
  return { studentFeedback: { kind: "test", feedbackText: previous.feedbackText ?? metadata.testReviewFeedbackText, details: { items } } };
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
