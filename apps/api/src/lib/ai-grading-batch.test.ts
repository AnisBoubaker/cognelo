import { describe, expect, it } from "vitest";
import { validateAiGradingTemplateAttemptIds } from "./ai-grading-batch";

describe("guided AI grading template validation", () => {
  it("rejects a selected template if it is submitted as a grading target", () => {
    expect(() => validateAiGradingTemplateAttemptIds("attempt-2", ["attempt-1", "attempt-2"]))
      .toThrow("cannot be graded again");
  });

  it("accepts distinct templates that are separate from the target", () => {
    expect(validateAiGradingTemplateAttemptIds("attempt-3", ["attempt-1", "attempt-2"]))
      .toEqual(["attempt-1", "attempt-2"]);
  });
});
