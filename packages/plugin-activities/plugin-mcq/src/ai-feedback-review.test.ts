import { describe, expect, it } from "vitest";
import { reviseMcqAiFeedback } from "./ai-feedback";

const current = {
  kind: "ai_assessment_feedback",
  summary: "Original",
  questionFeedback: [
    { questionId: "question-1", explanation: "Original explanation" }
  ],
  deterministicScore: 1,
  deterministicMaxScore: 2,
  gradingEnabled: false
};

describe("MCQ feedback revision", () => {
  it("accepts teacher-authored feedback when no generated explanations exist", () => {
    expect(reviseMcqAiFeedback({
      kind: "assessment_feedback",
      summary: "",
      questionFeedback: []
    }, {
      summary: "Review the distinction between the two concepts.",
      questionFeedback: []
    })).toMatchObject({
      kind: "assessment_feedback",
      summary: "Review the distinction between the two concepts.",
      questionFeedback: []
    });
  });

  it("edits explanations without changing deterministic grading", () => {
    expect(reviseMcqAiFeedback(current, {
      ...current,
      summary: "Reviewed",
      deterministicScore: 2,
      questionFeedback: [{ questionId: "question-1", explanation: "Reviewed explanation" }]
    })).toMatchObject({
      summary: "Reviewed",
      questionFeedback: [{ questionId: "question-1", explanation: "Reviewed explanation" }],
      deterministicScore: 1,
      deterministicMaxScore: 2,
      gradingEnabled: false
    });
  });

  it("rejects a revision that changes the question set", () => {
    expect(() => reviseMcqAiFeedback(current, {
      summary: "Reviewed",
      questionFeedback: [{ questionId: "question-2", explanation: "No" }]
    })).toThrow("original questions");
  });
});
