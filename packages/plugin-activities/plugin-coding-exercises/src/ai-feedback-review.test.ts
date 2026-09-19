import { describe, expect, it } from "vitest";
import { reviseCodingExerciseAiFeedback } from "./ai-feedback";

const current = {
  kind: "ai_assessment_feedback",
  summary: "Original",
  strengths: ["One"],
  improvements: ["Two"],
  criteria: [
    { id: "correctness", title: "Correctness", scorePercent: 90, feedback: "Original criterion feedback" }
  ],
  deterministicScore: 100,
  aiScore: 90,
  combinedScore: 96
};

describe("coding exercise feedback revision", () => {
  it("edits narrative feedback while preserving score components", () => {
    expect(reviseCodingExerciseAiFeedback(current, {
      ...current,
      summary: "Reviewed",
      criteria: [{ ...current.criteria[0], scorePercent: 0, feedback: "Reviewed criterion feedback" }]
    })).toMatchObject({
      summary: "Reviewed",
      criteria: [{ scorePercent: 90, feedback: "Reviewed criterion feedback" }],
      deterministicScore: 100,
      aiScore: 90,
      combinedScore: 96
    });
  });

  it("rejects a revision that changes the rubric criterion set", () => {
    expect(() => reviseCodingExerciseAiFeedback(current, {
      summary: "Reviewed",
      strengths: [],
      improvements: [],
      criteria: [{ id: "different", feedback: "No" }]
    })).toThrow("original rubric criteria");
  });
});
