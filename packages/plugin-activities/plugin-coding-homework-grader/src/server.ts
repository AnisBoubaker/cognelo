import type { ServerActivityPlugin } from "@cognelo/activity-sdk/server";
import {
  copyBankCodingHomeworkAuthoringToCourseActivity,
  deleteBankCodingHomeworkAuthoring
} from "./authoring";
import {
  codingHomeworkAssignmentPdfRoute,
  codingHomeworkAuthoringRoute,
  codingHomeworkChallengeAnswersRoute,
  codingHomeworkChallengeGenerationRoute,
  codingHomeworkDocumentationExtractionRoute,
  codingHomeworkDocumentationPreviewRoute,
  codingHomeworkDocumentationSnapshotRoute,
  codingHomeworkPreflightRoute,
  codingHomeworkReferenceSearchRoute,
  codingHomeworkRequirementsUploadRoute,
  codingHomeworkStudentAssignmentRoute,
  codingHomeworkSubmissionAnalysisRoute,
  codingHomeworkSubmissionRoute
} from "./routes";

export const codingHomeworkGraderServerPlugin: ServerActivityPlugin = {
  key: "coding-homework-grader",
  routes: [
    codingHomeworkAuthoringRoute,
    codingHomeworkAssignmentPdfRoute,
    codingHomeworkRequirementsUploadRoute,
    codingHomeworkDocumentationPreviewRoute,
    codingHomeworkDocumentationSnapshotRoute,
    codingHomeworkDocumentationExtractionRoute,
    codingHomeworkReferenceSearchRoute,
    codingHomeworkPreflightRoute,
    codingHomeworkStudentAssignmentRoute,
    codingHomeworkSubmissionRoute,
    codingHomeworkSubmissionAnalysisRoute,
    codingHomeworkChallengeGenerationRoute,
    codingHomeworkChallengeAnswersRoute
  ],
  hooks: {
    onCourseActivityCreatedFromBankVersion: async ({ activity, bankActivityId }) => {
      if (activity.activityType.key !== "coding-homework-grader") {
        return;
      }

      await copyBankCodingHomeworkAuthoringToCourseActivity({
        bankActivityId,
        activityId: activity.id
      });
    },
    onBankActivityDeleted: async ({ activityTypeKey, bankActivityId }) => {
      if (activityTypeKey !== "coding-homework-grader") {
        return;
      }

      await deleteBankCodingHomeworkAuthoring({ bankActivityId });
    }
  }
};
