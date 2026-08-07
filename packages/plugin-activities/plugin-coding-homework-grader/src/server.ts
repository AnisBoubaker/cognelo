import type { ServerActivityPlugin } from "@cognelo/activity-sdk/server";
import { AppError } from "@cognelo/core";
import { prisma } from "./db-client";
import {
  copyBankCodingHomeworkAuthoringToCourseActivity,
  copyCourseCodingHomeworkAuthoring,
  deleteBankCodingHomeworkAuthoring,
  deleteCourseCodingHomeworkData
} from "./authoring";
import {
  codingHomeworkAssignmentPdfRoute,
  codingHomeworkActivityFileRoute,
  codingHomeworkAuthoringRoute,
  codingHomeworkChallengeAnswersRoute,
  codingHomeworkChallengeGenerationRoute,
  codingHomeworkDocumentationExtractionRoute,
  codingHomeworkDocumentationPreviewRoute,
  codingHomeworkDocumentationSnapshotRoute,
  codingHomeworkGradebookAttemptsRoute,
  codingHomeworkPreflightRoute,
  codingHomeworkProvidedFilesRoute,
  codingHomeworkProcessingJobRoute,
  codingHomeworkReprocessRoute,
  codingHomeworkReferenceSearchRoute,
  codingHomeworkRequirementsUploadRoute,
  codingHomeworkStudentAssignmentRoute,
  codingHomeworkSubmissionAnalysisRoute,
  codingHomeworkSubmissionRoute
} from "./routes";
import { registerCodingHomeworkBackgroundJobs } from "./background-processing";
import { markCodingHomeworkSubmissionDeleted } from "./submission-deletion";

registerCodingHomeworkBackgroundJobs();

export const codingHomeworkGraderServerPlugin: ServerActivityPlugin = {
  key: "coding-homework-grader",
  routes: [
    codingHomeworkAuthoringRoute,
    codingHomeworkAssignmentPdfRoute,
    codingHomeworkActivityFileRoute,
    codingHomeworkProvidedFilesRoute,
    codingHomeworkRequirementsUploadRoute,
    codingHomeworkDocumentationPreviewRoute,
    codingHomeworkDocumentationSnapshotRoute,
    codingHomeworkDocumentationExtractionRoute,
    codingHomeworkReferenceSearchRoute,
    codingHomeworkPreflightRoute,
    codingHomeworkStudentAssignmentRoute,
    codingHomeworkSubmissionRoute,
    codingHomeworkProcessingJobRoute,
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
    onCourseActivityDuplicated: async ({ sourceActivityId, activity }) => {
      if (activity.activityType.key === "coding-homework-grader") {
        await copyCourseCodingHomeworkAuthoring({ sourceActivityId, activityId: activity.id });
      }
    },
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
    },
    onCourseActivityDeleted: async ({ activityTypeKey, activityId }) => {
      if (activityTypeKey === "coding-homework-grader") {
        await deleteCourseCodingHomeworkData({ activityId });
      }
    },
    onActivityAttemptDeleted: async ({ activityId, coreAttemptId, deletedAt, groupId, pluginAttemptRef, reason, user }) => {
      await markCodingHomeworkSubmissionDeleted({
        activityId,
        coreAttemptId,
        deletedAt,
        deletedByUserId: user.id,
        groupId,
        pluginAttemptRef,
        reason
      });
    }
  }
};
