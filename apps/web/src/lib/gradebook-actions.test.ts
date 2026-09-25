import { describe, expect, it } from "vitest";
import { getGradebookActivityActions } from "./gradebook-actions";

describe("gradebook activity actions", () => {
  it.each([
    ["coding-exercise", true, true, true, true],
    ["mcq", true, true, true, false],
    ["parsons-problem", true, true, false, false],
    ["web-design-coding-exercise", true, false, false, false],
    ["coding-homework-grader", true, false, false, false],
    ["test", true, true, true, true],
    ["placeholder", false, false, false, false],
    ["unknown", false, false, false, false]
  ])(
    "%s exposes only its supported teacher actions",
    (activityTypeKey, canReviewAndGrade, canRerunAutomaticGrading, canAssessWithAi, aiAssessmentChangesGrade) => {
      expect(getGradebookActivityActions(activityTypeKey as string)).toEqual({
        canReviewAndGrade,
        canRerunAutomaticGrading,
        canAssessWithAi,
        aiAssessmentChangesGrade
      });
    }
  );
});
