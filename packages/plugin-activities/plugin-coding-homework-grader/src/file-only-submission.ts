import type { PluginTeamworkTransaction } from "@cognelo/activity-sdk/server";
import { AppError } from "@cognelo/core";
import { record } from "./file-preparation";

/** Publish completed, ungraded evidence through core, within the same transaction as frozen files. */
export async function completeFileOnlyHomework(sql: PluginTeamworkTransaction, courseId: string, submission: { id: string; activityId: string; groupId: string; userId: string; metadata: unknown }) {
  if (!sql.recordDeferredSubmission) throw new AppError(500, "HOMEWORK_COMPLETION_UNAVAILABLE", "The submission completion service is unavailable.");
  const metadata = record(submission.metadata), timing = record(metadata.submissionTiming);
  const submittedAt = String(timing.submittedAt ?? metadata.handInAt ?? new Date().toISOString());
  const attempt = await sql.recordDeferredSubmission({ courseId, activityId: submission.activityId, groupId: submission.groupId, userId: submission.userId,
    pluginKey: "coding-homework-grader", pluginVersion: "0.1.0", pluginAttemptRef: submission.id, submittedAt,
    metadata: { submissionId: submission.id, questionCount: 0, submittedAnswers: {}, questionGenerationEnabled: false,
      ...(metadata.workspaceId ? { teamwork: { workspaceId: metadata.workspaceId, groupingId: metadata.groupingId, teamId: metadata.teamId, sharedSourceId: metadata.sharedSourceId } } : {}) } });
  await sql.execute`UPDATE "PluginCodingHomeworkSubmission" SET "coreAttemptId"=${attempt.id},status='ready_for_grading',"processingError"=NULL,"updatedAt"=NOW() WHERE id=${submission.id}`;
}
