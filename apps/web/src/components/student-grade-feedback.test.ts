import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { messages } from "../lib/i18n/messages";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

const t = (key: string, values?: Record<string, string | number>) => {
  const text = key.split(".").reduce<unknown>((node, part) => (node as Record<string, unknown>)?.[part], messages.en);
  return Object.entries(values ?? {}).reduce((result, [name, value]) => result.replace(`{${name}}`, String(value)), String(text));
};
vi.mock("../lib/i18n", () => ({ useI18n: () => ({ t, locale: "en" }) }));
vi.mock("@cognelo/plugin-coding-exercises", async () => import("../../../../packages/plugin-activities/plugin-coding-exercises/src/web/coding-exercise-student-grade-report"));
const { StudentGradeFeedbackView } = await import("./student-grade-feedback");
const { parseTestBreakdown } = await import("./test-grade-breakdown");

describe("student grading details", () => {
  it("renders all exercise comments, criteria, strengths and improvements, including a zero grade", () => {
    const html = renderToStaticMarkup(React.createElement(StudentGradeFeedbackView, { maxScore: 20, t,
      feedback: { kind: "test", feedbackText: "Overall feedback", details: { items: [
        { testItemId: "first", title: "Program one", activityTypeKey: "coding-exercise", pointsEarned: 0, pointsPossible: 10,
          feedback: { feedbackText: "Item comment", aiFeedback: { gradingEnabled: true, aiWeightPercent: 100, testWeightPercent: 0, aiScore: 0,
            summary: "First summary", strengths: ["Clear naming"], improvements: ["Check edge cases"],
            criteria: [{ id: "criterion", title: "Correctness", weightPercent: 100, scorePercent: 0, feedback: "Criterion explanation" }] } } },
        { testItemId: "second", title: "Choices", activityTypeKey: "mcq", pointsEarned: 5, pointsPossible: 10,
          feedback: { aiFeedback: { summary: "Second summary", questionFeedback: [{ questionId: "q", explanation: "Choice explanation" }] },
            studentFeedback: { kind: "mcq", details: { correctCount: 1, questionCount: 2 } } } }
      ] } }
    }));
    for (const text of ["Overall feedback", "Program one", "0 / 10", "Item comment", "First summary", "Clear naming", "Check edge cases", "Criterion explanation", "Second summary", "Choice explanation", "Correct answers: 1 / 2"]) expect(html).toContain(text);
    expect(html.match(/<details/g)).toHaveLength(2);
  });

  it("scales Parsons component scores to the exercise points and retains ungraded questions", () => {
    const feedback = { kind: "test", details: { items: [
      { testItemId: "first", title: "Arrange", pointsEarned: 7, pointsPossible: 10, feedback: { studentFeedback: { kind: "parsons", details: {
        messages: [{ type: "indentation", count: 2 }], grading: [{ type: "order", awardedRaw: 0.7, possibleRaw: 0.7 }, { type: "indentation", awardedRaw: 0, possibleRaw: 0.3 }]
      } } } }, { testItemId: "second", title: "Pending", pointsEarned: null, pointsPossible: 5 }
    ] } };
    expect(parseTestBreakdown(feedback)).toHaveLength(2);
    const html = renderToStaticMarkup(React.createElement(StudentGradeFeedbackView, { feedback, maxScore: 20, t }));
    expect(html).toContain("Order: 7 / 7");
    expect(html).toContain("Indentation: 0 / 3");
    expect(html).toContain("Not graded yet");
  });
});
