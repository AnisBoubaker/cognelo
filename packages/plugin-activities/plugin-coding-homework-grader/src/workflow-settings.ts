import { applyHomeworkStageActivation } from "./stage-activation";
import { homeworkStageConfiguration } from "./stage-activation-state";
import { configuredActivityStageActivations, submissionStageActivationResolver, enqueueBackgroundJob } from "@cognelo/core";
import { lockHomeworkSettings } from "./settings-lock";
export { lockHomeworkSettings } from "./settings-lock";
import { getCourseActivitySubmissionStage, updateCourseActivitySubmissionStage } from "@cognelo/core";
import { homeworkWorkflowDraftSchema, type HomeworkWorkflowDraftInput } from "./workflow-contract";
import { homeworkQuestionsEnabled } from "./question-policy";
import { getHomeworkQuestionConnection, storedHomeworkAiSelection } from "./ai-selection";
import { z } from "zod";
import { AiModelSelectionSchema, type CurrentUser } from "@cognelo/contracts";
import { AppError, updateBackgroundJobConcurrency, getAiAgentConnectionForUser, getCourseAiAgentConnection, snapshotAiModelSelection, listAiAgentConnections, assertCanManageCourse,
  getActivityMaterialReferences, getActivityMaterialReferenceTree, saveActivityMaterialReferences, prepareActivityReferenceMaterial, finishActivityMaterialReferencePreparation, getActivityMaterialReferencePreview,
  lockActivityTeamwork, teamworkTransaction } from "@cognelo/core";
import { prisma, type Prisma } from "./db-client";
import { json, record } from "./file-preparation";

export type HomeworkTeacherScope = { user: CurrentUser; courseId: string; activityId: string };
export const workflowSettingKeys = ["workflowVersion", "submissionsEnabled", "preparedSnapshotId", "referenceMaterialIds", "embeddingConnectionId", "generationConcurrency", "embeddingAi", "questionGenerationAi", "submissionPolicy", "questionsStageEnabled"] as const;

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
  const filePolicy = (await getCourseActivitySubmissionStage(scope, "files")).policy;
  return { ...references, questionGenerationEnabled: homeworkQuestionsEnabled(settings), submissionPolicy: { deadline: filePolicy.deadline, allowLate: filePolicy.allowLate, lateLimitMinutes: filePolicy.lateLimitMinutes }, questionPolicyLocked,
    enabled: filePolicy.enabled !== false, concurrency: Number(settings.generationConcurrency ?? 2),
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
export async function prepareHomeworkWorkflowUpdate(scope: HomeworkTeacherScope, data: HomeworkWorkflowDraftInput, questionsEnabled?: boolean) {
  await assertCanManageCourse(scope.user, scope.courseId);
  let questionSelection: Record<string, unknown> | null | undefined;
  if (data.questionGenerationAi !== undefined) {
    if (data.questionGenerationAi) {
      const connection = await getAiAgentConnectionForUser(scope.user, data.questionGenerationAi, "generation");
      const selection = snapshotAiModelSelection(connection, scope.user.id);
      await getCourseAiAgentConnection(scope.user, scope.courseId, selection, "generation"); questionSelection = selection;
    } else questionSelection = null;
  }
  const needsReferences = data.enabled !== undefined && (questionsEnabled ?? homeworkQuestionsEnabled((await prisma.pluginCodingHomeworkAssignment.findUnique({ where: { activityId: scope.activityId }, select: { settings: true } }))?.settings));
  const references = needsReferences ? await getActivityMaterialReferences(scope) : null;
  return { data, questionSelection, references };
}
export async function applyHomeworkWorkflowUpdate(scope: HomeworkTeacherScope, prepared: Awaited<ReturnType<typeof prepareHomeworkWorkflowUpdate>>, tx: Prisma.TransactionClient) {
  await lockActivityTeamwork(tx, scope.activityId);
  await lockHomeworkSettings(tx, scope.activityId);
  const { data, questionSelection, references } = prepared;
  const current = await tx.pluginCodingHomeworkAssignment.findUniqueOrThrow({ where: { activityId: scope.activityId } }), settings = record(current.settings);
  const next: Record<string, unknown> = { ...settings, workflowVersion: 2, ...(data.concurrency ? { generationConcurrency: data.concurrency } : {}) };
  if (data.submissionPolicy !== undefined) await updateCourseActivitySubmissionStage(scope, "files", data.submissionPolicy, tx);
  if (questionSelection !== undefined) { if (questionSelection) next.questionGenerationAi = questionSelection; else delete next.questionGenerationAi; }
  if (data.concurrency) await updateBackgroundJobConcurrency("coding-homework-grader", scope.activityId, data.concurrency, tx);
  await tx.pluginCodingHomeworkAssignment.update({ where: { activityId: scope.activityId }, data: { settings: json(next) } });
  if (data.enabled !== undefined) {
    // Older clients opened the entire workflow. Keep that endpoint as a core-backed bridge.
    await updateCourseActivitySubmissionStage(scope, "files", { enabled: data.enabled }, tx);
    await updateCourseActivitySubmissionStage(scope, "questions", { enabled: data.enabled && homeworkQuestionsEnabled(next) }, tx);
    const configuration = homeworkStageConfiguration(next), transaction = teamworkTransaction(tx);
    await applyHomeworkStageActivation({ ...scope, prepared: { references },
      enabled: await configuredActivityStageActivations(tx, scope.activityId, configuration), transaction,
      isEnabled: submissionStageActivationResolver(tx, scope.activityId, configuration),
      enqueue: async job => { await enqueueBackgroundJob(job, tx); } });
  }
}
export async function updateHomeworkWorkflowSettings(scope: HomeworkTeacherScope, input: unknown) {
  await assignment(scope);
  const data = homeworkWorkflowDraftSchema.extend({ selected: z.array(z.string().min(1)).max(100).optional(), embeddingAi: AiModelSelectionSchema.nullable().optional() }).parse(input);
  if (data.embeddingAi !== undefined) throw new AppError(409, "COURSE_EMBEDDING_SETTINGS_REQUIRED", "Set the embedding model in Course settings → AI. It is shared by all activities.");
  const prepared = await prepareHomeworkWorkflowUpdate(scope, data);
  if (data.selected) {
    await saveActivityMaterialReferences(scope, { selected: data.selected });
    if (prepared.references) prepared.references = await getActivityMaterialReferences(scope);
  }
  await prisma.$transaction(tx => applyHomeworkWorkflowUpdate(scope, prepared, tx), { timeout: 30_000 });
  return getHomeworkWorkflowSettings(scope);
}
