import { readHomeworkSubmissionPolicy, readHomeworkSubmissionTiming } from "./submission-policy";
import { acceptHomeworkSubmissionTiming, automaticHomeworkTiming, assertAutomaticHomeworkDraft, type AutomaticHomeworkHandIn } from "./submission-window";
import { randomUUID, createHash } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { prisma as coreDb } from "@cognelo/db";
import { AppError, getActivityAttemptAvailability, snapshotAiModelSelection, enqueueBackgroundJob, teamworkTransaction, getTeamWorkspaceEpoch } from "@cognelo/core";
import { getHomeworkRequirements, homeworkStorageRoot, readHomeworkDraftEntries, record, type HomeworkStudentScope } from "./file-preparation";
import { codingHomeworkSubmissionReadiness, validateCodingHomeworkArchive } from "./validation";
import { lockHomeworkSettings } from "./workflow-settings";
import { lockHomeworkUploadBudget } from "./upload-budget";
import { snapshotProvidedCode } from "./provided-code";
import { getHomeworkQuestionLanguage } from "./question-generation-policy";
import { getHomeworkQuestionConnection } from "./ai-selection";
import { addWorkspaceMember, auditHomeworkWorkspace, enqueueTeamQuestions, withHomeworkTeamWorkspace, type HomeworkSubmissionRow, type TeamHomeworkAccess, type TeamSql } from "./team-workspaces";
import { teamWorkspaceProjection, assertTeamContext } from "./team-preparation";
import { codingHomeworkProcessingQueue } from "./processing-constants";

export async function currentTeamSubmission(sql: TeamSql, access: TeamHomeworkAccess) {
  if (!access.workspace.currentSubmissionId || !access.member.currentSubmissionId) return null;
  const [submission] = await sql.query<HomeworkSubmissionRow[]>`SELECT * FROM "PluginCodingHomeworkSubmission" WHERE id=${access.member.currentSubmissionId} AND "workspaceId"=${access.workspace.id}
    AND "workspaceMemberId"=${access.member.id} AND "sharedSourceId"=${access.workspace.currentSubmissionId} AND kind='final' AND status<>'cancelled' AND NOT metadata ? 'deletion'`;
  return submission ?? null;
}

export async function handInTeamHomework(scope: HomeworkStudentScope, input: unknown, automatic?: AutomaticHomeworkHandIn) {
  const data = z.object({ expectedRevision: z.number().int().min(0), contextKey: z.string().max(200).optional(), acknowledgeIncomplete: z.boolean().default(false), locale: z.enum(["en", "fr", "zh", "ar"]).default("en") }).strict().parse(input);
  const sourceId = randomUUID(), directory = path.join(homeworkStorageRoot(), "submissions", sourceId);
  let committed = false;
  try {
    await withHomeworkTeamWorkspace(scope, async (tx, access) => {
      if (automatic) { if (access.workspace.id !== automatic.workspaceId) throw new AppError(409, "HOMEWORK_MEMBERSHIP_CHANGED", "The student's team workspace changed."); }
      else assertTeamContext(access, data.contextKey);
      if (access.workspace.currentSubmissionId) return; // A teammate may have just handed in this workspace.
      if (!access.context.teamId && !access.context.allowIndividualSubmission) throw new AppError(403, "HOMEWORK_TEAM_REQUIRED", "Join a team before submitting this homework.");
      const availability = automatic ? null : await getActivityAttemptAvailability(scope.user, scope);
      if (availability && !availability.canStart) throw new AppError(409, availability.reason ?? "HOMEWORK_ATTEMPT_UNAVAILABLE", "A new submission is not currently available.");
      await lockHomeworkSettings(tx, scope.activityId);
      const sql = teamworkTransaction(tx);
      const [assignment] = await sql.query<Array<{ promptMarkdown: string; candidateLimit: number; questionCount: number; retrievedExampleCount: number; generationInstructions: string; languageKey: string; settings: unknown }>>`SELECT * FROM "PluginCodingHomeworkAssignment" WHERE "activityId"=${scope.activityId}`;
      const settings = record(assignment?.settings);
      if (!assignment || settings.submissionsEnabled !== true || typeof settings.preparedSnapshotId !== "string") throw new AppError(409, "HOMEWORK_SUBMISSIONS_CLOSED", "Your teacher has not enabled final submissions yet.");
      if (automatic) automaticHomeworkTiming(settings, automatic); else acceptHomeworkSubmissionTiming(settings);
      if (automatic) {
        const [latest] = await sql.query<HomeworkSubmissionRow[]>`SELECT * FROM "PluginCodingHomeworkSubmission" WHERE "workspaceId"=${access.workspace.id} AND kind::text='team_source' ORDER BY "createdAt" DESC LIMIT 1`;
        assertAutomaticHomeworkDraft(access.workspace, latest ?? null, automatic);
      }
      if (access.workspace.revision !== data.expectedRevision) throw new AppError(409, "HOMEWORK_DRAFT_CONFLICT", "The shared files changed. Check them again before submitting.");
      const entries = await readHomeworkDraftEntries(access.workspace), requirements = await getHomeworkRequirements(scope.activityId);
      const validation = await validateCodingHomeworkArchive({ entries, requirements, archiveSizeBytes: entries.reduce((sum, entry) => sum + entry.uncompressedSize, 0) });
      const readiness = codingHomeworkSubmissionReadiness(validation);
      if (!readiness.canSubmit) throw new AppError(400, "HOMEWORK_FILES_INVALID", "Resolve the file safety issues before submitting.");
      if (readiness.requiresAcknowledgement && !data.acknowledgeIncomplete && !automatic) throw new AppError(409, "HOMEWORK_INCOMPLETE_ACKNOWLEDGEMENT_REQUIRED", "Confirm that you are submitting incomplete work for your team.", { issues: readiness.incomplete });
      await lockHomeworkUploadBudget(tx, scope.activityId, scope.user.id, entries.reduce((sum, entry) => sum + entry.uncompressedSize, 0));
      const separateTeamQuestions = !access.context.teamId || settings.separateTeamQuestions === true;
      const metadata = { workflowVersion: 2, workspaceId: access.workspace.id, teamId: access.context.teamId, teamName: access.context.teamTitle, groupingId: access.context.groupingId,
        submittedBy: scope.user.id, handInAt: new Date().toISOString(), draftRevision: access.workspace.revision,
        incompleteAcknowledged: readiness.requiresAcknowledgement, separateTeamQuestions,
        providedCode: await snapshotProvidedCode(scope.activityId), questionLanguage: await getHomeworkQuestionLanguage(scope.courseId),
        questionGenerationAi: snapshotAiModelSelection(await getHomeworkQuestionConnection(scope, settings)),
        requirements, folders: access.workspace.folders,
        assignment: { candidateLimit: assignment.candidateLimit, languageKey: assignment.languageKey, promptMarkdown: assignment.promptMarkdown, generationInstructions: assignment.generationInstructions, questionCount: assignment.questionCount, retrievedExampleCount: assignment.retrievedExampleCount } };
      const submissionTiming = automatic ? automaticHomeworkTiming(settings, automatic) : acceptHomeworkSubmissionTiming(settings);
      Object.assign(metadata, { handInAt: submissionTiming.submittedAt, submissionTiming, ...(automatic ? { automaticHandIn: { cutoff: automatic.cutoff, recoveredAt: new Date().toISOString(), triggeredBy: automatic.triggeredBy, acknowledgementSource: "automatic_deadline" } } : {}) });
      const [owner] = await sql.query<Array<{ createdById: string }>>`SELECT "createdById" FROM "Activity" WHERE id=${scope.activityId}`;
      const [source] = await sql.query<HomeworkSubmissionRow[]>`INSERT INTO "PluginCodingHomeworkSubmission" (id,"activityId","groupId","userId",kind,status,"documentationSnapshotId","structureValidationSummary",metadata,"workspaceId","updatedAt")
        VALUES (${sourceId},${scope.activityId},${scope.groupId},${owner.createdById},'team_source',${separateTeamQuestions ? "structure_valid" : "uploaded"}::"PluginCodingHomeworkSubmissionStatus",${settings.preparedSnapshotId},${JSON.stringify(validation)}::jsonb,${JSON.stringify(metadata)}::jsonb,${access.workspace.id},NOW()) RETURNING *`;
      await mkdir(path.join(directory, "files"), { recursive: true, mode: 0o750 });
      for (const entry of entries) {
        if (entry.isDirectory || !entry.content || !validation.validFiles.includes(entry.path)) continue;
        const storedName = `${sourceId}/files/${randomUUID()}-source`;
        await writeFile(path.join(homeworkStorageRoot(), "submissions", storedName), entry.content, { mode: 0o640, flag: "wx" });
        await sql.execute`INSERT INTO "PluginCodingHomeworkSubmissionFile" (id,"submissionId",path,"languageKey","sizeBytes",sha256,"storedName") VALUES
          (${randomUUID()},${sourceId},${entry.path},${/\.(c|h)$/i.test(entry.path) ? "c" : null},${BigInt(entry.content.length)},${createHash("sha256").update(entry.content).digest("hex")},${storedName})`;
      }
      await sql.execute`UPDATE "PluginCodingHomeworkWorkspace" SET "currentSubmissionId"=${sourceId},"updatedAt"=NOW() WHERE id=${access.workspace.id}`;
      const workspace = { ...access.workspace, currentSubmissionId: sourceId };
      const enqueue = async (job: Parameters<typeof enqueueBackgroundJob>[0]) => { await enqueueBackgroundJob(job, tx); };
      const participants = access.context.teamId ? access.context.members : [{ participantId: access.context.participantId, userId: scope.user.id, membershipToken: access.context.membershipToken }];
      for (const participant of participants) await addWorkspaceMember(sql, enqueue, workspace, participant, scope.user);
      if (!separateTeamQuestions) await enqueueTeamQuestions(sql, enqueue, workspace, source);
      await auditHomeworkWorkspace(sql, workspace, scope.user, "submitted", { metadata: { sourceId, revision: workspace.revision, incompleteAcknowledged: readiness.requiresAcknowledgement, memberCount: participants.length, separateTeamQuestions } });
    });
    committed = true;
    return automatic ? null : getTeamHomeworkWorkspace(scope);
  } finally { if (!committed) await rm(directory, { recursive: true, force: true }); }
}

export async function getTeamHomeworkWorkspace(scope: HomeworkStudentScope) {
  try { return await withHomeworkTeamWorkspace(scope, async (tx, access) => {
    const sql = teamworkTransaction(tx), submission = await currentTeamSubmission(sql, access);
    const [assignment] = await sql.query<Array<{ settings: unknown; questionCount: number }>>`SELECT settings,"questionCount" FROM "PluginCodingHomeworkAssignment" WHERE "activityId"=${scope.activityId}`;
    const generationId = submission ? String(record(submission.metadata).generationSourceId ?? submission.id) : null;
    const job = generationId ? await tx.backgroundJob.findUnique({ where: { queue_idempotencyKey: { queue: codingHomeworkProcessingQueue, idempotencyKey: `submission:${generationId}` } } }) : null;
    const position = job?.status === "queued" ? 1 + await tx.backgroundJob.count({ where: { queue: job.queue, status: "queued", createdAt: { lt: job.createdAt } } }) : null;
    const files = submission ? await sql.query<Array<{ path: string; sizeBytes: bigint }>>`SELECT path,"sizeBytes" FROM "PluginCodingHomeworkSubmissionFile" WHERE "submissionId"=${submission.id} ORDER BY path` : [];
    const [cancelled] = await sql.query<Array<{ present: boolean }>>`SELECT EXISTS(SELECT 1 FROM "PluginCodingHomeworkSubmission" WHERE "workspaceMemberId"=${access.member.id} AND status='cancelled') AS present`;
    return { submissionPolicy: readHomeworkSubmissionPolicy(assignment?.settings), submissionsEnabled: record(assignment?.settings).submissionsEnabled === true, teamwork: teamWorkspaceProjection(access),
      previousCancelled: !submission && cancelled.present,
      submission: submission ? { automaticHandIn: Boolean(record(submission.metadata).automaticHandIn), submissionTiming: readHomeworkSubmissionTiming(submission.metadata), id: submission.id, status: submission.status, createdAt: submission.createdAt.toISOString(), started: Boolean(record(submission.metadata).assessmentStartedAt), coreAttemptId: submission.coreAttemptId,
        processingStatus: job?.status ?? null, generationIssue: record(job?.error).code === "HOMEWORK_NO_ELIGIBLE_CODE" ? "no_eligible_code" : null, queuePosition: position,
        questionCount: Number(record(record(submission.metadata).assignment).questionCount ?? assignment?.questionCount ?? 3), files: files.map(file => ({ path: file.path, sizeBytes: Number(file.sizeBytes) })), incompleteAcknowledged: record(submission.metadata).incompleteAcknowledged === true } : null };
  }); } catch (error) {
    if (!(error instanceof AppError) || error.code !== "HOMEWORK_TEAM_REQUIRED") throw error;
    const [assignment] = await coreDb.$queryRaw<Array<{ settings: unknown }>>`SELECT settings FROM "PluginCodingHomeworkAssignment" WHERE "activityId"=${scope.activityId}`;
    // Assignment resources remain readable without creating a private draft or member binding.
    return { submissionPolicy: readHomeworkSubmissionPolicy(assignment?.settings), submissionsEnabled: record(assignment?.settings).submissionsEnabled === true, previousCancelled: false, submission: null,
      teamwork: { contextKey: "team-required", draftRevision: 0, teamId: null, teamName: null, members: [], canSubmit: false } };
  }
}

/** All student read/write paths use the current member pointer, never only userId. */
export async function assertCurrentTeamSubmissionAccess(scope: HomeworkStudentScope, submission: { id: string; workspaceId?: string | null; metadata?: unknown }) {
  if (!submission.workspaceId && !record(submission.metadata).workspaceId) return;
  await withHomeworkTeamWorkspace(scope, async (tx, access) => {
    if ((await currentTeamSubmission(teamworkTransaction(tx), access))?.id !== submission.id) throw new AppError(403, "HOMEWORK_TEAM_ACCESS_CHANGED", "You no longer have access to this team's submission. Reload your current workspace.");
  });
}

export async function getCurrentTeamHomeworkSubmission(scope: HomeworkStudentScope) {
  return withHomeworkTeamWorkspace(scope, async (tx, access) => currentTeamSubmission(teamworkTransaction(tx), access));
}

export async function publishSharedTeamQuestions(sql: TeamSql, source: { id: string; workspaceId?: string | null }) {
  if (!source.workspaceId) return;
  const { copySharedQuestions } = await import("./team-workspaces");
  const children = await sql.query<Array<{ id: string }>>`SELECT s.id FROM "PluginCodingHomeworkSubmission" s JOIN "PluginCodingHomeworkWorkspaceMember" m ON m.id=s."workspaceMemberId" AND m."currentSubmissionId"=s.id
    JOIN "PluginCodingHomeworkWorkspace" w ON w.id=s."workspaceId" AND w."currentSubmissionId"=${source.id}
    WHERE s."sharedSourceId"=${source.id} AND s.kind='final' AND s.status IN ('uploaded','processing','failed')`;
  for (const child of children) await copySharedQuestions(sql, source.id, child.id);
}

export async function currentTeamGenerationActor(submission: { kind: string; workspaceId?: string | null; userId: string }) {
  if (submission.kind !== "team_source" || !submission.workspaceId) return submission.userId;
  const [member] = await coreDb.$queryRaw<Array<{ userId: string }>>`SELECT m."userId" FROM "PluginCodingHomeworkWorkspaceMember" m JOIN "User" u ON u.id=m."userId" AND u."isActive"=TRUE
    JOIN "CourseGroupParticipant" p ON p.id=m."participantId" AND p."userId"=u.id AND p.role='student'
    JOIN "PluginCodingHomeworkWorkspace" w ON w.id=m."workspaceId" AND w."groupId"=p."groupId"
    WHERE (w."teamId" IS NULL OR EXISTS(SELECT 1 FROM "StudentTeamMember" tm WHERE tm."participantId"=p.id AND tm."teamId"=w."teamId" AND tm."groupingId"=w."groupingId")) AND m."workspaceId"=${submission.workspaceId} ORDER BY m."createdAt",m.id LIMIT 1`;
  return member?.userId ?? submission.userId;
}

export async function assertTeamGenerationCurrent(sql: TeamSql, submission: { id: string; kind: string; workspaceId?: string | null; workspaceMemberId?: string | null; sharedSourceId?: string | null }) {
  if (!submission.workspaceId) return;
  const [workspace] = await sql.query<Array<{ currentSubmissionId: string | null; courseId: string; groupingId: string; teamId: string | null; ownerKey: string }>>`SELECT * FROM "PluginCodingHomeworkWorkspace" WHERE id=${submission.workspaceId} FOR UPDATE`;
  if (!workspace || workspace.currentSubmissionId !== (submission.kind === "team_source" ? submission.id : submission.sharedSourceId)) throw new AppError(409, "HOMEWORK_TEAM_ACCESS_CHANGED", "This shared submission was cancelled or erased.");
  if (workspace.teamId) {
    const epoch = await getTeamWorkspaceEpoch({ $queryRaw: sql.query, $executeRaw: sql.execute }, workspace.courseId, workspace.groupingId, workspace.teamId);
    if (!workspace.ownerKey.endsWith(`:${epoch}`)) throw new AppError(409, "HOMEWORK_TEAM_ACCESS_CHANGED", "This team workspace was erased.");
  }
  if (submission.kind !== "team_source") {
    const [member] = await sql.query<Array<{ currentSubmissionId: string | null }>>`SELECT "currentSubmissionId" FROM "PluginCodingHomeworkWorkspaceMember" WHERE id=${submission.workspaceMemberId ?? null} AND "workspaceId"=${submission.workspaceId}`;
    if (member?.currentSubmissionId !== submission.id) throw new AppError(409, "HOMEWORK_TEAM_ACCESS_CHANGED", "This student's team participation was replaced.");
  }
}
