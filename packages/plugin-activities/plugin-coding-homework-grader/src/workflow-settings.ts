import { z } from "zod";
import type { CurrentUser } from "@cognelo/contracts";
import { AppError, updateBackgroundJobConcurrency, getCourseTeacherQuestionAuthoringAiAgentConnection, assertCanManageCourse, listContentItems, listContentResources, getMaterialIndexStatus, prepareMaterialIndex, createCourseEmbeddingProvider, contentIndexRevision } from "@cognelo/core";
import { prisma, type Prisma } from "./db-client";
import { json, record } from "./file-preparation";

export type HomeworkTeacherScope = { user: CurrentUser; courseId: string; activityId: string };
export const workflowSettingKeys = ["workflowVersion", "submissionsEnabled", "preparedSnapshotId", "referenceMaterialIds", "embeddingConnectionId", "generationConcurrency"] as const;
export async function lockHomeworkSettings(tx: Prisma.TransactionClient, activityId: string) {
  await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtextextended(${`homework-settings:${activityId}`}, 0))`;
}
async function assignment(scope: HomeworkTeacherScope) {
  await assertCanManageCourse(scope.user, scope.courseId);
  return prisma.$transaction(async tx => { await lockHomeworkSettings(tx, scope.activityId); return tx.pluginCodingHomeworkAssignment.upsert({ where: { activityId: scope.activityId }, create: { activityId: scope.activityId }, update: {} }); });
}
async function materialTree(scope: HomeworkTeacherScope) {
  const [items, resources] = await Promise.all([listContentItems(scope.user, scope.courseId, { visibleOnly: true }), listContentResources(scope.user, scope.courseId)]);
  const byId = new Map(resources.map(resource => [resource.id, resource]));
  const rows: Array<{ id: string; parentId: string | null; kind: string; title: string; depth: number; resourceId: string | null; activityId: string | null }> = [];
  const walk = (parentId: string | null, depth: number) => {
    for (const item of items.filter(item => item.parentId === parentId).sort((a, b) => a.position - b.position || a.createdAt.getTime() - b.createdAt.getTime())) {
      const resource = item.contentResourceId ? byId.get(item.contentResourceId) : null;
      rows.push({ id: item.id, parentId, kind: item.kind, title: item.titleSnapshot ?? resource?.title ?? "Untitled", depth, resourceId: resource?.id ?? null, activityId: item.activityId });
      if (depth < 50) walk(item.id, depth + 1);
    }
  };
  walk(null, 0);
  const anchor = rows.findIndex(row => row.activityId === scope.activityId);
  return { rows, defaults: rows.slice(0, anchor < 0 ? 0 : anchor).flatMap(row => row.resourceId ? [row.resourceId] : []) };
}
export async function getHomeworkWorkflowSettings(scope: HomeworkTeacherScope) {
  const current = await assignment(scope); const settings = record(current.settings); const tree = await materialTree(scope);
  const selected = Array.isArray(settings.referenceMaterialIds) ? settings.referenceMaterialIds.filter((id): id is string => typeof id === "string") : tree.defaults;
  const statuses: Record<string, unknown> = {};
  for (const id of [...new Set(tree.rows.flatMap(row => row.resourceId ? [row.resourceId] : []))]) {
    try { statuses[id] = await getMaterialIndexStatus(scope.user, scope.courseId, id, typeof settings.embeddingConnectionId === "string" ? settings.embeddingConnectionId : undefined); }
    catch (error) { statuses[id] = { state: "unavailable", error: error instanceof AppError ? error.message : "Material status is unavailable." }; }
  }
  return { rows: tree.rows, selected, statuses, enabled: settings.submissionsEnabled === true, prepared: typeof settings.preparedSnapshotId === "string", concurrency: Number(settings.generationConcurrency ?? 2) };
}
export async function updateHomeworkWorkflowSettings(scope: HomeworkTeacherScope, input: unknown) {
  await assignment(scope);
  const data = z.object({ selected: z.array(z.string().min(1)).max(100).optional(), concurrency: z.number().int().min(1).max(4).optional(), enabled: z.boolean().optional() }).strict().parse(input);
  const tree = await materialTree(scope);
  if (data.selected?.some(id => !tree.rows.some(row => row.resourceId === id))) throw new AppError(400, "HOMEWORK_MATERIAL_INVALID", "Choose visible course materials from the list.");
  await prisma.$transaction(async tx => {
    await lockHomeworkSettings(tx, scope.activityId);
    const current = await tx.pluginCodingHomeworkAssignment.findUniqueOrThrow({ where: { activityId: scope.activityId } });
    const settings = record(current.settings);
    if (settings.submissionsEnabled === true && data.selected && contentIndexRevision([...new Set(data.selected)].sort()) !== contentIndexRevision([...(settings.referenceMaterialIds as string[] ?? [])].sort())) throw new AppError(409, "HOMEWORK_SELECTION_LOCKED", "Disable submissions before changing the reference selection.");
    const next: Record<string, unknown> = { ...settings, workflowVersion: 2, ...(data.concurrency ? { generationConcurrency: data.concurrency } : {}) };
    if (data.selected) {
      if (contentIndexRevision([...new Set(data.selected)].sort()) !== contentIndexRevision([...(settings.referenceMaterialIds as string[] ?? [])].sort())) delete next.preparedSnapshotId;
      next.referenceMaterialIds = [...new Set(data.selected)];
    }
    if (data.concurrency) await updateBackgroundJobConcurrency("coding-homework-grader", scope.activityId, data.concurrency, tx);
    if (data.enabled === true && settings.submissionsEnabled !== true) {
      await getCourseTeacherQuestionAuthoringAiAgentConnection(scope.user, scope.courseId);
      if (typeof next.preparedSnapshotId !== "string") throw new AppError(409, "HOMEWORK_EMBEDDINGS_REQUIRED", "Generate embeddings for the selected materials before enabling submissions.");
      const snapshot = await tx.pluginCodingHomeworkDocumentationSnapshot.findUnique({ where: { id: next.preparedSnapshotId } });
      const pinned = record(snapshot?.metadata);
      if (!snapshot || snapshot.activityId !== scope.activityId || contentIndexRevision(next.referenceMaterialIds) !== pinned.selectionFingerprint) throw new AppError(409, "HOMEWORK_EMBEDDINGS_REQUIRED", "The reference selection changed. Generate embeddings again.");
      const statuses = [];
      for (const id of next.referenceMaterialIds as string[]) statuses.push(await getMaterialIndexStatus(scope.user, scope.courseId, id, typeof next.embeddingConnectionId === "string" ? next.embeddingConnectionId : undefined));
      if (statuses.some(status => status.state !== "ready" || !(pinned.indexIds as string[]).includes(status.index?.id ?? ""))) throw new AppError(409, "HOMEWORK_EMBEDDINGS_STALE", "Some selected materials need embedding generation or refresh before submissions can open.");
      next.submissionsEnabled = true;
    } else if (data.enabled === false) next.submissionsEnabled = false;
    await tx.pluginCodingHomeworkAssignment.update({ where: { activityId: scope.activityId }, data: { settings: json(next) } });
  }, { timeout: 30_000 });
  return getHomeworkWorkflowSettings(scope);
}
export async function prepareHomeworkMaterial(scope: HomeworkTeacherScope, resourceId: string, signal?: AbortSignal) {
  const current = await assignment(scope); const settings = record(current.settings);
  if (settings.submissionsEnabled) throw new AppError(409, "HOMEWORK_SELECTION_LOCKED", "Disable submissions before preparing references.");
  const selected = Array.isArray(settings.referenceMaterialIds) ? settings.referenceMaterialIds : (await materialTree(scope)).defaults;
  if (!selected.includes(resourceId)) throw new AppError(400, "HOMEWORK_MATERIAL_INVALID", "The material is not selected.");
  // Preserve the embedding connection separately from the configurable question model.
  const provider = await createCourseEmbeddingProvider(scope.user, scope.courseId, typeof settings.embeddingConnectionId === "string" ? settings.embeddingConnectionId : undefined);
  await prisma.$transaction(async tx => {
    await lockHomeworkSettings(tx, scope.activityId);
    const row = await tx.pluginCodingHomeworkAssignment.findUniqueOrThrow({ where: { activityId: scope.activityId } });
    if (record(row.settings).submissionsEnabled) throw new AppError(409, "HOMEWORK_SELECTION_LOCKED", "Disable submissions before preparing references.");
    await tx.pluginCodingHomeworkAssignment.update({ where: { activityId: scope.activityId }, data: { settings: json({ ...record(row.settings), embeddingConnectionId: provider.connectionId }) } });
  });
  return prepareMaterialIndex(scope.user, scope.courseId, resourceId, { connectionId: provider.connectionId, signal });
}
export async function finishHomeworkMaterialPreparation(scope: HomeworkTeacherScope) {
  await assignment(scope);
  return prisma.$transaction(async tx => {
    await lockHomeworkSettings(tx, scope.activityId);
    const current = await tx.pluginCodingHomeworkAssignment.findUniqueOrThrow({ where: { activityId: scope.activityId } }); const settings = record(current.settings);
    if (settings.submissionsEnabled) throw new AppError(409, "HOMEWORK_SELECTION_LOCKED", "Disable submissions before preparing references.");
    const selected = Array.isArray(settings.referenceMaterialIds) ? settings.referenceMaterialIds as string[] : (await materialTree(scope)).defaults;
    const indexes = [];
    for (const id of selected) { const status = await getMaterialIndexStatus(scope.user, scope.courseId, id, typeof settings.embeddingConnectionId === "string" ? settings.embeddingConnectionId : undefined); if (status.state !== "ready" || !status.index) throw new AppError(409, "HOMEWORK_EMBEDDINGS_REQUIRED", "Generate embeddings for every selected material first."); indexes.push(status.index); }
    if (indexes.reduce((sum, index) => sum + index.documentCount, 0) > 10_000) throw new AppError(413, "REFERENCE_SELECTION_TOO_LARGE", "Select fewer reference materials for this homework.");
    const snapshot = await tx.pluginCodingHomeworkDocumentationSnapshot.create({ data: { activityId: scope.activityId, courseId: scope.courseId, status: "ready", contentTreeFingerprint: contentIndexRevision(selected), metadata: json({ workflowVersion: 2, selectionFingerprint: contentIndexRevision(selected), indexIds: indexes.map(index => index.id), selected, preparedAt: new Date().toISOString() }) } });
    await tx.pluginCodingHomeworkAssignment.update({ where: { activityId: scope.activityId }, data: { settings: json({ ...settings, workflowVersion: 2, referenceMaterialIds: selected, embeddingConnectionId: settings.embeddingConnectionId ?? indexes[0]?.connectionId, preparedSnapshotId: snapshot.id }) } });
    return { prepared: true, snapshotId: snapshot.id };
  }, { timeout: 30_000 });
}
