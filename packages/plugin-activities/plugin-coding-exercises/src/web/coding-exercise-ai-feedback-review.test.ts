import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

vi.mock("@cognelo/activity-ui", () => ({
  CodeRenderer: ({ code }: { code: string }) => React.createElement("pre", null, code)
}));

const {
  CodingExerciseAiFeedbackReview,
  getCodingExerciseGradingBreakdown,
  recalculateCodingExerciseFeedback
} = await import("./coding-exercise-ai-feedback-review");

const messages: Record<string, string> = {
  "courseDetail.feedbackReviewSubmission": "Student answer",
  "courseDetail.feedbackReviewTestResults": "Test results",
  "courseDetail.feedbackReviewTestScore": "{passed}/{total} tests passed",
  "courseDetail.feedbackReviewTestPassed": "Passed",
  "courseDetail.feedbackReviewTestFailed": "Failed",
  "courseDetail.feedbackReviewTest": "Test {number}",
  "courseDetail.feedbackReviewSummary": "Summary",
  "courseDetail.feedbackReviewStrengths": "Strengths",
  "courseDetail.feedbackReviewImprovements": "Improvements",
  "courseDetail.feedbackReviewCriteria": "Rubric feedback",
  "courseDetail.feedbackReviewCriterionWeight": "Weight: {weight}%",
  "courseDetail.feedbackReviewCriterionScore": "Score (%)",
  "courseDetail.feedbackReviewCriterionFeedback": "Criterion feedback",
  "courseDetail.feedbackReviewAutomaticTestsGrade": "Automatic tests grade (out of {max})",
  "courseDetail.feedbackReviewRubricGrade": "Rubric grade (out of {max})",
  "courseDetail.feedbackReviewCalculatedTotal": "Total (out of {max})",
  "courseDetail.answerUnavailable": "Answer unavailable"
};

function t(key: string, params: Record<string, string | number> = {}) {
  return Object.entries(params).reduce(
    (message, [name, value]) => message.replace(`{${name}}`, String(value)),
    messages[key] ?? key
  );
}

const feedback = { summary: "", strengths: [], improvements: [], criteria: [] };

function renderReview(submission: Record<string, unknown>) {
  return renderToStaticMarkup(React.createElement(CodingExerciseAiFeedbackReview, {
    feedback,
    submission,
    onFeedbackChange: () => undefined,
    t
  }));
}

describe("coding exercise teacher feedback review", () => {
  it("shows test results immediately below the submitted solution", () => {
    const html = renderReview({
      sourceCode: "int main(void) { return 0; }",
      language: "c",
      resultSummary: {
        tests: [
          { id: "test-1", name: "Positive values", passed: true },
          { id: "test-2", name: "Negative values", passed: false, message: "Output did not match." }
        ]
      }
    });

    expect(html).toContain("1/2 tests passed");
    expect(html).toContain("Positive values");
    expect(html).toContain('aria-label="Passed"');
    expect(html).toContain("Negative values");
    expect(html).toContain('aria-label="Failed"');
    expect(html).toContain("Output did not match.");
    expect(html.indexOf("int main(void)")).toBeLessThan(html.indexOf("Test results"));
    expect(html.indexOf("Test results")).toBeLessThan(html.indexOf("Summary"));
  });

  it("omits the test section when the submission has no test results", () => {
    const html = renderReview({ sourceCode: "print(1)", language: "python", resultSummary: {} });

    expect(html).not.toContain("Test results");
  });

  it("shows the weighted automatic, rubric, and total grades", () => {
    const html = renderToStaticMarkup(React.createElement(CodingExerciseAiFeedbackReview, {
      feedback: {
        summary: "",
        strengths: [],
        improvements: [],
        gradingEnabled: true,
        deterministicScore: 50,
        testWeightPercent: 60,
        aiWeightPercent: 40,
        criteria: [
          { id: "correctness", title: "Correctness", weightPercent: 75, scorePercent: 80, feedback: "" },
          { id: "clarity", title: "Clarity", weightPercent: 25, scorePercent: 40, feedback: "" }
        ]
      },
      submission: { sourceCode: "print(1)", language: "python", resultSummary: {} },
      onFeedbackChange: () => undefined,
      t
    }));

    expect(html).toContain("Automatic tests grade (out of 60)");
    expect(html).toContain("Weight: 75%");
    expect(html).toContain("Weight: 25%");
    expect(html).toContain('readOnly="" value="30"');
    expect(html).toContain("Rubric grade (out of 40)");
    expect(html).toContain('readOnly="" value="28"');
    expect(html).toContain("Total (out of 100)");
    expect(html).toContain('readOnly="" value="58"');
  });

  it("recalculates the displayed total from the current rubric scores", () => {
    expect(getCodingExerciseGradingBreakdown({
      gradingEnabled: true,
      deterministicScore: 75,
      testWeightPercent: 60,
      aiWeightPercent: 40,
      aiScore: 10,
      combinedScore: 49,
      criteria: [
        { id: "one", weightPercent: 50, scorePercent: 90 },
        { id: "two", weightPercent: 50, scorePercent: 70 }
      ]
    })).toEqual({
      automaticGrade: 45,
      automaticMax: 60,
      rubricGrade: 32,
      rubricMax: 40,
      totalGrade: 77
    });
  });

  it("writes the live rubric and combined scores back into the review draft", () => {
    expect(recalculateCodingExerciseFeedback({
      gradingEnabled: true,
      deterministicScore: 50,
      testWeightPercent: 60,
      aiWeightPercent: 40,
      aiScore: 10,
      combinedScore: 34,
      criteria: [{ id: "quality", weightPercent: 100, scorePercent: 75 }]
    })).toMatchObject({
      aiScore: 75,
      combinedScore: 60
    });
  });
});
