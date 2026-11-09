import { homeworkQuestionsEnabled } from "./question-policy";
import { randomUUID } from "node:crypto";
import { prisma as coreDb, Prisma } from "@cognelo/db";
import { AppError, assertCanGradeGroup, deleteActivitySubmission, enqueueBackgroundJob, lockActivityTeamwork, lockStudentGroupingWorkspaces, teamworkTransaction } from "@cognelo/core";
import { prisma } from "./db-client";
import { record } from "./file-preparation";
import type { HomeworkTeacherScope } from "./workflow-settings";
import { addWorkspaceMember, auditHomeworkWorkspace, cancelWorkspaceMembers, cancelTeamJobs, type HomeworkWorkspaceMember, type HomeworkWorkspaceRow, type HomeworkSubmissionRow } from "./team-workspaces";
import { codingHomeworkProcessingQueue, codingHomeworkSubmissionProcessingHandlerKey } from "./processing-constants";

async function withdraw(tx: Prisma.TransactionClient, scope: HomeworkTeacherScope, ids: string[], reason: string) {
  for (const attemptId of [...new Set(ids)]) {
    const attempt = await tx.activityAttempt.findFirst({ where: { id: attemptId, activityId: scope.activityId, courseId: scope.courseId, lifecycle: { not: "deleted" } }, select: { id: true } });
    if (attempt) await deleteActivitySubmission(scope.user, scope.courseId, { attemptId, reason }, { allowStartedReplacement: true, transaction: tx });
  }
}
export async function cancelTeamHomeworkSubmission(scope: HomeworkTeacherScope, workspaceId: string, reason: string, expectedSourceId: string) {
  const initial = await prisma.pluginCodingHomeworkWorkspace.findFirst({ where: { id: workspaceId, activityId: scope.activityId, courseId: scope.courseId } });
  if (!initial) throw new AppError(404, "HOMEWORK_SUBMISSION_NOT_FOUND", "The shared submission was not found.");
  await assertCanGradeGroup(scope.user, scope.courseId, initial.groupId);
  await coreDb.$transaction(async tx => {
    await lockActivityTeamwork(tx, scope.activityId); await lockStudentGroupingWorkspaces(tx, initial.groupingId);
    const sql = teamworkTransaction(tx);
    const [workspace] = await sql.query<HomeworkWorkspaceRow[]>`SELECT * FROM "PluginCodingHomeworkWorkspace" WHERE id=${workspaceId} FOR UPDATE`;
    if (!workspace?.currentSubmissionId) return;
    if (workspace.currentSubmissionId !== expectedSourceId) throw new AppError(409, "HOMEWORK_SUBMISSION_CHANGED", "The team has a different submission now. Refresh before cancelling.");
    const members = await sql.query<HomeworkWorkspaceMember[]>`SELECT * FROM "PluginCodingHomeworkWorkspaceMember" WHERE "workspaceId"=${workspace.id} ORDER BY "participantId" FOR UPDATE`;
    const attempts = await cancelWorkspaceMembers(sql, members.map(member => member.id), scope.user, reason);
    await withdraw(tx, scope, attempts, reason);
    await cancelTeamJobs(sql, [workspace.currentSubmissionId]);
    await sql.execute`UPDATE "PluginCodingHomeworkSubmission" SET status='cancelled', metadata=metadata || ${JSON.stringify({ cancellation: { cancelledAt: new Date().toISOString(), cancelledBy: scope.user.id, reason } })}::jsonb,"updatedAt"=NOW() WHERE id=${workspace.currentSubmissionId}`;
    await sql.execute`UPDATE "PluginCodingHomeworkWorkspace" SET "currentSubmissionId"=NULL,revision=revision+1,"updatedAt"=NOW() WHERE id=${workspace.id}`;
    await auditHomeworkWorkspace(sql, workspace, scope.user, "submission_cancelled", { metadata: { reason, submissionId: workspace.currentSubmissionId, affectedMembers: members.length } });
  }, { timeout: 30_000 });
  return { cancelled: true, team: Boolean(initial.teamId) };
}
export async function resetHomeworkStudentChallenges(scope: HomeworkTeacherScope, submissionId: string, reason: string) {
  const submission = await prisma.pluginCodingHomeworkSubmission.findFirst({ where: { id: submissionId, activityId: scope.activityId, kind: "final" } });
  if (!submission) throw new AppError(404, "HOMEWORK_SUBMISSION_NOT_FOUND", "The submission was not found.");
  await assertCanGradeGroup(scope.user, scope.courseId, submission.groupId);
  if (!homeworkQuestionsEnabled(submission.metadata)) throw new AppError(409, "HOMEWORK_QUESTIONS_DISABLED", "This submission has no challenge questions to reset.");
  await coreDb.$transaction(async tx => {
    await lockActivityTeamwork(tx, scope.activityId);
    const sql = teamworkTransaction(tx);
    if (submission.workspaceId) {
      const [workspace] = await sql.query<HomeworkWorkspaceRow[]>`SELECT * FROM "PluginCodingHomeworkWorkspace" WHERE id=${submission.workspaceId}`;
      if (!workspace) throw new AppError(409, "HOMEWORK_MEMBERSHIP_CHANGED", "This team workspace was erased.");
      await lockStudentGroupingWorkspaces(tx, workspace.groupingId);
      const [member] = await sql.query<HomeworkWorkspaceMember[]>`SELECT * FROM "PluginCodingHomeworkWorkspaceMember" WHERE id=${submission.workspaceMemberId} AND "currentSubmissionId"=${submissionId} AND "workspaceId"=${workspace.id} FOR UPDATE`;
      if (!member || workspace.currentSubmissionId !== submission.sharedSourceId) throw new AppError(409, "HOMEWORK_MEMBERSHIP_CHANGED", "The student's workspace changed. Refresh the submission list.");
      const attempts = await cancelWorkspaceMembers(sql, [member.id], scope.user, reason);
      await withdraw(tx, scope, attempts, reason);
      await addWorkspaceMember(sql, async job => { await enqueueBackgroundJob(job, tx); }, workspace, { participantId: member.participantId, userId: member.userId, membershipToken: member.membershipToken }, scope.user);
      const [source] = await sql.query<HomeworkSubmissionRow[]>`SELECT * FROM "PluginCodingHomeworkSubmission" WHERE id=${workspace.currentSubmissionId}`;
      if (source && record(source.metadata).separateTeamQuestions !== true && source.status === "failed") {
        await sql.execute`UPDATE "PluginCodingHomeworkSubmission" SET status='uploaded',"processingError"=NULL,"updatedAt"=NOW() WHERE id=${source.id}`;
        await tx.backgroundJob.updateMany({ where: { queue: codingHomeworkProcessingQueue, idempotencyKey: `submission:${source.id}`, status: "failed" }, data: { status: "queued", attempts: 0, error: Prisma.DbNull, runAfter: new Date(), failedAt: null, lockedAt: null, lockedBy: null } });
      }
      await auditHomeworkWorkspace(sql, workspace, scope.user, "student_challenges_reset", { metadata: { reason, participantId: member.participantId, previousSubmissionId: submissionId } });
    } else {
      const [current] = await sql.query<HomeworkSubmissionRow[]>`SELECT * FROM "PluginCodingHomeworkSubmission" WHERE id=${submissionId} FOR UPDATE`;
      if (!current || current.status === "cancelled" || record(current.metadata).deletion) throw new AppError(409, "HOMEWORK_SUBMISSION_CHANGED", "The submission was cancelled or changed.");
      if (current.coreAttemptId) await withdraw(tx, scope, [current.coreAttemptId], reason);
      await cancelTeamJobs(sql, [current.id]);
      await sql.execute`UPDATE "PluginCodingHomeworkSubmission" SET status='cancelled',metadata=metadata || ${JSON.stringify({ cancellation: { reason, cancelledBy: scope.user.id, cancelledAt: new Date().toISOString() } })}::jsonb,"updatedAt"=NOW() WHERE id=${current.id}`;
      const id = randomUUID();
      const metadata = { ...record(current.metadata), assessmentStartedAt: undefined, challengeAnswers: undefined, cancellation: undefined, deletion: undefined, resetFrom: current.id };
      await sql.execute`INSERT INTO "PluginCodingHomeworkSubmission" (id,"activityId","groupId","userId",kind,status,"documentationSnapshotId","structureValidationSummary",metadata,"updatedAt")
        VALUES (${id},${scope.activityId},${current.groupId},${current.userId},'final','uploaded',${current.documentationSnapshotId},${JSON.stringify(current.structureValidationSummary)}::jsonb,${JSON.stringify(metadata)}::jsonb,NOW())`;
      await sql.execute`INSERT INTO "PluginCodingHomeworkSubmissionFile" (id,"submissionId",path,"languageKey","sizeBytes",sha256,"storedName",metadata)
        SELECT gen_random_uuid()::text,${id},path,"languageKey","sizeBytes",sha256,"storedName",metadata FROM "PluginCodingHomeworkSubmissionFile" WHERE "submissionId"=${current.id}`;
      await enqueueBackgroundJob({ queue: codingHomeworkProcessingQueue, handlerKey: codingHomeworkSubmissionProcessingHandlerKey, idempotencyKey: `submission:${id}`, maxAttempts: 3,
        metadata: { activityId: scope.activityId, groupId: current.groupId, concurrencyGroup: scope.activityId, concurrencyLimit: 2 },
        payload: { workflowVersion: 2, activityId: scope.activityId, courseId: scope.courseId, groupId: current.groupId, submissionId: id, user: { id: current.userId } } }, tx);
    }
  }, { timeout: 30_000 });
  (await import("./background-processing")).startCodingHomeworkProcessingWorker();
  return { reset: true };
}
