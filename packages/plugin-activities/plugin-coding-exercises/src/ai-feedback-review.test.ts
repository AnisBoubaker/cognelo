import { describe, expect, it } from "vitest";
import { reviseCodingExerciseAiFeedback } from "./ai-feedback";

const current = {
  kind: "ai_assessment_feedback",
  summary: "Original",
  strengths: ["One"],
  improvements: ["Two"],
  criteria: [
    { id: "correctness", title: "Correctness", weightPercent: 100, scorePercent: 90, feedback: "Original criterion feedback" }
  ],
  deterministicScore: 100,
  aiScore: 90,
  combinedScore: 96,
  gradingEnabled: true,
  testWeightPercent: 60,
  aiWeightPercent: 40
};

describe("coding exercise feedback revision", () => {
  it("accepts teacher-authored narrative when no generated rubric feedback exists", () => {
    expect(reviseCodingExerciseAiFeedback({
      kind: "assessment_feedback",
      summary: "",
      strengths: [],
      improvements: [],
      criteria: []
    }, {
      summary: "Your approach is clear, but the output format needs correction.",
      strengths: ["Readable control flow"],
      improvements: ["Match the required output exactly"],
      criteria: []
    })).toMatchObject({
      kind: "assessment_feedback",
      summary: "Your approach is clear, but the output format needs correction.",
      criteria: []
    });
  });

  it("keeps empty narrative sections empty and consolidates each populated section", () => {
    expect(reviseCodingExerciseAiFeedback({
      kind: "assessment_feedback",
      summary: "",
      strengths: [],
      improvements: [],
      criteria: []
    }, {
      summary: "   ",
      strengths: ["Clear naming", "Small functions"],
      improvements: ["   "],
      criteria: []
    })).toMatchObject({
      summary: "",
      strengths: ["Clear naming\n\nSmall functions"],
      improvements: []
    });
  });

  it("edits narrative feedback and recomputes rubric and combined scores", () => {
    expect(reviseCodingExerciseAiFeedback(current, {
      ...current,
      summary: "Reviewed",
      criteria: [{ ...current.criteria[0], scorePercent: 0, feedback: "Reviewed criterion feedback" }]
    })).toMatchObject({
      summary: "Reviewed",
      criteria: [{ scorePercent: 0, feedback: "Reviewed criterion feedback" }],
      deterministicScore: 100,
      aiScore: 0,
      combinedScore: 60
    });
  });

  it("allows a teacher to score a configured rubric without writing criterion comments", () => {
    expect(reviseCodingExerciseAiFeedback(current, {
      ...current,
      criteria: [{ ...current.criteria[0], scorePercent: 75, feedback: "" }]
    })).toMatchObject({
      criteria: [{ scorePercent: 75, feedback: "" }],
      aiScore: 75,
      combinedScore: 90
    });
  });

  it("rejects a revision that changes the rubric criterion set", () => {
    expect(() => reviseCodingExerciseAiFeedback(current, {
      summary: "Reviewed",
      strengths: [],
      improvements: [],
      criteria: [{ id: "different", scorePercent: 50, feedback: "No" }]
    })).toThrow("original rubric criteria");
  });
});
