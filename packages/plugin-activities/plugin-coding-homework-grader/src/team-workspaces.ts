import { randomUUID } from "node:crypto";
import { rm } from "node:fs/promises";
import path from "node:path";
import { prisma as coreDb, type Prisma as CorePrisma } from "@cognelo/db";
import { AppError, enqueueBackgroundJob, lockActivityTeamwork, lockStudentGroupingWorkspaces, resolveActivityTeamContext, teamworkTransaction, type ActivityTeamContext, type BackgroundJobRecord } from "@cognelo/core";
import type { CurrentUser } from "@cognelo/contracts";
import type { PluginTeamworkTransaction, ServerActivityPlugin } from "@cognelo/activity-sdk/server";
import type { Prisma } from "./db-client";
import { homeworkStorageRoot, record, type HomeworkStudentScope } from "./file-preparation";
import { codingHomeworkProcessingQueue, codingHomeworkSubmissionProcessingHandlerKey, homeworkWorkspaceCleanupHandler } from "./processing-constants";

export type HomeworkWorkspaceRow = Prisma.PluginCodingHomeworkWorkspaceGetPayload<Record<string, never>>;
export type HomeworkWorkspaceMember = Prisma.PluginCodingHomeworkWorkspaceMemberGetPayload<Record<string, never>>;
export type HomeworkSubmissionRow = Prisma.PluginCodingHomeworkSubmissionGetPayload<Record<string, never>>;
export type TeamSql = PluginTeamworkTransaction;
type Enqueue = NonNullable<ServerActivityPlugin["teamwork"]>["membershipChanged"] extends (input: infer T) => unknown ? T extends { enqueue: infer E } ? E : never : never;
export type TeamHomeworkAccess = { workspace: HomeworkWorkspaceRow; member: HomeworkWorkspaceMember; context: ActivityTeamContext };
export const actorName = (user: CurrentUser) => user.name || [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email;

export async function auditHomeworkWorkspace(sql: TeamSql, workspace: Pick<HomeworkWorkspaceRow, "id" | "courseId" | "activityId" | "groupId" | "teamId">, user: CurrentUser, operation: string,
  details: { path?: string; previousHash?: string; nextHash?: string; metadata?: Record<string, unknown> } = {}) {
  await sql.execute`INSERT INTO "PluginCodingHomeworkWorkspaceEvent" (id,"courseId","activityId","groupId","workspaceId","teamId","actorUserId","actorName",operation,"filePath","previousHash","nextHash",metadata)
    VALUES (${randomUUID()},${workspace.courseId},${workspace.activityId},${workspace.groupId},${workspace.id},${workspace.teamId},${user.id},${actorName(user)},${operation},${details.path ?? null},${details.previousHash ?? null},${details.nextHash ?? null},${JSON.stringify(details.metadata ?? {})}::jsonb)`;
}
export async function findTeamWorkspace(sql: TeamSql, scope: Pick<HomeworkStudentScope, "courseId" | "activityId" | "groupId">, context: Pick<ActivityTeamContext, "groupingId" | "teamId" | "participantId" | "workspaceEpoch" | "membershipToken">, create = true) {
  const ownerKey = context.teamId ? `team:${context.groupingId}:${context.teamId}:${context.workspaceEpoch}` : `individual:${context.groupingId}:${context.participantId}:${context.membershipToken}`;
  if (create) await sql.execute`INSERT INTO "PluginCodingHomeworkWorkspace" (id,"courseId","activityId","groupId","groupingId","teamId","ownerParticipantId","ownerKey")
    VALUES (${randomUUID()},${scope.courseId},${scope.activityId},${scope.groupId},${context.groupingId},${context.teamId},${context.teamId ? null : context.participantId},${ownerKey}) ON CONFLICT ("activityId","groupId","ownerKey") DO NOTHING`;
  const [workspace] = await sql.query<HomeworkWorkspaceRow[]>`SELECT * FROM "PluginCodingHomeworkWorkspace" WHERE "activityId"=${scope.activityId} AND "groupId"=${scope.groupId} AND "ownerKey"=${ownerKey} FOR UPDATE`;
  return workspace ?? null;
}
export async function cancelWorkspaceMembers(sql: TeamSql, memberIds: string[], user: CurrentUser, reason: string) {
  if (!memberIds.length) return [];
  const submissions = await sql.query<Array<{ id: string; coreAttemptId: string | null }>>`SELECT id,"coreAttemptId" FROM "PluginCodingHomeworkSubmission" WHERE "workspaceMemberId"=ANY(${memberIds}::text[]) AND kind='final' AND status<>'cancelled' FOR UPDATE`;
  const ids = submissions.map(value => value.id);
  if (ids.length) {
    await sql.execute`UPDATE "PluginCodingHomeworkSubmission" SET status='cancelled', metadata=metadata || ${JSON.stringify({ cancellation: { cancelledAt: new Date().toISOString(), cancelledBy: user.id, reason } })}::jsonb,"updatedAt"=NOW() WHERE id=ANY(${ids}::text[])`;
    await cancelTeamJobs(sql, ids);
  }
  await sql.execute`UPDATE "PluginCodingHomeworkWorkspaceMember" SET "currentSubmissionId"=NULL WHERE id=ANY(${memberIds}::text[])`;
  return submissions.flatMap(value => value.coreAttemptId ? [value.coreAttemptId] : []);
}
export async function cancelTeamJobs(sql: TeamSql, submissionIds: string[]) {
  const keys = submissionIds.map(id => `submission:${id}`);
  await sql.execute`UPDATE "BackgroundJob" SET status='cancelled',"completedAt"=NOW(),"lockedAt"=CASE WHEN status='running' THEN "lockedAt" ELSE NULL END,"lockedBy"=CASE WHEN status='running' THEN "lockedBy" ELSE NULL END
    WHERE queue=${codingHomeworkProcessingQueue} AND "idempotencyKey"=ANY(${keys}::text[]) AND status IN ('queued','running','failed')`;
}
export async function enqueueTeamQuestions(sql: TeamSql, enqueue: Enqueue, workspace: HomeworkWorkspaceRow, submission: HomeworkSubmissionRow) {
  const [row] = await sql.query<Array<{ settings: unknown }>>`SELECT settings FROM "PluginCodingHomeworkAssignment" WHERE "activityId"=${workspace.activityId}`;
  const concurrency = Math.max(1, Math.min(4, Number(record(row?.settings).generationConcurrency ?? 2)));
  await enqueue({ queue: codingHomeworkProcessingQueue, handlerKey: codingHomeworkSubmissionProcessingHandlerKey, idempotencyKey: `submission:${submission.id}`, maxAttempts: 3,
    metadata: { workflowVersion: 2, activityId: workspace.activityId, groupId: workspace.groupId, courseId: workspace.courseId, workspaceId: workspace.id, userId: submission.userId, concurrencyGroup: workspace.activityId, concurrencyLimit: concurrency },
    payload: { workflowVersion: 2, activityId: workspace.activityId, groupId: workspace.groupId, courseId: workspace.courseId, workspaceId: workspace.id, submissionId: submission.id, mode: "student", user: { id: submission.userId } } });
}
export async function copySharedQuestions(sql: TeamSql, sourceId: string, childId: string) {
  await sql.execute`INSERT INTO "PluginCodingHomeworkChallengeQuestion" (id,"submissionId","orderIndex","questionText","generationModel","generationPromptVersion","nearestExamples",metadata,"updatedAt")
    SELECT gen_random_uuid()::text,${childId},"orderIndex","questionText","generationModel","generationPromptVersion","nearestExamples",metadata || ${JSON.stringify({ sharedQuestionSourceId: sourceId })}::jsonb,NOW()
    FROM "PluginCodingHomeworkChallengeQuestion" WHERE "submissionId"=${sourceId} ORDER BY "orderIndex" ON CONFLICT ("submissionId","orderIndex") DO NOTHING`;
  await sql.execute`UPDATE "PluginCodingHomeworkSubmission" SET status='challenge_ready',"processingError"=NULL,"updatedAt"=NOW() WHERE id=${childId} AND status IN ('uploaded','processing','failed')`;
}
export async function createMemberSubmission(sql: TeamSql, enqueue: Enqueue, workspace: HomeworkWorkspaceRow, member: HomeworkWorkspaceMember) {
  if (!workspace.currentSubmissionId || !member.userId || member.currentSubmissionId) return member;
  const [source] = await sql.query<HomeworkSubmissionRow[]>`SELECT * FROM "PluginCodingHomeworkSubmission" WHERE id=${workspace.currentSubmissionId} AND "workspaceId"=${workspace.id} AND kind::text='team_source' AND status<>'cancelled'`;
  if (!source) throw new AppError(409, "HOMEWORK_SHARED_SUBMISSION_CHANGED", "The shared submission changed. Reload this workspace.");
  const id = randomUUID(), shared = record(source.metadata).separateTeamQuestions !== true;
  const metadata = { ...record(source.metadata), workspaceId: workspace.id, workspaceMemberId: member.id, sharedSourceId: source.id,
    generationSourceId: shared ? source.id : id, assessmentStartedAt: undefined, cancellation: undefined, deletion: undefined };
  const [child] = await sql.query<HomeworkSubmissionRow[]>`INSERT INTO "PluginCodingHomeworkSubmission" (id,"activityId","groupId","userId",kind,status,"documentationSnapshotId","structureValidationSummary",metadata,"workspaceId","workspaceMemberId","sharedSourceId","updatedAt")
    VALUES (${id},${workspace.activityId},${workspace.groupId},${member.userId},'final',${shared ? "processing" : "uploaded"}::"PluginCodingHomeworkSubmissionStatus",${source.documentationSnapshotId},${JSON.stringify(source.structureValidationSummary)}::jsonb,${JSON.stringify(metadata)}::jsonb,${workspace.id},${member.id},${source.id},NOW()) RETURNING *`;
  await sql.execute`INSERT INTO "PluginCodingHomeworkSubmissionFile" (id,"submissionId",path,"languageKey","sizeBytes",sha256,"storedName",metadata)
    SELECT gen_random_uuid()::text,${id},path,"languageKey","sizeBytes",sha256,"storedName",metadata FROM "PluginCodingHomeworkSubmissionFile" WHERE "submissionId"=${source.id}`;
  await sql.execute`UPDATE "PluginCodingHomeworkWorkspaceMember" SET "currentSubmissionId"=${id} WHERE id=${member.id}`;
  if (shared && source.status === "challenge_ready") await copySharedQuestions(sql, source.id, id);
  else if (!shared) await enqueueTeamQuestions(sql, enqueue, workspace, child);
  return { ...member, currentSubmissionId: id };
}
export async function addWorkspaceMember(sql: TeamSql, enqueue: Enqueue, workspace: HomeworkWorkspaceRow, participant: { participantId: string; userId: string | null; membershipToken: string }, user: CurrentUser) {
  let [current]: Array<HomeworkWorkspaceMember | undefined> = await sql.query<HomeworkWorkspaceMember[]>`SELECT * FROM "PluginCodingHomeworkWorkspaceMember" WHERE "activityId"=${workspace.activityId} AND "groupId"=${workspace.groupId} AND "participantId"=${participant.participantId} FOR UPDATE`;
  if (current && (current.workspaceId !== workspace.id || current.membershipToken !== participant.membershipToken)) {
    // Core has already withdrawn the old participation on membership change.
    // A restored plugin backup or a later assignment may still have its private binding.
    await cancelWorkspaceMembers(sql, [current.id], user, "Team participation replaced.");
    await sql.execute`DELETE FROM "PluginCodingHomeworkWorkspaceMember" WHERE id=${current.id}`;
    current = undefined;
  }
  let member = current;
  if (!member) {
    [member] = await sql.query<HomeworkWorkspaceMember[]>`INSERT INTO "PluginCodingHomeworkWorkspaceMember" (id,"workspaceId","activityId","groupId","participantId","userId","membershipToken") VALUES (${randomUUID()},${workspace.id},${workspace.activityId},${workspace.groupId},${participant.participantId},${participant.userId},${participant.membershipToken}) RETURNING *`;
    await auditHomeworkWorkspace(sql, workspace, user, "member_joined", { metadata: { participantId: participant.participantId } });
  } else if (member.userId !== participant.userId) {
    await sql.execute`UPDATE "PluginCodingHomeworkWorkspaceMember" SET "userId"=${participant.userId} WHERE id=${member.id}`;
    member = { ...member, userId: participant.userId };
  }
  return createMemberSubmission(sql, enqueue, workspace, member);
}
export async function getHomeworkTeamAccessInTransaction(tx: CorePrisma.TransactionClient, scope: HomeworkStudentScope): Promise<TeamHomeworkAccess> {
  await lockActivityTeamwork(tx, scope.activityId);
  let context = await resolveActivityTeamContext(scope.user, scope.courseId, scope.groupId, scope.activityId, tx);
  if (!context.enabled || !context.groupingId) throw new AppError(409, "HOMEWORK_TEAM_MODE_CHANGED", "The assignment settings changed. Reload this activity.");
  await lockStudentGroupingWorkspaces(tx, context.groupingId);
  context = await resolveActivityTeamContext(scope.user, scope.courseId, scope.groupId, scope.activityId, tx);
  if (!context.teamId && !context.allowIndividualSubmission) throw new AppError(403, "HOMEWORK_TEAM_REQUIRED", "You must belong to a team before you can upload files or submit this homework.");
  const sql = teamworkTransaction(tx);
  const workspace = (await findTeamWorkspace(sql, scope, context))!;
  const enqueue: Enqueue = async job => { await enqueueBackgroundJob(job, tx); };
  const member = await addWorkspaceMember(sql, enqueue, workspace, { participantId: context.participantId, userId: scope.user.id, membershipToken: context.membershipToken }, scope.user);
  return { workspace, member, context };
}
export async function withHomeworkTeamWorkspace<T>(scope: HomeworkStudentScope, action: (tx: CorePrisma.TransactionClient, access: TeamHomeworkAccess) => Promise<T>) {
  const result = await coreDb.$transaction(async tx => action(tx, await getHomeworkTeamAccessInTransaction(tx, scope)), { timeout: 30_000, maxWait: 30_000 });
  void import("./background-processing").then(module => module.startCodingHomeworkProcessingWorker());
  return result;
}

export const homeworkTeamworkService: NonNullable<ServerActivityPlugin["teamwork"]> = {
  activityTypeKeys: ["coding-homework-grader"],
  async hasActiveSubmissions({ activityId, groupId, transaction: sql }) {
    const [exists] = await sql.query<Array<{ present: boolean }>>`SELECT to_regclass('"PluginCodingHomeworkSubmission"') IS NOT NULL AS present`;
    if (!exists.present) return false;
    const [row] = await sql.query<Array<{ present: boolean }>>`SELECT EXISTS(SELECT 1 FROM "PluginCodingHomeworkSubmission" WHERE "activityId"=${activityId} AND (${groupId ?? null}::text IS NULL OR "groupId"=${groupId ?? null}) AND kind::text IN ('final','team_source') AND status NOT IN ('cancelled','invalid_structure') AND NOT metadata ? 'deletion') AS present`;
    return row.present;
  },
  async membershipChanged(input) {
    const sql = input.transaction;
    const [exists] = await sql.query<Array<{ present: boolean }>>`SELECT to_regclass('"PluginCodingHomeworkWorkspace"') IS NOT NULL AS present`;
    if (!exists.present) return {};
    const affected = input.changes.map(change => change.participantId);
    const members = await sql.query<HomeworkWorkspaceMember[]>`SELECT m.* FROM "PluginCodingHomeworkWorkspaceMember" m JOIN "PluginCodingHomeworkWorkspace" w ON w.id=m."workspaceId"
      WHERE m."activityId"=${input.activityId} AND m."groupId"=${input.groupId} AND w."groupingId"=${input.groupingId} AND m."participantId"=ANY(${affected}::text[]) FOR UPDATE OF m`;
    const withdrawAttemptIds = await cancelWorkspaceMembers(sql, members.map(member => member.id), input.user, "Team membership changed.");
    for (const member of members) {
      const [workspace] = await sql.query<HomeworkWorkspaceRow[]>`SELECT * FROM "PluginCodingHomeworkWorkspace" WHERE id=${member.workspaceId}`;
      if (workspace) await auditHomeworkWorkspace(sql, workspace, input.user, "member_left", { metadata: { participantId: member.participantId } });
    }
    await sql.execute`DELETE FROM "PluginCodingHomeworkWorkspaceMember" WHERE id=ANY(${members.map(member => member.id)}::text[])`;
    const empty = await sql.query<HomeworkWorkspaceRow[]>`SELECT * FROM "PluginCodingHomeworkWorkspace" WHERE "activityId"=${input.activityId} AND "groupId"=${input.groupId} AND "groupingId"=${input.groupingId}
      AND (${input.groupingRemoved === true} OR "teamId"=ANY(${input.emptyTeamIds}::text[]) OR "ownerParticipantId"=ANY(${affected}::text[])) FOR UPDATE`;
    for (const workspace of empty) {
      const old = await sql.query<Array<{ id: string; coreAttemptId: string | null; kind: string }>>`SELECT id,"coreAttemptId",kind::text FROM "PluginCodingHomeworkSubmission" WHERE "workspaceId"=${workspace.id}`;
      withdrawAttemptIds.push(...old.flatMap(row => row.coreAttemptId ? [row.coreAttemptId] : []));
      await cancelTeamJobs(sql, old.map(row => row.id));
      await auditHomeworkWorkspace(sql, workspace, input.user, "empty_workspace_erased", { metadata: { submissionCount: old.length } });
      await sql.execute`DELETE FROM "PluginCodingHomeworkWorkspace" WHERE id=${workspace.id}`;
      await input.enqueue({ queue: codingHomeworkProcessingQueue, handlerKey: homeworkWorkspaceCleanupHandler, idempotencyKey: `workspace-cleanup:${workspace.id}`, payload: { activityId: input.activityId, workspaceId: workspace.id, sourceIds: old.filter(row => row.kind === "team_source").map(row => row.id) } });
    }
    if (!input.groupingRemoved && input.assignment?.groupingId === input.groupingId) {
      for (const change of input.changes.filter(value => !value.removed)) {
        const workspace = await findTeamWorkspace(sql, input, { groupingId: input.groupingId, teamId: change.teamId, participantId: change.participantId, membershipToken: input.membershipToken, workspaceEpoch: change.teamId ? input.teamWorkspaceEpochs[change.teamId] ?? "initial" : input.membershipToken }, false);
        if (workspace) await addWorkspaceMember(sql, input.enqueue, workspace, { ...change, membershipToken: input.membershipToken }, input.user);
      }
    }
    void import("./background-processing").then(module => module.startCodingHomeworkProcessingWorker());
    return { withdrawAttemptIds };
  }
};

export async function cleanupHomeworkWorkspace(job: BackgroundJobRecord) {
  const workspaceId = String(job.payload.workspaceId), sourceIds = Array.isArray(job.payload.sourceIds) ? job.payload.sourceIds : [];
  if (![workspaceId, ...sourceIds].every(id => typeof id === "string" && /^[a-zA-Z0-9-]+$/.test(id))) throw new Error("Invalid workspace cleanup identity.");
  const [present] = await coreDb.$queryRaw<Array<{ present: boolean }>>`SELECT EXISTS(SELECT 1 FROM "PluginCodingHomeworkWorkspace" WHERE id=${workspaceId}) AS present`;
  if (present.present) throw new Error("Cannot erase files of a retained workspace.");
  await rm(path.join(homeworkStorageRoot(), "drafts", workspaceId), { recursive: true, force: true });
  for (const id of sourceIds) await rm(path.join(homeworkStorageRoot(), "submissions", String(id)), { recursive: true, force: true });
  return { erased: true };
}
