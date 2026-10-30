import { describe, expect, it } from "vitest";
import { studentTestFeedback } from "./student-test-feedback";

const item = { testItemId: "question-1", activityId: "activity-1", activityTypeKey: "parsons-problem", title: "Submitted title", pointsPossible: 10 };

describe("released Test feedback projection", () => {
  it("includes every frozen question, deterministic feedback and revised comments without private result data", () => {
    const projected = studentTestFeedback({ studentFeedback: { feedbackText: "Overall comment" } }, {
      metadata: { manifest: { items: [{ ...item, title: "Old title" }] }, submissionManifest: { items: [item, { ...item, testItemId: "question-2" }] } },
      testItemAttempts: [{ testItemId: item.testItemId, normalizedScore: 7, normalizedMaxScore: 10,
        feedback: { feedbackText: "Teacher comment", aiFeedback: { summary: "Reviewed", criteria: [{ title: "Reasoning", scorePercent: 70, feedback: "Explain this" }] } },
        result: { state: { secret: "private-answer" }, configSnapshot: { solution: "private-solution" }, analyticsPayload: { secret: "private-diagnostics" },
          metadata: { secret: "private-metadata", studentFeedback: { kind: "parsons", details: { grading: [{ type: "order", awardedRaw: 0.7, possibleRaw: 0.7 }] } } } } }]
    });
    expect(projected).toMatchObject({ studentFeedback: { kind: "test", feedbackText: "Overall comment", details: { items: [
      { title: "Submitted title", pointsEarned: 7, feedback: { feedbackText: "Teacher comment", studentFeedback: { kind: "parsons" }, aiFeedback: { criteria: [{ scorePercent: 70 }] } } },
      { testItemId: "question-2", pointsEarned: null, pointsPossible: 10 }
    ] } } });
    expect(JSON.stringify(projected)).not.toContain("private-");
  });

  it("retains legacy feedback when no submitted manifest is available", () => {
    const original = { studentFeedback: { kind: "test", details: { items: [item] } } };
    expect(studentTestFeedback(original, null)).toBe(original);
    expect(studentTestFeedback(original, { metadata: {}, testItemAttempts: [] })).toBe(original);
  });
});
