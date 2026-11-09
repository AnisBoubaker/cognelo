import { homeworkQuestionsEnabled } from "./question-policy";
import { readHomeworkSubmissionTiming } from "./submission-policy";
import { z } from "zod";
import { prisma as coreDb } from "@cognelo/db";
import { AppError, assertCanManageCourse, assertCanGradeGroup, deleteActivitySubmission } from "@cognelo/core";
import { prisma } from "./db-client";
import { record, lockHomeworkWorkflow } from "./file-preparation";
import type { HomeworkTeacherScope } from "./workflow-settings";
import { codingHomeworkProcessingQueue } from "./background-processing";

export async function listHomeworkSubmissions(scope: HomeworkTeacherScope, groupId?: string, recoverAutomatic = false) {
  if (groupId) await assertCanGradeGroup(scope.user, scope.courseId, groupId); else await assertCanManageCourse(scope.user, scope.courseId);
  const automaticSubmissionIssues = recoverAutomatic ? await (await import("./automatic-hand-in")).recoverHomeworkForClass(scope, groupId) : [];
  const submissions = await prisma.pluginCodingHomeworkSubmission.findMany({ where: { activityId: scope.activityId, kind: "final", ...(groupId ? { groupId } : {}) }, orderBy: { createdAt: "desc" }, take: 300 });
  const users = await coreDb.user.findMany({ where: { id: { in: [...new Set(submissions.map(submission => submission.userId))] } }, select: { id: true, name: true, firstName: true, lastName: true, email: true } });
  const jobs = await coreDb.backgroundJob.findMany({ where: { queue: codingHomeworkProcessingQueue, idempotencyKey: { in: submissions.map(submission => `submission:${String(record(submission.metadata).generationSourceId ?? submission.id)}`) } }, select: { idempotencyKey: true, status: true, error: true } });
  return { automaticSubmissionIssues, submissions: submissions.map(submission => { const user = users.find(user => user.id === submission.userId); const job = jobs.find(job => job.idempotencyKey === `submission:${String(record(submission.metadata).generationSourceId ?? submission.id)}`); return { questionGenerationEnabled: homeworkQuestionsEnabled(submission.metadata), automaticHandIn: Boolean(record(submission.metadata).automaticHandIn), submissionTiming: readHomeworkSubmissionTiming(submission.metadata), id: submission.id, workspaceId: submission.workspaceId, team: Boolean(submission.workspaceId && record(submission.metadata).teamId), teamName: typeof record(submission.metadata).teamName === "string" ? record(submission.metadata).teamName : null, groupId: submission.groupId, userId: submission.userId,
    student: user?.name || [user?.firstName, user?.lastName].filter(Boolean).join(" ") || user?.email || "Student",
    status: job?.status === "failed" && submission.status !== "cancelled" ? "failed" : submission.status, createdAt: submission.createdAt.toISOString(), started: Boolean(record(submission.metadata).assessmentStartedAt),
    processingError: submission.processingError ?? (job?.status === "failed" && typeof record(job.error).message === "string" ? record(job.error).message as string : null), cancelled: submission.status === "cancelled" || Boolean(record(submission.metadata).deletion) }; }) };
}
export async function cancelHomeworkSubmission(scope: HomeworkTeacherScope, input: unknown) {
  const data = z.object({ submissionId: z.string().min(1), reason: z.string().trim().min(1).max(2000) }).strict().parse(input);
  const submission = await prisma.pluginCodingHomeworkSubmission.findFirst({ where: { id: data.submissionId, activityId: scope.activityId, kind: { in: ["final", "team_source"] } } });
  if (!submission) throw new AppError(404, "HOMEWORK_SUBMISSION_NOT_FOUND", "The submission was not found.");
  await assertCanGradeGroup(scope.user, scope.courseId, submission.groupId);
  if (submission.workspaceId) return (await import("./team-management")).cancelTeamHomeworkSubmission(scope, submission.workspaceId, data.reason, submission.kind === "team_source" ? submission.id : submission.sharedSourceId!);
  await coreDb.$transaction(async tx => {
    await lockHomeworkWorkflow(tx, { activityId: scope.activityId, groupId: submission.groupId, user: { id: submission.userId } as typeof scope.user });
    const [current] = await tx.$queryRaw<Array<{ metadata: unknown; status: string; coreAttemptId: string | null }>>`SELECT metadata, status, "coreAttemptId" FROM "PluginCodingHomeworkSubmission" WHERE id=${submission.id} FOR UPDATE`;
    if (current.status === "cancelled" || record(current.metadata).deletion) return;
    if (current.coreAttemptId) await deleteActivitySubmission(scope.user, scope.courseId, { attemptId: current.coreAttemptId, reason: data.reason }, { allowStartedReplacement: true, transaction: tx });
    const metadata = { ...record(current.metadata), cancellation: { cancelledAt: new Date().toISOString(), cancelledBy: scope.user.id, reason: data.reason } };
    await tx.$executeRaw`UPDATE "PluginCodingHomeworkSubmission" SET status='cancelled', metadata=${JSON.stringify(metadata)}::jsonb, "updatedAt"=NOW() WHERE id=${submission.id}`;
    await tx.backgroundJob.updateMany({ where: { queue: codingHomeworkProcessingQueue, idempotencyKey: `submission:${submission.id}`, status: { in: ["queued", "failed"] } }, data: { status: "cancelled", lockedAt: null, lockedBy: null, completedAt: new Date() } });
    // An in-flight provider request retains its concurrency slot until its worker unwinds.
    await tx.backgroundJob.updateMany({ where: { queue: codingHomeworkProcessingQueue, idempotencyKey: `submission:${submission.id}`, status: "running" }, data: { status: "cancelled", completedAt: new Date() } });
  }, { timeout: 30_000 });
  return { cancelled: true };
}
