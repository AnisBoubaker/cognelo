import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

vi.mock("@cognelo/activity-ui", () => ({
  CodeRenderer: ({ code }: { code: string }) => React.createElement("pre", null, code)
}));

const { CodingExerciseStudentGradeReport } = await import("./coding-exercise-student-grade-report");

const report = {
  kind: "coding-exercise",
  attempts: [{
    attemptId: "attempt-1",
    attemptNumber: 1,
    executionId: "execution-1",
    isSelected: true,
    submittedAt: "2026-09-26T12:00:00.000Z",
    language: "python",
    sourceCode: "print('answer')",
    testScore: 3,
    testMaxScore: 5,
    tests: [
      { id: "one", name: "First case", passed: true, score: 2, maxScore: 2, statusLabel: "Accepted", message: null },
      { id: "two", name: "Second case", passed: false, score: 0, maxScore: 3, statusLabel: "Wrong Answer", message: "Output differed." }
    ]
  }]
};

describe("coding exercise learner grading report", () => {
  it("shows a conditional component recap, teacher comments, rubric explanations, attempts, and test scores", () => {
    const html = renderToStaticMarkup(React.createElement(CodingExerciseStudentGradeReport, {
      score: 70,
      maxScore: 100,
      locale: "en",
      report,
      feedback: {
        kind: "assessment_feedback",
        feedbackText: "Teacher note.",
        details: {
          summary: "Solid approach.",
          strengths: ["Clear structure."],
          improvements: ["Handle edge cases."],
          deterministicScore: 60,
          aiScore: 85,
          gradingEnabled: true,
          testWeightPercent: 60,
          aiWeightPercent: 40,
          criteria: [{ id: "quality", title: "Code quality", weightPercent: 100, scorePercent: 85, feedback: "Readable and concise." }]
        }
      }
    }));

    expect(html).toContain("Grade recap");
    expect(html).toContain("36 / 60");
    expect(html).toContain("34 / 40");
    expect(html).toContain("70 / 100");
    expect(html).toContain("Teacher note.");
    expect(html).toContain("Code quality");
    expect(html).toContain("Readable and concise.");
    expect(html).toContain("print(&#x27;answer&#x27;)");
    expect(html).toContain("First case");
    expect(html).toContain("2 / 2");
    expect(html).toContain("Second case");
    expect(html).toContain("0 / 3");
    expect(html).toContain("Output differed.");
  });

  it("omits the rubric recap when grading is based only on tests", () => {
    const html = renderToStaticMarkup(React.createElement(CodingExerciseStudentGradeReport, {
      score: 60,
      maxScore: 100,
      locale: "en",
      report,
      feedback: {
        kind: "assessment_feedback",
        feedbackText: null,
        details: {
          deterministicScore: 60,
          gradingEnabled: false,
          criteria: [{ id: "advice", title: "Non-grading feedback", weightPercent: 100, scorePercent: 80, feedback: "Helpful note." }]
        }
      }
    }));

    expect(html).toContain("Automatic tests");
    expect(html).not.toContain(">Rubric<");
    expect(html).not.toContain("Non-grading feedback");
    expect(html).toContain("60 / 100");
  });

  it("omits the tests recap when grading is based only on the rubric", () => {
    const html = renderToStaticMarkup(React.createElement(CodingExerciseStudentGradeReport, {
      score: 85,
      maxScore: 100,
      locale: "en",
      report,
      feedback: {
        kind: "assessment_feedback",
        feedbackText: null,
        details: {
          aiScore: 85,
          gradingEnabled: true,
          testWeightPercent: 0,
          aiWeightPercent: 100,
          criteria: [{ id: "quality", title: "Code quality", weightPercent: 100, scorePercent: 85, feedback: "Good." }]
        }
      }
    }));

    expect(html).not.toContain("Automatic tests</span>");
    expect(html).toContain("Rubric");
    expect(html).toContain("85 / 100");
  });
});
