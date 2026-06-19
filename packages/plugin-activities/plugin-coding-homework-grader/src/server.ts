import type { ServerActivityPlugin } from "@cognelo/activity-sdk/server";
import { AppError } from "@cognelo/core";
import { prisma } from "./db-client";
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
  codingHomeworkGradebookAttemptsRoute,
  codingHomeworkPreflightRoute,
  codingHomeworkReprocessRoute,
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
    codingHomeworkChallengeAnswersRoute,
    codingHomeworkGradebookAttemptsRoute,
    codingHomeworkReprocessRoute
  ],
  grading: {
    gradeAttempt: async ({ activityId, pluginAttemptRef }) => {
      if (!pluginAttemptRef) {
        throw new AppError(400, "CODING_HOMEWORK_SUBMISSION_REF_REQUIRED", "Coding homework grading requires a submission reference.");
      }
      const submission = await prisma.pluginCodingHomeworkSubmission.findFirst({
        where: {
          id: pluginAttemptRef,
          activityId
        },
        include: {
          reviews: { orderBy: { createdAt: "desc" }, take: 1 }
        }
      });
      if (!submission) {
        throw new AppError(404, "CODING_HOMEWORK_SUBMISSION_NOT_FOUND", "The coding homework submission was not found.");
      }
      const review = submission.reviews[0];
      if (!review || review.score === null || review.maxScore === null) {
        throw new AppError(409, "CODING_HOMEWORK_MANUAL_GRADE_REQUIRED", "This coding homework submission requires manual grading.");
      }
      return {
        rawScore: review.score,
        rawMaxScore: review.maxScore,
        feedback: { feedbackText: review.feedback },
        metadata: {
          kind: "coding-homework-grader",
          reviewId: review.id
        }
      };
    }
  },
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
