import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

vi.mock("@cognelo/activity-ui", () => ({
  CodeRenderer: ({ code }: { code: string }) => React.createElement("pre", null, code)
}));

const { CodingExerciseAiFeedbackReview } = await import("./coding-exercise-ai-feedback-review");

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
});
