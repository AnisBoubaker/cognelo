import { snapshotProvidedCode } from "./provided-code";
import { getHomeworkQuestionConnection, storedHomeworkAiSelection } from "./ai-selection";
import { z } from "zod";
import { AiModelSelectionSchema, type CurrentUser } from "@cognelo/contracts";
import { AppError, updateBackgroundJobConcurrency, getAiAgentConnectionForUser, getCourseAiAgentConnection, snapshotAiModelSelection, listAiAgentConnections, assertCanManageCourse, contentIndexRevision,
  getActivityMaterialReferences, getActivityMaterialReferenceTree, saveActivityMaterialReferences, prepareActivityReferenceMaterial, finishActivityMaterialReferencePreparation, getActivityMaterialReferencePreview,
  createCourseEmbeddingProvider, lockCourseMaterialEmbeddingSettings, materialEmbeddingSelectionIdentity, teamworkTransaction } from "@cognelo/core";
import { prisma, type Prisma } from "./db-client";
import { json, record } from "./file-preparation";
import { homeworkSubmissionPolicySchema, readHomeworkSubmissionPolicy } from "./submission-policy";

export type HomeworkTeacherScope = { user: CurrentUser; courseId: string; activityId: string };
export const workflowSettingKeys = ["workflowVersion", "submissionsEnabled", "preparedSnapshotId", "referenceMaterialIds", "embeddingConnectionId", "generationConcurrency", "embeddingAi", "questionGenerationAi", "submissionPolicy"] as const;
export async function lockHomeworkSettings(tx: Pick<Prisma.TransactionClient, "$queryRaw">, activityId: string) {
  await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtextextended(${`homework-settings:${activityId}`}, 0))`;
}
async function assignment(scope: HomeworkTeacherScope) {
  await assertCanManageCourse(scope.user, scope.courseId);
  return prisma.$transaction(async tx => { await lockHomeworkSettings(tx, scope.activityId); return tx.pluginCodingHomeworkAssignment.upsert({ where: { activityId: scope.activityId }, create: { activityId: scope.activityId }, update: {} }); });
}
export async function getHomeworkReferenceSelection(scope: HomeworkTeacherScope, settings: Record<string, unknown>) {
  return Array.isArray(settings.referenceMaterialIds) ? settings.referenceMaterialIds.filter((id): id is string => typeof id === "string") : (await getActivityMaterialReferenceTree(scope)).defaults;
}
export async function getHomeworkWorkflowSettings(scope: HomeworkTeacherScope) {
  const current = await assignment(scope), settings = record(current.settings);
  const [references, listed] = await Promise.all([getActivityMaterialReferences(scope), listAiAgentConnections(scope.user)]);
  let questionResolved: { connectionId: string; model: string; displayName: string; provider: string } | null = null, questionError: string | null = null;
  try { const value = await getHomeworkQuestionConnection(scope, settings); questionResolved = { connectionId: value.id, model: value.model, displayName: value.displayName, provider: value.provider }; }
  catch (error) { questionError = error instanceof AppError ? error.message : "Model configuration is unavailable."; }
  const selection = storedHomeworkAiSelection(settings.questionGenerationAi);
  const { homeworkTeamworkService } = await import("./team-workspaces");
  const questionPolicyLocked = await homeworkTeamworkService.hasActiveSubmissions({ activityId: scope.activityId, transaction: teamworkTransaction(prisma) });
  return { ...references, submissionPolicy: readHomeworkSubmissionPolicy(settings), questionPolicyLocked,
    enabled: settings.submissionsEnabled === true, concurrency: Number(settings.generationConcurrency ?? 2),
    ai: { connections: listed.connections.filter(connection => connection.isEnabled), question: { selection: selection ? { connectionId: selection.connectionId, model: selection.model } : null, resolved: questionResolved, error: questionError },
      embedding: { selection: null, resolved: references.embedding.resolved, error: references.embedding.error } } };
}
/** Legacy plugin endpoints delegate reference policy and material operations to core. */
export async function getHomeworkReferencePreview(scope: HomeworkTeacherScope, input: unknown) { return getActivityMaterialReferencePreview(scope, input); }
export async function prepareHomeworkMaterial(scope: HomeworkTeacherScope, resourceId: string, signal?: AbortSignal) { return prepareActivityReferenceMaterial(scope, { resourceId }, signal); }
export async function finishHomeworkMaterialPreparation(scope: HomeworkTeacherScope) {
  const result = await finishActivityMaterialReferencePreparation(scope);
  const current = await prisma.pluginCodingHomeworkAssignment.findUnique({ where: { activityId: scope.activityId }, select: { settings: true } });
  return { prepared: result.prepared, snapshotId: record(current?.settings).preparedSnapshotId };
}
export async function updateHomeworkWorkflowSettings(scope: HomeworkTeacherScope, input: unknown) {
  await assignment(scope);
  const data = z.object({ selected: z.array(z.string().min(1)).max(100).optional(), concurrency: z.number().int().min(1).max(4).optional(), enabled: z.boolean().optional(),
    embeddingAi: AiModelSelectionSchema.nullable().optional(), questionGenerationAi: AiModelSelectionSchema.nullable().optional(), submissionPolicy: homeworkSubmissionPolicySchema.optional() }).strict().parse(input);
  if (data.embeddingAi !== undefined) throw new AppError(409, "COURSE_EMBEDDING_SETTINGS_REQUIRED", "Set the embedding model in Course settings → AI. It is shared by all activities.");
  let questionSelection: Record<string, unknown> | null | undefined;
  if (data.questionGenerationAi !== undefined) {
    if (data.questionGenerationAi) {
      const connection = await getAiAgentConnectionForUser(scope.user, data.questionGenerationAi, "generation");
      const selection = snapshotAiModelSelection(connection, scope.user.id);
      await getCourseAiAgentConnection(scope.user, scope.courseId, selection, "generation"); questionSelection = selection;
    } else questionSelection = null;
  }
  if (data.selected) await saveActivityMaterialReferences(scope, { selected: data.selected });
  const references = data.enabled === true ? await getActivityMaterialReferences(scope) : null;
  await prisma.$transaction(async tx => {
    await lockHomeworkSettings(tx, scope.activityId);
    const current = await tx.pluginCodingHomeworkAssignment.findUniqueOrThrow({ where: { activityId: scope.activityId } }), settings = record(current.settings);
    const next: Record<string, unknown> = { ...settings, workflowVersion: 2, ...(data.concurrency ? { generationConcurrency: data.concurrency } : {}) };
    if (data.submissionPolicy !== undefined) next.submissionPolicy = data.submissionPolicy;
    if (questionSelection !== undefined) { if (questionSelection) next.questionGenerationAi = questionSelection; else delete next.questionGenerationAi; }
    if (data.concurrency) await updateBackgroundJobConcurrency("coding-homework-grader", scope.activityId, data.concurrency, tx);
    if (data.enabled === true && settings.submissionsEnabled !== true) {
      await getHomeworkQuestionConnection(scope, next);
      const revision = contentIndexRevision({ selected: Array.isArray(settings.referenceMaterialIds) ? settings.referenceMaterialIds : null, preparedId: settings.preparedSnapshotId ?? null, locked: false });
      if (!references?.prepared || revision !== references.revision) throw new AppError(409, "HOMEWORK_EMBEDDINGS_REQUIRED", "Prepare the saved reference selection before enabling submissions.");
      await lockCourseMaterialEmbeddingSettings(tx, scope.courseId);
      if (references.selected.length && materialEmbeddingSelectionIdentity((await createCourseEmbeddingProvider(scope.user, scope.courseId)).selection) !== references.embedding.identity) throw new AppError(409, "COURSE_EMBEDDING_MODEL_CHANGED", "The course embedding model changed. Prepare the reference selection again.");
      await snapshotProvidedCode(scope.activityId, tx); next.submissionsEnabled = true;
    } else if (data.enabled === false) next.submissionsEnabled = false;
    await tx.pluginCodingHomeworkAssignment.update({ where: { activityId: scope.activityId }, data: { settings: json(next) } });
  }, { timeout: 30_000 });
  return getHomeworkWorkflowSettings(scope);
}
