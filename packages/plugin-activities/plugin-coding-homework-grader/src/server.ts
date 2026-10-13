import type { ServerActivityPlugin } from "@cognelo/activity-sdk/server";
import { AppError } from "@cognelo/core";
import { prisma } from "./db-client";
import {
  copyBankCodingHomeworkAuthoringToCourseActivity,
  copyBankCodingHomeworkAuthoring,
  copyCourseCodingHomeworkAuthoring,
  copyCourseCodingHomeworkAuthoringToBankActivity,
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
  attemptContinuation: {
    activityTypeKeys: ["coding-homework-grader"],
    reopen: async ({ activityId, userId, pluginAttemptRef, metadata, transaction }) => {
      if (!pluginAttemptRef && metadata.timedOut) return {};
      const [submission] = await transaction.query<Array<{ id: string; status: string; metadata: unknown }>>`
        SELECT id, status, metadata FROM "PluginCodingHomeworkSubmission"
        WHERE id = ${pluginAttemptRef} AND "activityId" = ${activityId} AND "userId" = ${userId}`;
      if (!submission) throw new AppError(409, "SUBMISSION_STATE_MISSING", "The submitted answers are unavailable.");
      const questions = await transaction.query<Array<Record<string, unknown>>>`
        SELECT id, "studentAnswer", "answerSubmittedAt" FROM "PluginCodingHomeworkChallengeQuestion" WHERE "submissionId" = ${pluginAttemptRef}`;
      await transaction.execute`UPDATE "PluginCodingHomeworkSubmission" SET status = 'challenge_ready', "updatedAt" = NOW()
        WHERE id = ${pluginAttemptRef}`;
      await transaction.execute`UPDATE "PluginCodingHomeworkChallengeQuestion" SET "answerSubmittedAt" = NULL, "updatedAt" = NOW()
        WHERE "submissionId" = ${pluginAttemptRef}`;
      return { audit: { submission, questions: JSON.parse(JSON.stringify(questions)) } };
    }
  },
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
    onCourseActivityPublishedToBank: async ({ activity, bankActivityId }) => {
      if (activity.activityType.key === "coding-homework-grader") await copyCourseCodingHomeworkAuthoringToBankActivity({ activityId: activity.id, bankActivityId });
    },
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
    onBankActivityDuplicated: async ({ activityTypeKey, sourceBankActivityId, bankActivityId }) => {
      if (activityTypeKey === "coding-homework-grader") {
        await copyBankCodingHomeworkAuthoring({ sourceBankActivityId, bankActivityId });
      }
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
