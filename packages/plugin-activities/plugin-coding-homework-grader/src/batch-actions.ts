import { randomUUID } from "node:crypto";
import { prisma as coreDb, type Prisma } from "@cognelo/db";
import type { GradebookActionContext, ServerActivityPlugin } from "@cognelo/activity-sdk/server";
import type { ActivityBatchAction } from "@cognelo/contracts";
import { AppError, assertCanGradeGroup, contentIndexRevision, deleteActivitySubmission, enqueueBackgroundJob, lockActivityTeamwork, lockStudentGroupingWorkspaces, snapshotAiModelSelection, teamworkTransaction } from "@cognelo/core";
import { prisma } from "./db-client";
import { currentHomeworkReportTargets, type HomeworkReportTarget } from "./gradebook-actions";
import { cancelHomeworkSubmission } from "./submission-management";
import { getHomeworkQuestionConnection } from "./ai-selection";
import { record } from "./file-preparation";
import { createMemberSubmission, cancelWorkspaceMembers, cancelTeamJobs, enqueueTeamQuestions, type HomeworkSubmissionRow, type HomeworkWorkspaceRow, type HomeworkWorkspaceMember } from "./team-workspaces";
import { lockHomeworkSettings } from "./workflow-settings";
import { homeworkQuestionsEnabled } from "./question-policy";
import { codingHomeworkProcessingQueue, codingHomeworkSubmissionProcessingHandlerKey } from "./processing-constants";
import { startCodingHomeworkProcessingWorker } from "./background-processing";
import { homeworkStageEnabled } from "./stage-activation-state";
import { homeworkStageHoldUntil } from "./stage-activation";

const resetId = "reset-question-generation", cancelId = "cancel-all-submissions";
const copy = {
  en: { reset: "Reset question generation for all students", cancel: "Cancel all submissions", reason: "Reason",
    resetDetail: "Reset question generation for {count} students in the current section selection? Submitted files, their original hand-in time and lateness are retained. Existing questions, answers, answering timers and associated grades are withdrawn and retained in history. New questions use the current saved references and question settings. Students will not need to submit their files again. Availability and deadlines remain unchanged.",
    cancelDetail: "Cancel the current submissions for {count} students in the current section selection? Associated grades and generation jobs are withdrawn. Previous records are retained and files reopen for resubmission. A shared team submission is cancelled once for all its members. Availability and deadlines remain unchanged." },
  fr: { reset: "Réinitialiser la génération des questions pour tous", cancel: "Annuler toutes les remises", reason: "Motif",
    resetDetail: "Réinitialiser la génération pour {count} étudiants dans les sections sélectionnées ? Les fichiers remis, la date de remise initiale et le retard sont conservés. Les questions, réponses, chronomètres et notes associés sont retirés et conservés dans l’historique. Les nouvelles questions utilisent les références et réglages actuellement enregistrés. Les étudiants n’ont pas à remettre leurs fichiers de nouveau. La disponibilité et les échéances restent inchangées.",
    cancelDetail: "Annuler les remises actuelles de {count} étudiants dans les sections sélectionnées ? Les notes et tâches de génération associées sont retirées. Les anciens dossiers sont conservés et les fichiers sont rouverts pour une nouvelle remise. Chaque remise d’équipe est annulée une seule fois pour tous ses membres. La disponibilité et les échéances restent inchangées." },
  zh: { reset: "为所有学生重置题目生成", cancel: "取消所有提交", reason: "原因",
    resetDetail: "重置当前班级范围内 {count} 名学生的题目生成？保留提交文件、原始提交时间及迟交记录。现有题目、回答、作答计时及相关成绩撤回并保留在历史中。新题目使用当前保存的参考资料和题目设置。学生无需重新提交文件。",
    cancelDetail: "取消当前班级范围内 {count} 名学生的提交？撤回相关成绩和生成任务。历史记录保留，文件重新开放供提交。团队提交对所有成员只取消一次。" },
  ar: { reset: "إعادة توليد الأسئلة لجميع الطلاب", cancel: "إلغاء جميع التسليمات", reason: "السبب",
    resetDetail: "إعادة توليد الأسئلة لعدد {count} من الطلاب في الأقسام المحددة؟ تُحفظ الملفات ووقت التسليم الأصلي والتأخير. تُسحب الأسئلة والإجابات والمؤقتات والدرجات المرتبطة وتُحتفظ بها في السجل. تُستخدم المراجع والإعدادات المحفوظة الحالية. لا يحتاج الطلاب إلى تسليم الملفات مجددًا.",
    cancelDetail: "إلغاء التسليمات الحالية لعدد {count} من الطلاب في الأقسام المحددة؟ تُسحب الدرجات ومهام التوليد المرتبطة وتُحفظ السجلات السابقة وتُفتح الملفات للتسليم مجددًا. يُلغى تسليم الفريق مرة واحدة لجميع أعضائه." }
};
type Assignment = NonNullable<Awaited<ReturnType<typeof prisma.pluginCodingHomeworkAssignment.findUnique>>>;
function eligible(actionId: string, targets: HomeworkReportTarget[]) { return actionId === resetId ? targets.filter(target => target.questionsEnabled) : targets; }
export function homeworkBatchRevision(actionId: string, targets: HomeworkReportTarget[], assignment: Assignment | null) {
  return contentIndexRevision({ actionId, targets: eligible(actionId, targets).map(target => [target.participantId, target.submissionId, target.sharedSourceId ?? null, target.coreAttemptId ?? null]).sort((a, b) => String(a[0]).localeCompare(String(b[0]))),
    configuration: actionId === resetId ? assignment : null });
}
function actions(targets: HomeworkReportTarget[], assignment: Assignment | null): ActivityBatchAction[] {
  return [resetId, cancelId].flatMap(id => {
    const selected = eligible(id, targets);
    if (!selected.length || id === resetId && !homeworkQuestionsEnabled(assignment?.settings)) return [];
    const localized = (key: "reset" | "cancel" | "reason" | "resetDetail" | "cancelDetail") => Object.fromEntries(Object.entries(copy).map(([locale, text]) => [locale, text[key].replace("{count}", String(selected.length))]));
    return [{ id, icon: id === resetId ? "reset" as const : "cancel" as const, revision: homeworkBatchRevision(id, targets, assignment), participantIds: selected.map(target => target.participantId),
      labels: localized(id === resetId ? "reset" : "cancel"), messages: localized(id === resetId ? "resetDetail" : "cancelDetail"), reasonLabels: localized("reason") }];
  });
}
type BatchContext = Parameters<NonNullable<NonNullable<ServerActivityPlugin["reports"]>["activityActions"]>["execute"]>[0];

async function withdraw(tx: Prisma.TransactionClient, context: GradebookActionContext & { reason: string }, attempts: Array<string | null>) {
  for (const id of [...new Set(attempts.filter((id): id is string => Boolean(id)))]) {
    const attempt = await tx.activityAttempt.findFirst({ where: { id, courseId: context.courseId, activityId: context.activity.id, lifecycle: { not: "deleted" } }, select: { id: true } });
    if (attempt) await deleteActivitySubmission(context.user, context.courseId, { attemptId: id, reason: context.reason }, { allowStartedReplacement: true, transaction: tx });
  }
}
export function resetHomeworkGenerationMetadata(value: unknown, assignment: Assignment, model: unknown, operationId: string, previousId: string, userId: string, reason: string) {
  const { assessmentStartedAt: _started, challengeAnswers: _answers, challengeGeneration: _generation, cancellation: _cancel, deletion: _deleted, generationSourceId: _source,
    parserDiagnostics: _diagnostics, ...retained } = record(value);
  return { ...retained, workflowVersion: 2, questionGenerationEnabled: true, questionGenerationAi: model, awaitingStageActivation: false, resetFrom: previousId, fileHandInId: retained.fileHandInId ?? previousId,
    questionGenerationReset: { operationId, at: new Date().toISOString(), actorUserId: userId, reason, previousSubmissionId: previousId },
    assignment: { candidateLimit: assignment.candidateLimit, languageKey: assignment.languageKey, promptMarkdown: assignment.promptMarkdown, generationInstructions: assignment.generationInstructions, questionCount: assignment.questionCount, retrievedExampleCount: assignment.retrievedExampleCount } };
}
async function copySubmission(tx: Prisma.TransactionClient, previous: HomeworkSubmissionRow, metadata: unknown, snapshotId: string, sharedSourceId: string | null = previous.sharedSourceId) {
  const id = randomUUID();
  const [next] = await tx.$queryRaw<HomeworkSubmissionRow[]>`INSERT INTO "PluginCodingHomeworkSubmission"
    (id,"activityId","groupId","userId",kind,status,"workspaceId","workspaceMemberId","sharedSourceId","documentationSnapshotId","zipAttachmentId","structureValidationSummary",metadata,"updatedAt")
    VALUES (${id},${previous.activityId},${previous.groupId},${previous.userId},${previous.kind}::"PluginCodingHomeworkSubmissionKind",'uploaded',${previous.workspaceId},${previous.workspaceMemberId},${sharedSourceId},${snapshotId},${previous.zipAttachmentId},${JSON.stringify(previous.structureValidationSummary)}::jsonb,${JSON.stringify(metadata)}::jsonb,NOW()) RETURNING *`;
  await tx.$executeRaw`INSERT INTO "PluginCodingHomeworkSubmissionFile" (id,"submissionId",path,"languageKey","sizeBytes",sha256,"storedName",metadata)
    SELECT gen_random_uuid()::text,${id},path,"languageKey","sizeBytes",sha256,"storedName",metadata FROM "PluginCodingHomeworkSubmissionFile" WHERE "submissionId"=${previous.id}`;
  return next;
}
async function queueIndividual(tx: Prisma.TransactionClient, context: GradebookActionContext, submission: HomeworkSubmissionRow, assignment: Assignment) {
  const active = await homeworkStageEnabled({ activityId: context.activity.id, groupId: submission.groupId, user: { id: submission.userId } }, "questions", teamworkTransaction(tx));
  await enqueueBackgroundJob({ queue: codingHomeworkProcessingQueue, handlerKey: codingHomeworkSubmissionProcessingHandlerKey,
    idempotencyKey: `submission:${submission.id}`, maxAttempts: 3, runAfter: active ? new Date() : homeworkStageHoldUntil,
    metadata: { activityId: context.activity.id, courseId: context.courseId, groupId: submission.groupId, concurrencyGroup: context.activity.id, concurrencyLimit: Math.max(1, Math.min(4, Number(record(assignment.settings).generationConcurrency ?? 2))), ...(!active ? { stageActivationHeld: true } : {}) },
    payload: { workflowVersion: 2, activityId: context.activity.id, courseId: context.courseId, groupId: submission.groupId, submissionId: submission.id, user: { id: submission.userId } } }, tx);
}
async function resetIndividual(tx: Prisma.TransactionClient, context: BatchContext, previous: HomeworkSubmissionRow, assignment: Assignment, model: unknown, snapshotId: string) {
  await withdraw(tx, context, [previous.coreAttemptId]); await cancelTeamJobs(teamworkTransaction(tx), [previous.id]);
  await tx.$executeRaw`UPDATE "PluginCodingHomeworkSubmission" SET status='cancelled', metadata=metadata || ${JSON.stringify({ cancellation: { reason: context.reason, cancelledBy: context.user.id, cancelledAt: new Date().toISOString() } })}::jsonb,"updatedAt"=NOW() WHERE id=${previous.id}`;
  const next = await copySubmission(tx, previous, resetHomeworkGenerationMetadata(previous.metadata, assignment, model, context.operationId, previous.id, context.user.id, context.reason), snapshotId);
  await queueIndividual(tx, context, next, assignment);
}
async function resetWorkspace(tx: Prisma.TransactionClient, context: BatchContext, workspace: HomeworkWorkspaceRow, targets: HomeworkReportTarget[], assignment: Assignment, model: unknown, snapshotId: string) {
  const sql = teamworkTransaction(tx);
  const [previous] = await sql.query<HomeworkSubmissionRow[]>`SELECT * FROM "PluginCodingHomeworkSubmission" WHERE id=${workspace.currentSubmissionId} FOR UPDATE`;
  if (!previous) throw new AppError(409, "ACTIVITY_ACTION_CHANGED", "The shared hand-in changed. Refresh and confirm again.");
  const members = await sql.query<HomeworkWorkspaceMember[]>`SELECT * FROM "PluginCodingHomeworkWorkspaceMember" WHERE "workspaceId"=${workspace.id} ORDER BY "participantId" FOR UPDATE`;
  const authorized = new Set(context.participants.map(person => person.participantId));
  if (members.some(member => member.currentSubmissionId && member.userId && !authorized.has(member.participantId))) throw new AppError(409, "ACTIVITY_ACTION_CHANGED", "The team membership changed. Refresh the results.");
  await withdraw(tx, context, await cancelWorkspaceMembers(sql, members.map(member => member.id), context.user, context.reason));
  await cancelTeamJobs(sql, [previous.id]);
  await sql.execute`UPDATE "PluginCodingHomeworkSubmission" SET status='cancelled',metadata=metadata || ${JSON.stringify({ cancellation: { reason: context.reason, cancelledBy: context.user.id, cancelledAt: new Date().toISOString() } })}::jsonb,"updatedAt"=NOW() WHERE id=${previous.id}`;
  const next = await copySubmission(tx, previous, resetHomeworkGenerationMetadata(previous.metadata, assignment, model, context.operationId, previous.id, context.user.id, context.reason), snapshotId);
  await sql.execute`UPDATE "PluginCodingHomeworkWorkspace" SET "currentSubmissionId"=${next.id},"updatedAt"=NOW() WHERE id=${workspace.id}`;
  if (record(next.metadata).separateTeamQuestions === true) await sql.execute`UPDATE "PluginCodingHomeworkSubmission" SET status='structure_valid',"updatedAt"=NOW() WHERE id=${next.id}`;
  const currentWorkspace = { ...workspace, currentSubmissionId: next.id };
  for (const member of members) {
    const created = await createMemberSubmission(sql, async job => { await enqueueBackgroundJob(job, tx); }, currentWorkspace, { ...member, currentSubmissionId: null });
    const old = targets.find(target => target.participantId === member.participantId);
    if (created.currentSubmissionId && old) await sql.execute`UPDATE "PluginCodingHomeworkSubmission" SET metadata=jsonb_set(metadata,'{resetFrom}',${JSON.stringify(old.submissionId)}::jsonb) WHERE id=${created.currentSubmissionId}`;
  }
  if (record(next.metadata).separateTeamQuestions !== true) await enqueueTeamQuestions(sql, async job => { await enqueueBackgroundJob(job, tx); }, currentWorkspace, next);
}

export const homeworkBatchActions: NonNullable<NonNullable<ServerActivityPlugin["reports"]>["activityActions"]> = {
  async list(context) {
    const [targets, assignment] = await Promise.all([currentHomeworkReportTargets(context), prisma.pluginCodingHomeworkAssignment.findUnique({ where: { activityId: context.activity.id } })]);
    return actions(targets, assignment);
  },
  async execute(context) {
    const initial = await prisma.pluginCodingHomeworkAssignment.findUnique({ where: { activityId: context.activity.id } });
    const model = context.actionId === resetId ? snapshotAiModelSelection(await getHomeworkQuestionConnection({ user: context.user, courseId: context.courseId, activityId: context.activity.id }, record(initial?.settings))) : null;
    const result = await coreDb.$transaction(async tx => {
      await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtextextended(${`activity-batch:${context.operationId}`},0))`;
      const receipt = await tx.courseAuditEvent.findUnique({ where: { id: context.operationId } });
      if (receipt) {
        if (receipt.actorUserId !== context.user.id || record(receipt.metadata).requestHash !== context.requestHash) throw new AppError(409, "ACTIVITY_ACTION_CHANGED", "This operation has already been used.");
        return { affectedCount: Number(record(receipt.metadata).affectedCount) };
      }
      await lockActivityTeamwork(tx, context.activity.id);
      const all = await currentHomeworkReportTargets(context, tx);
      const targets = eligible(context.actionId, all);
      for (const groupId of [...new Set(targets.map(target => target.groupId))]) await assertCanGradeGroup(context.user, context.courseId, groupId);
      const workspaceIds = [...new Set(targets.flatMap(target => target.workspaceId ? [target.workspaceId] : []))].sort();
      const workspaces = workspaceIds.length ? await tx.$queryRaw<HomeworkWorkspaceRow[]>`SELECT * FROM "PluginCodingHomeworkWorkspace" WHERE id=ANY(${workspaceIds}::text[]) ORDER BY "groupingId",id` : [];
      for (const groupingId of [...new Set(workspaces.map(workspace => workspace.groupingId))].sort()) await lockStudentGroupingWorkspaces(tx, groupingId);
      await lockHomeworkSettings(tx, context.activity.id);
      const [assignment] = await tx.$queryRaw<Assignment[]>`SELECT * FROM "PluginCodingHomeworkAssignment" WHERE "activityId"=${context.activity.id}`;
      if (!targets.length || homeworkBatchRevision(context.actionId, all, assignment) !== context.revision) throw new AppError(409, "ACTIVITY_ACTION_CHANGED", "Submissions or saved settings changed. Refresh and confirm again.");
      if (context.actionId === cancelId) {
        const visited = new Set<string>();
        for (const target of targets) {
          if (target.workspaceId && visited.has(target.workspaceId)) continue;
          if (target.workspaceId) visited.add(target.workspaceId);
          await cancelHomeworkSubmission({ user: context.user, courseId: context.courseId, activityId: context.activity.id }, { submissionId: target.submissionId, reason: context.reason }, tx);
        }
      } else if (context.actionId === resetId) {
        const settings = record(assignment?.settings), snapshotId = typeof settings.preparedSnapshotId === "string" ? settings.preparedSnapshotId : "";
        const [snapshot] = await tx.$queryRaw<Array<{ metadata: unknown }>>`SELECT metadata FROM "PluginCodingHomeworkDocumentationSnapshot" WHERE id=${snapshotId} AND "activityId"=${context.activity.id} AND "courseId"=${context.courseId} AND status='ready' AND "groupId" IS NULL`;
        if (!assignment || !homeworkQuestionsEnabled(settings) || !snapshot || JSON.stringify(record(snapshot.metadata).selected) !== JSON.stringify(settings.referenceMaterialIds)) throw new AppError(409, "HOMEWORK_EMBEDDINGS_REQUIRED", "Save and prepare the corrected reference selection before resetting question generation.");
        for (const workspace of workspaces) await resetWorkspace(tx, context, workspace, targets, assignment, model, snapshotId);
        const ids = targets.filter(target => !target.workspaceId).map(target => target.submissionId);
        const individuals = ids.length ? await tx.$queryRaw<HomeworkSubmissionRow[]>`SELECT * FROM "PluginCodingHomeworkSubmission" WHERE id=ANY(${ids}::text[]) ORDER BY "createdAt",id FOR UPDATE` : [];
        for (const previous of individuals) await resetIndividual(tx, context, previous, assignment, model, snapshotId);
      } else throw new AppError(404, "ACTIVITY_ACTION_UNAVAILABLE", "This action is unavailable.");
      await tx.courseAuditEvent.create({ data: { id: context.operationId, courseId: context.courseId, actorUserId: context.user.id, eventType: "activity_report_batch_action", targetType: "Activity", targetId: context.activity.id,
        previousValue: { submissionIds: targets.map(target => target.submissionId) }, nextValue: { affectedCount: targets.length }, metadata: { actionId: context.actionId, reason: context.reason, requestHash: context.requestHash, affectedCount: targets.length } } });
      return { affectedCount: targets.length };
    }, { timeout: 60_000, maxWait: 10_000 });
    if (context.actionId === resetId) startCodingHomeworkProcessingWorker();
    return result;
  }
};
