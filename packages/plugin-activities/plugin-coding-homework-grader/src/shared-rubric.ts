import type { ServerActivityPlugin } from "@cognelo/activity-sdk/server";
import { AppError, hashAiFeedbackValue } from "@cognelo/core";
import { record } from "./file-preparation";
import { calculateHomeworkFeedback, isHomeworkFeedback, rubricScore, type HomeworkRubricScore } from "./rubric";
import { homeworkRubricGradingResult } from "./rubric-grading";

export const homeworkSharedGrading: NonNullable<ServerActivityPlugin["sharedGrading"]> = {
  async synchronize({ activityId, groupId, pluginAttemptRef, feedback, transaction: sql }) {
    if (!isHomeworkFeedback(feedback) || rubricScore(feedback.code) === null) return [];
    const [child] = await sql.query<Array<{ sharedSourceId: string | null; workspaceMemberId: string | null }>>`
      SELECT "sharedSourceId", "workspaceMemberId" FROM "PluginCodingHomeworkSubmission"
      WHERE id=${pluginAttemptRef} AND "activityId"=${activityId} AND "groupId"=${groupId} AND kind='final' AND status<>'cancelled'`;
    if (!child?.sharedSourceId) return [];
    const [source] = await sql.query<Array<{ metadata: unknown }>>`SELECT s.metadata FROM "PluginCodingHomeworkSubmission" s
      JOIN "PluginCodingHomeworkWorkspace" w ON w."currentSubmissionId"=s.id
      JOIN "PluginCodingHomeworkWorkspaceMember" m ON m."workspaceId"=w.id AND m."currentSubmissionId"=${pluginAttemptRef}
      WHERE s.id=${child.sharedSourceId} AND s."activityId"=${activityId} AND s."groupId"=${groupId} AND s.status<>'cancelled'
      FOR UPDATE OF s`;
    if (!source) throw new AppError(409, "HOMEWORK_SHARED_SUBMISSION_CHANGED", "The shared hand-in changed. Refresh before grading.");
    const previous = record(record(source.metadata).sharedCodeRubric);
    const revision = hashAiFeedbackValue(feedback.code);
    if (previous.revision && previous.revision !== feedback.privateSharedCodeRevision && previous.revision !== revision) throw new AppError(409, "HOMEWORK_SHARED_GRADING_CONFLICT", "A teammate's code rubric changed during this review. Reopen the review before saving.");
    const shared = { code: feedback.code, revision, policyHash: feedback.privateCodePolicyHash };
    await sql.execute`UPDATE "PluginCodingHomeworkSubmission" SET metadata=jsonb_set(metadata,'{sharedCodeRubric}',${JSON.stringify(shared)}::jsonb), "updatedAt"=NOW() WHERE id=${child.sharedSourceId}`;
    const members = await sql.query<Array<{ coreAttemptId: string }>>`SELECT s."coreAttemptId" FROM "PluginCodingHomeworkSubmission" s
      JOIN "PluginCodingHomeworkWorkspaceMember" m ON m.id=s."workspaceMemberId" AND m."currentSubmissionId"=s.id
      WHERE s."sharedSourceId"=${child.sharedSourceId} AND s."activityId"=${activityId} AND s."groupId"=${groupId}
        AND s.kind='final' AND s.status<>'cancelled' AND s."coreAttemptId" IS NOT NULL AND NOT(s.metadata ? 'deletion') ORDER BY s."coreAttemptId"`;
    return members.map(member => ({ attemptId: member.coreAttemptId, component: feedback.code, revision, policyHash: feedback.privateCodePolicyHash }));
  },
  mergeFeedback(value, component, revision, policyHash) {
    if (!isHomeworkFeedback(value)) return { feedback: value };
    const feedback = calculateHomeworkFeedback({ ...value, code: component as HomeworkRubricScore, privateSharedCodeRevision: revision, privateCodePolicyHash: policyHash ?? value.privateCodePolicyHash });
    return { feedback, gradingResult: homeworkRubricGradingResult(feedback) };
  }
};
