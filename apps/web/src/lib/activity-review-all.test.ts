import { describe, expect, it } from "vitest";
import {
  codingRubricResultsFromFeedback,
  summarizeCodingRubricCriterion,
  type CodingRubricResult
} from "./activity-review-all";

describe("programming exercise class-overview rubrics", () => {
  it("reads the current teacher-visible rubric scores and ignores malformed values", () => {
    expect(codingRubricResultsFromFeedback({
      kind: "assessment_feedback",
      details: {
        criteria: [
          { id: "correctness", scorePercent: 92.345, feedback: "Strong." },
          { criterionId: "quality", scorePercent: 75 },
          { id: "invalid-low", scorePercent: -1 },
          { id: "invalid-high", scorePercent: 101 },
          { id: "missing-score" },
          { id: "correctness", scorePercent: 10 }
        ]
      }
    })).toEqual([
      { criterionId: "correctness", scorePercent: 92.35 },
      { criterionId: "quality", scorePercent: 75 }
    ]);
    expect(codingRubricResultsFromFeedback(null)).toEqual([]);
  });

  it("summarizes the class average and score bands without counting ungraded learners", () => {
    const responses: Array<{ name: string; rubricResults?: CodingRubricResult[] }> = [
      { name: "Ada", rubricResults: [{ criterionId: "correctness", scorePercent: 100 }] },
      { name: "Grace", rubricResults: [{ criterionId: "correctness", scorePercent: 72 }] },
      { name: "Linus", rubricResults: [{ criterionId: "correctness", scorePercent: 38 }] },
      { name: "Barbara", rubricResults: [{ criterionId: "correctness", scorePercent: 19.5 }] },
      { name: "Margaret", rubricResults: [] },
      { name: "Edsger" }
    ];

    const summary = summarizeCodingRubricCriterion(responses, "correctness");
    expect(summary.average).toBe(57.38);
    expect(summary.count).toBe(4);
    expect(summary.bands.map((band) => band.responses.map(({ response }) => response.name))).toEqual([
      ["Barbara"],
      ["Linus"],
      [],
      ["Grace"],
      ["Ada"]
    ]);
    expect(summarizeCodingRubricCriterion(responses, "quality")).toMatchObject({ average: null, count: 0 });
  });
});
