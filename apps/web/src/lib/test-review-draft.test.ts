import { describe, expect, it } from "vitest";
import { getCodingExerciseGradingBreakdown } from "@cognelo/plugin-coding-exercises";
import type { CourseTestAttemptReview, TestItemTeacherReview } from "./api";
import { calculatedTestReviewTotal, createTestItemReviewDraft, isTestItemReviewDirty, testItemReviewPatch,
  testReviewItemScore, updateTestItemReviewFeedback } from "./test-review-draft";

const feedback = (score: number) => ({ gradingEnabled: true, deterministicScore: 100, testWeightPercent: 30, aiWeightPercent: 70,
  summary: "Original", criteria: [{ id: "quality", scorePercent: score, weightPercent: 100, feedback: "Original" }] });
const calculate = (_type: string, value: Record<string, unknown>) => getCodingExerciseGradingBreakdown(value)?.totalGrade ?? null;
const review = (overrides: Partial<TestItemTeacherReview> = {}): TestItemTeacherReview => ({
  testItemId: "one", activityTypeKey: "coding-exercise", submission: {}, feedback: feedback(80), feedbackHash: "hash",
  feedbackText: "", score: 34.4, maxScore: 40, manuallyGraded: false, updatedAt: "2026-10-28T12:00:00.000Z",
  gradesReleased: false, readOnly: false, ...overrides
});
const item = (id: string, score: number | null, points: number): CourseTestAttemptReview["items"][number] => ({
  testItemId: id, activityId: id, activityTypeKey: "coding-exercise", title: id, pointsPossible: points,
  activity: {} as CourseTestAttemptReview["items"][number]["activity"], itemAttempt: {
    id, updatedAt: "2026-10-28T12:00:00.000Z", manuallyGraded: false, lifecycle: score === null ? "submitted" : "graded",
    rawScore: score, rawMaxScore: points, normalizedScore: score, normalizedMaxScore: points, state: {}, feedback: {}
  }
});

describe("whole-Test review drafts", () => {
  it("updates the question and scaled Test total immediately from the real plugin rubric calculation", () => {
    const original = createTestItemReviewDraft(review());
    const edited = updateTestItemReviewFeedback(original, feedback(100), calculate);
    expect(edited.score).toBe("40");
    expect(isTestItemReviewDirty(edited)).toBe(true);
    expect(testItemReviewPatch(edited)).toMatchObject({ feedback: feedback(100), expectedFeedbackHash: "hash" });
    expect(testItemReviewPatch(edited)).not.toHaveProperty("score");
    expect(calculatedTestReviewTotal([item("one", 34.4, 40), item("two", 30, 60)], { one: edited }, 20)).toBe(14);
    expect(original.score).toBe("34.40");
  });

  it("replaces a previous item override on a rubric edit, but retains an explicitly edited draft grade", () => {
    const original = createTestItemReviewDraft(review({ manuallyGraded: true, score: 20 }));
    const edited = updateTestItemReviewFeedback(original, feedback(100), calculate);
    expect(edited.score).toBe("40");
    expect(testItemReviewPatch(edited)).toHaveProperty("useRubricScore", true);
    const explicit = updateTestItemReviewFeedback({ ...original, score: "25", gradeTouched: true }, feedback(100), calculate);
    expect(explicit.score).toBe("25");
    expect(testItemReviewPatch(explicit)).toHaveProperty("score", 25);
    expect(testItemReviewPatch(explicit)).not.toHaveProperty("useRubricScore");
  });

  it("keeps unchanged grades and does not create overrides when only comments change", () => {
    const original = createTestItemReviewDraft(review({ manuallyGraded: true, score: 20 }));
    const edited = updateTestItemReviewFeedback(original, { ...feedback(80), summary: "New comment" }, calculate);
    expect(edited.score).toBe("20");
    expect(testItemReviewPatch(edited)).not.toHaveProperty("score");
    expect(testItemReviewPatch(edited)).not.toHaveProperty("useRubricScore");
    expect(isTestItemReviewDirty(createTestItemReviewDraft(review()))).toBe(false);
  });

  it("preserves separate question drafts and includes every edited question in the total", () => {
    const drafts = {
      one: updateTestItemReviewFeedback(createTestItemReviewDraft(review()), feedback(100), calculate),
      two: createTestItemReviewDraft(review({ testItemId: "two", score: 0, maxScore: 60 }))
    };
    drafts.two = { ...drafts.two, score: "45", gradeTouched: true };
    expect(calculatedTestReviewTotal([item("one", 34.4, 40), item("two", 0, 60)], drafts, 100)).toBe(85);
    expect(Object.values(drafts).filter(isTestItemReviewDirty)).toHaveLength(2);
    expect(drafts.one.feedback).toEqual(feedback(100));
  });

  it("keeps missing and invalid grades unknown instead of treating them as zero", () => {
    expect(calculatedTestReviewTotal([item("one", 0, 40), item("two", null, 60)], {}, 100)).toBeNull();
    const draft = { ...createTestItemReviewDraft(review()), score: "", gradeTouched: true };
    expect(testReviewItemScore(item("one", 34.4, 40), draft)).toBeNull();
  });

  it("does not round each calculated question before summing the Test", () => {
    const f = { gradingEnabled: true, testWeightPercent: 0, aiWeightPercent: 100,
      criteria: [{ id: "quality", scorePercent: 0, weightPercent: 100 }] };
    const draft = updateTestItemReviewFeedback(createTestItemReviewDraft(review({ score: 0, maxScore: 3, feedback: f })),
      { ...f, criteria: [{ id: "quality", scorePercent: 33.33, weightPercent: 100 }] }, calculate);
    expect(draft.score).toBe("1.00");
    expect(calculatedTestReviewTotal([item("one", 0, 3), item("two", 0, 3)], { one: draft, two: draft }, 100)).toBe(33.33);
  });

  it("restores the original override when the rubric edit is undone", () => {
    const original = createTestItemReviewDraft(review({ manuallyGraded: true, score: 20 }));
    const edited = updateTestItemReviewFeedback(original, feedback(100), calculate);
    const restored = updateTestItemReviewFeedback(edited, feedback(80), calculate);
    expect(restored.score).toBe("20");
    expect(restored.useRubricScore).toBe(false);
    expect(isTestItemReviewDirty(restored)).toBe(false);
  });
});
