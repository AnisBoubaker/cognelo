import { randomUUID } from "node:crypto";
import type { SubmissionStageActivationChange, SubmissionStageActivationScope, PluginTeamworkTransaction } from "@cognelo/activity-sdk/server";
import { configuredActivityStageActivations, AppError, NonRetryableBackgroundJobError, lockActivityTeamwork, teamworkTransaction, contentIndexRevision, createCourseEmbeddingProvider, getActivityMaterialReferences, lockCourseMaterialEmbeddingSettings, materialEmbeddingSelectionIdentity, snapshotAiModelSelection, type BackgroundJobRecord } from "@cognelo/core";
import { prisma as coreDb } from "@cognelo/db";
import { prisma } from "./db-client";
import { getHomeworkQuestionConnection } from "./ai-selection";
import { record } from "./file-preparation";
import { homeworkQuestionsEnabled } from "./question-policy";
import { questionStageLocksReferences, homeworkStageEnabled, homeworkStageConfiguration } from "./stage-activation-state";
import { codingHomeworkProcessingQueue, codingHomeworkSubmissionProcessingHandlerKey } from "./processing-constants";

type Scope = Omit<SubmissionStageActivationScope, "enabled">;
type Prepared = { references: Awaited<ReturnType<typeof getActivityMaterialReferences>> | null; previousQuestionsEnabled?: boolean };
type Submission = { id: string; groupId: string; userId: string; kind: string; status: string; metadata: unknown; documentationSnapshotId: string | null; workspaceId: string | null; sharedSourceId: string | null; workspaceMemberId: string | null };
export const homeworkStageHoldUntil = new Date("9999-01-01T00:00:00.000Z");

export async function prepareHomeworkStageActivation(scope: Scope): Promise<Prepared> {
  const assignment = await prisma.pluginCodingHomeworkAssignment.findUnique({ where: { activityId: scope.activityId }, select: { settings: true } });
  const settings = record(assignment?.settings);
  const previous = await configuredActivityStageActivations(prisma, scope.activityId, homeworkStageConfiguration(settings));
  return { references: homeworkQuestionsEnabled(settings) ? await getActivityMaterialReferences(scope) : null, previousQuestionsEnabled: previous.questions };
}
export async function validateHomeworkQuestionActivation(scope: Scope, settings: Record<string, unknown>, references: Prepared["references"], sql: PluginTeamworkTransaction) {
  const revision = contentIndexRevision({ selected: Array.isArray(settings.referenceMaterialIds) ? settings.referenceMaterialIds : null, preparedId: settings.preparedSnapshotId ?? null, locked: questionStageLocksReferences(settings) });
  if (!references?.prepared || revision !== references.revision || typeof settings.preparedSnapshotId !== "string") throw new AppError(409, "HOMEWORK_EMBEDDINGS_REQUIRED", "Prepare the saved reference selection before activating challenge questions.");
  await lockCourseMaterialEmbeddingSettings({ $queryRaw: sql.query }, scope.courseId);
  if (!references.locked && references.selected.length && materialEmbeddingSelectionIdentity((await createCourseEmbeddingProvider(scope.user, scope.courseId)).selection) !== references.embedding.identity) throw new AppError(409, "COURSE_EMBEDDING_MODEL_CHANGED", "The course embedding model changed. Prepare the reference selection again.");
  return snapshotAiModelSelection(await getHomeworkQuestionConnection(scope, settings));
}

/** Called with the activity/settings transaction: no provider call is made here. */
export async function applyHomeworkStageActivation(input: SubmissionStageActivationChange) {
  const sql = input.transaction;
  await sql.query`SELECT 1 FROM pg_advisory_xact_lock(hashtextextended(${`homework-settings:${input.activityId}`}, 0))`;
  await sql.execute`INSERT INTO "PluginCodingHomeworkAssignment" (id,"activityId",settings,"updatedAt") VALUES (${randomUUID()},${input.activityId},'{}'::jsonb,NOW()) ON CONFLICT ("activityId") DO NOTHING`;
  const [assignment] = await sql.query<Array<{ settings: unknown }>>`SELECT settings FROM "PluginCodingHomeworkAssignment" WHERE "activityId"=${input.activityId}`;
  const settings = record(assignment.settings), questionsEnabled = Boolean(input.enabled.questions) && homeworkQuestionsEnabled(settings);
  const references = (input.prepared as Prepared | undefined)?.references ?? null;
  // An unprepared legacy homework with its old file gate closed must remain editable.
  const preserveClosedLegacy = settings.questionsStageEnabled === undefined && (input.prepared as Prepared | undefined)?.previousQuestionsEnabled === true && !input.enabled.files && typeof settings.preparedSnapshotId !== "string";
  let model: Awaited<ReturnType<typeof validateHomeworkQuestionActivation>> | null = null;
  if (questionsEnabled && !questionStageLocksReferences(settings) && !preserveClosedLegacy) model = await validateHomeworkQuestionActivation(input, settings, references, sql);
  const next = { ...settings, submissionsEnabled: Boolean(input.enabled.files), ...(!preserveClosedLegacy || !questionsEnabled ? { questionsStageEnabled: questionsEnabled } : {}), workflowVersion: 2 };
  await sql.execute`UPDATE "PluginCodingHomeworkAssignment" SET settings=${JSON.stringify(next)}::jsonb,"updatedAt"=NOW() WHERE "activityId"=${input.activityId}`;

  // Preparing a draft while closed must not consume its optional stage duration.
  const drafts = await sql.query<Array<{ id: string; groupId: string; userId: string }>>`SELECT id,"groupId","userId" FROM "PluginCodingHomeworkDraft" WHERE "activityId"=${input.activityId} AND "preparationStartedAt" IS NULL AND jsonb_array_length(files)>0`;
  for (const draft of drafts) if (await input.isEnabled({ groupId: draft.groupId, userId: draft.userId, stageId: "files" })) await sql.execute`UPDATE "PluginCodingHomeworkDraft" SET "preparationStartedAt"=NOW() WHERE id=${draft.id} AND "preparationStartedAt" IS NULL`;
  const workspaces = await sql.query<Array<{ id: string; groupId: string }>>`SELECT id,"groupId" FROM "PluginCodingHomeworkWorkspace" WHERE "activityId"=${input.activityId} AND "preparationStartedAt" IS NULL AND "currentSubmissionId" IS NULL AND jsonb_array_length(files)>0`;
  for (const workspace of workspaces) {
    const members = await sql.query<Array<{ userId: string }>>`SELECT "userId" FROM "PluginCodingHomeworkWorkspaceMember" WHERE "workspaceId"=${workspace.id} AND "userId" IS NOT NULL ORDER BY id`;
    for (const member of members) if (await input.isEnabled({ groupId: workspace.groupId, userId: member.userId, stageId: "files" })) { await sql.execute`UPDATE "PluginCodingHomeworkWorkspace" SET "preparationStartedAt"=NOW() WHERE id=${workspace.id} AND "preparationStartedAt" IS NULL`; break; }
  }

  const submissions = await sql.query<Submission[]>`SELECT * FROM "PluginCodingHomeworkSubmission" WHERE "activityId"=${input.activityId} AND status IN ('uploaded','processing','structure_valid') AND NOT metadata ? 'deletion' AND metadata->>'questionGenerationEnabled' IS DISTINCT FROM 'false' ORDER BY "createdAt",id FOR UPDATE`;
  const current = async (submission: Submission) => {
    if (!submission.workspaceId) return input.isEnabled({ groupId: submission.groupId, userId: submission.userId, stageId: "questions" });
    const members = await sql.query<Array<{ userId: string; submissionId: string | null }>>`SELECT m."userId",m."currentSubmissionId" AS "submissionId" FROM "PluginCodingHomeworkWorkspaceMember" m JOIN "PluginCodingHomeworkWorkspace" w ON w.id=m."workspaceId"
      WHERE w.id=${submission.workspaceId} AND w."currentSubmissionId"=${submission.kind === 'team_source' ? submission.id : submission.sharedSourceId} AND m."userId" IS NOT NULL AND m."currentSubmissionId" IS NOT NULL
        AND (w."teamId" IS NULL OR EXISTS(SELECT 1 FROM "StudentTeamMember" tm WHERE tm."teamId"=w."teamId" AND tm."groupingId"=w."groupingId" AND tm."participantId"=m."participantId"))
        AND (${submission.kind === 'team_source'} OR m.id=${submission.workspaceMemberId}) ORDER BY m.id`;
    for (const member of members) if (await input.isEnabled({ groupId: submission.groupId, userId: member.userId, stageId: "questions" })) return true;
    return false;
  };
  for (const submission of submissions) {
    const metadata = record(submission.metadata), sharedChild = submission.kind === "final" && submission.workspaceId && metadata.separateTeamQuestions !== true;
    if (sharedChild) continue;
    const enabled = await current(submission);
    if (enabled && (!submission.documentationSnapshotId || !record(metadata.questionGenerationAi).connectionId)) {
      model ??= await validateHomeworkQuestionActivation(input, settings, references, sql);
      const pinned = { ...metadata, questionGenerationAi: model, awaitingStageActivation: false };
      await sql.execute`UPDATE "PluginCodingHomeworkSubmission" SET "documentationSnapshotId"=${String(settings.preparedSnapshotId)},metadata=${JSON.stringify(pinned)}::jsonb,"updatedAt"=NOW() WHERE id=${submission.id}`;
      if (submission.kind === "team_source") await sql.execute`UPDATE "PluginCodingHomeworkSubmission" SET "documentationSnapshotId"=${String(settings.preparedSnapshotId)},metadata=metadata || ${JSON.stringify({ questionGenerationAi: model, awaitingStageActivation: false })}::jsonb,"updatedAt"=NOW() WHERE "sharedSourceId"=${submission.id} AND kind='final' AND status IN ('uploaded','processing')`;
    }
    if (!enabled) {
      await sql.execute`UPDATE "BackgroundJob" SET "runAfter"=${homeworkStageHoldUntil},metadata=metadata || '{"stageActivationHeld":true}'::jsonb,"updatedAt"=NOW() WHERE queue=${codingHomeworkProcessingQueue} AND "idempotencyKey"=${`submission:${submission.id}`} AND status='queued'`;
      continue;
    }
    if (submission.kind === "team_source" && metadata.separateTeamQuestions === true) continue;
    const concurrency = Math.max(1, Math.min(4, Number(settings.generationConcurrency ?? 2)));
    await input.enqueue({ queue: codingHomeworkProcessingQueue, handlerKey: codingHomeworkSubmissionProcessingHandlerKey, idempotencyKey: `submission:${submission.id}`, maxAttempts: 3,
      metadata: { workflowVersion: 2, activityId: input.activityId, groupId: submission.groupId, courseId: input.courseId, userId: submission.userId, concurrencyGroup: input.activityId, concurrencyLimit: concurrency },
      payload: { workflowVersion: 2, activityId: input.activityId, groupId: submission.groupId, courseId: input.courseId, submissionId: submission.id, mode: "student", user: { id: submission.userId } } });
    await sql.execute`UPDATE "BackgroundJob" SET "runAfter"=NOW(),metadata=metadata-'stageActivationHeld',"updatedAt"=NOW() WHERE queue=${codingHomeworkProcessingQueue} AND "idempotencyKey"=${`submission:${submission.id}`} AND status='queued' AND metadata->>'stageActivationHeld'='true'`;
  }
}

/** A closed teacher gate is not a provider failure and consumes no retry attempt. */
export async function assertHomeworkGenerationActivated(job: BackgroundJobRecord, submission: { id: string; kind: string; workspaceId?: string | null; userId: string }, groupId: string, activityId: string) {
  const paused = await coreDb.$transaction(async tx => {
    // Serialize the check/hold with teacher activation so a rapid reopen cannot miss its wakeup.
    await lockActivityTeamwork(tx, activityId);
    const sql = teamworkTransaction(tx);
    const members = submission.kind === "team_source" ? await sql.query<Array<{ userId: string }>>`SELECT m."userId" FROM "PluginCodingHomeworkWorkspaceMember" m
      JOIN "PluginCodingHomeworkWorkspace" w ON w.id=m."workspaceId" AND w."currentSubmissionId"=${submission.id}
      WHERE m."workspaceId"=${submission.workspaceId} AND m."userId" IS NOT NULL AND m."currentSubmissionId" IS NOT NULL
        AND (w."teamId" IS NULL OR EXISTS(SELECT 1 FROM "StudentTeamMember" tm WHERE tm."teamId"=w."teamId" AND tm."groupingId"=w."groupingId" AND tm."participantId"=m."participantId")) ORDER BY m.id`
      : [{ userId: submission.userId }];
    for (const member of members) if (await homeworkStageEnabled({ activityId, groupId, user: { id: member.userId } }, "questions", sql)) return false;
    const changed = await sql.execute`UPDATE "BackgroundJob" SET status='queued',"runAfter"=${homeworkStageHoldUntil},metadata=metadata || '{"stageActivationHeld":true}'::jsonb,attempts=GREATEST(0,attempts-1),"lockedAt"=NULL,"lockedBy"=NULL,"updatedAt"=NOW()
      WHERE id=${job.id} AND status='running' AND "lockedBy"=${job.lockedBy}`;
    if (changed) await sql.execute`UPDATE "PluginCodingHomeworkSubmission" SET status='uploaded',"updatedAt"=NOW() WHERE id=${submission.id} AND status='processing'`;
    return true;
  });
  if (paused) throw new NonRetryableBackgroundJobError("Awaiting teacher activation.", "SUBMISSION_STAGE_NOT_ACTIVATED");
}
