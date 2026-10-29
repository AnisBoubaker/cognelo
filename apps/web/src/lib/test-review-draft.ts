import type { TestItemReviewInput } from "@cognelo/contracts";
import type { CourseTestAttemptReview, TestItemTeacherReview } from "./api";

export type TestItemReviewDraft = {
  review: TestItemTeacherReview;
  feedback: Record<string, unknown> | null;
  feedbackText: string;
  score: string;
  calculatedScore: number | null;
  gradeTouched: boolean;
  useRubricScore: boolean;
};

export function formatTestReviewScore(value: number) { return Number.isInteger(value) ? String(value) : value.toFixed(2); }

export function createTestItemReviewDraft(review: TestItemTeacherReview): TestItemReviewDraft {
  return { review, feedback: review.feedback, feedbackText: review.feedbackText,
    score: review.score === null ? "" : formatTestReviewScore(review.score), calculatedScore: review.score,
    gradeTouched: false, useRubricScore: false };
}

export function parseTestReviewScore(value: string, max: number) {
  const score = value.trim() ? Number(value) : NaN;
  return Number.isFinite(score) && score >= 0 && score <= max ? score : null;
}

export function isTestItemReviewDirty(draft: TestItemReviewDraft) {
  return !draft.review.readOnly && (JSON.stringify(draft.feedback) !== JSON.stringify(draft.review.feedback)
    || draft.feedbackText !== draft.review.feedbackText || draft.useRubricScore
    || (draft.gradeTouched && draft.score !== (draft.review.score === null ? "" : formatTestReviewScore(draft.review.score))));
}

export function testReviewRubricScoresChanged(before: Record<string, unknown> | null, after: Record<string, unknown> | null) {
  const scores = (feedback: Record<string, unknown> | null) => Array.isArray(feedback?.criteria)
    ? feedback.criteria.map(value => {
      const criterion = value && typeof value === "object" ? value as Record<string, unknown> : {};
      return [criterion.id, criterion.scorePercent];
    }) : [];
  return JSON.stringify(scores(before)) !== JSON.stringify(scores(after));
}

export function updateTestItemReviewFeedback(draft: TestItemReviewDraft, feedback: Record<string, unknown>,
  calculate: (type: string, feedback: Record<string, unknown>) => number | null): TestItemReviewDraft {
  const next = calculate(draft.review.activityTypeKey, feedback);
  const previous = draft.feedback ? calculate(draft.review.activityTypeKey, draft.feedback) : null;
  const original = draft.review.feedback ? calculate(draft.review.activityTypeKey, draft.review.feedback) : null;
  const rubricChanged = testReviewRubricScoresChanged(draft.review.feedback, feedback);
  if (draft.gradeTouched || (next === previous && !testReviewRubricScoresChanged(draft.feedback, feedback))
    || (next === null && previous === null && original === null)) return { ...draft, feedback };
  const calculatedScore = !rubricChanged ? draft.review.score : next === null ? null
    : Math.round(next * 100) / 100 * draft.review.maxScore / 100;
  return { ...draft, feedback,
    calculatedScore, score: calculatedScore === null ? "" : formatTestReviewScore(calculatedScore),
    useRubricScore: draft.review.manuallyGraded && next !== null && rubricChanged };
}

export function testItemReviewPatch(draft: TestItemReviewDraft): TestItemReviewInput {
  const score = parseTestReviewScore(draft.score, draft.review.maxScore);
  return {
    expectedUpdatedAt: draft.review.updatedAt, expectedFeedbackHash: draft.review.feedbackHash,
    ...(JSON.stringify(draft.feedback) !== JSON.stringify(draft.review.feedback) ? { feedback: draft.feedback } : {}),
    ...(draft.feedbackText !== draft.review.feedbackText ? { feedbackText: draft.feedbackText } : {}),
    ...(draft.gradeTouched && score !== null ? { score } : {}),
    ...(!draft.gradeTouched && draft.useRubricScore ? { useRubricScore: true } : {})
  };
}

export function testReviewItemScore(item: CourseTestAttemptReview["items"][number], draft?: TestItemReviewDraft) {
  if (draft) return draft.gradeTouched ? parseTestReviewScore(draft.score, draft.review.maxScore) : draft.calculatedScore;
  return item.itemAttempt.lifecycle === "graded" ? item.itemAttempt.normalizedScore : null;
}

/** Unfinished grading remains unknown; it must not silently contribute a zero. */
export function calculatedTestReviewTotal(items: CourseTestAttemptReview["items"], drafts: Record<string, TestItemReviewDraft>, maxScore: number) {
  let earned = 0, possible = 0;
  for (const item of items) {
    const score = testReviewItemScore(item, drafts[item.testItemId]);
    if (score === null) return null;
    earned += score;
    possible += item.pointsPossible;
  }
  return possible > 0 ? Math.round(earned / possible * maxScore * 100) / 100 : null;
}
