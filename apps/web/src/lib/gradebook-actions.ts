import { getActivityDefinition } from "@cognelo/activity-sdk";

export type GradebookActivityActions = {
  canReviewAndGrade: boolean;
  canRerunAutomaticGrading: boolean;
  canAssessWithAi: boolean;
  aiAssessmentChangesGrade: boolean;
};

export function getGradebookActivityActions(activityTypeKey: string): GradebookActivityActions {
  const grading = getActivityDefinition(activityTypeKey)?.grading;
  return {
    canReviewAndGrade: grading?.supportsAttempts === true && grading.supportsManualGrading === true,
    canRerunAutomaticGrading: grading?.supportsRegrading === true,
    canAssessWithAi: grading?.supportsAiFeedback === true,
    aiAssessmentChangesGrade: grading?.supportsAiFeedbackGrading === true
  };
}
