import { assertActivityTypeAvailable } from "./plugins";
import { lockCourseMaterialEmbeddingSettings } from "./course-material-embedding-settings";
import { z } from "zod";
import type { CurrentUser, ActivityMaterialReferencesView } from "@cognelo/contracts";
import { getActivityDefinition } from "@cognelo/activity-sdk";
import { getActivityMaterialReferencesHandler, type ActivityMaterialReferencesState, type PreparedActivityMaterialReferences, type PluginTeamworkTransaction } from "@cognelo/activity-sdk/server";
import { prisma, type Prisma } from "@cognelo/db";
import { assertCanManageCourse } from "./authorization";
import { AppError } from "./errors";
import { listContentItems, listContentResources } from "./course-content";
import { contentIndexRevision, createCourseEmbeddingProvider, getMaterialIndexPreview, getMaterialIndexStatus, prepareMaterialIndex, type MaterialEmbeddingSelection } from "./material-embeddings";

export type ActivityMaterialReferenceScope = { user: CurrentUser; courseId: string; activityId: string };
export type ActivityMaterialReferenceRow = { id: string; parentId: string | null; kind: string; title: string; depth: number; resourceId: string | null; hidden: boolean };
const sql = (tx: Prisma.TransactionClient): PluginTeamworkTransaction => ({ query: <T>(query: TemplateStringsArray, ...values: unknown[]) => tx.$queryRaw<T>(query, ...values), execute: (query, ...values) => tx.$executeRaw(query, ...values) });
const sameSelection = (a: string[], b: string[]) => contentIndexRevision([...new Set(a)].sort()) === contentIndexRevision([...new Set(b)].sort());
export const materialEmbeddingSelectionIdentity = (value: Record<string, unknown> | null | undefined) => contentIndexRevision({ connectionId: value?.connectionId ?? null, model: value?.model ?? null, dimensions: value?.dimensions ?? null, endpointKey: value?.endpointKey ?? null });
async function service(scope: ActivityMaterialReferenceScope) {
  await assertCanManageCourse(scope.user, scope.courseId);
  const activity = await prisma.activity.findFirst({ where: { id: scope.activityId, courseId: scope.courseId }, include: { activityType: true } });
  if (!activity) throw new AppError(404, "ACTIVITY_NOT_FOUND", "The activity was not found.");
  await assertActivityTypeAvailable(activity.activityType.key);
  const handler = getActivityMaterialReferencesHandler(activity.activityType.key);
  if (!getActivityDefinition(activity.activityType.key)?.usesMaterialEmbeddings || !handler) throw new AppError(409, "ACTIVITY_REFERENCES_UNAVAILABLE", "This activity does not provide the shared material-reference service.");
  return handler;
}
export async function getActivityMaterialReferenceState(scope: ActivityMaterialReferenceScope) {
  const handler = await service(scope);
  return prisma.$transaction(tx => handler.read({ ...scope, transaction: sql(tx) }));
}
export async function getActivityMaterialReferenceTree(scope: ActivityMaterialReferenceScope) {
  await assertCanManageCourse(scope.user, scope.courseId);
  const [items, resources] = await Promise.all([listContentItems(scope.user, scope.courseId), listContentResources(scope.user, scope.courseId)]);
  const byId = new Map(resources.map(resource => [resource.id, resource]));
  const children = new Map<string | null, typeof items>();
  for (const item of items) children.set(item.parentId, [...(children.get(item.parentId) ?? []), item]);
  const rows: Array<ActivityMaterialReferenceRow & { activityId: string | null }> = [];
  const walk = (parentId: string | null, depth: number) => {
    for (const item of (children.get(parentId) ?? []).sort((a, b) => a.position - b.position || a.createdAt.getTime() - b.createdAt.getTime())) {
      const resource = item.contentResourceId ? byId.get(item.contentResourceId) : null;
      rows.push({ id: item.id, parentId, kind: item.kind, title: item.titleSnapshot ?? resource?.title ?? "Untitled", depth, resourceId: resource?.id ?? null, activityId: item.activityId, hidden: item.effectiveVisibility !== "visible" });
      if (depth < 50) walk(item.id, depth + 1);
    }
  };
  walk(null, 0);
  const anchor = rows.findIndex(row => row.activityId === scope.activityId);
  const defaults = [...new Set(rows.slice(0, anchor < 0 ? 0 : anchor).flatMap(row => row.resourceId && !row.hidden ? [row.resourceId] : []))];
  const byItem = new Map(rows.map(row => [row.id, row])), folders = new Set<string>();
  for (const row of rows.filter(row => row.resourceId)) {
    let parent = row.parentId;
    while (parent && !folders.has(parent)) { folders.add(parent); parent = byItem.get(parent)?.parentId ?? null; }
  }
  return { rows: rows.filter(row => row.resourceId || (row.kind === "folder" && folders.has(row.id))), defaults };
}
export async function getActivityMaterialReferenceSelection(scope: ActivityMaterialReferenceScope, selected: string[] | null) {
  return selected ?? (await getActivityMaterialReferenceTree(scope)).defaults;
}
export async function getActivityMaterialReferences(scope: ActivityMaterialReferenceScope): Promise<ActivityMaterialReferencesView> {
  const [state, tree] = await Promise.all([getActivityMaterialReferenceState(scope), getActivityMaterialReferenceTree(scope)]);
  const selected = state.selected ?? tree.defaults;
  let provider: Awaited<ReturnType<typeof createCourseEmbeddingProvider>> | null = null, error: string | null = null;
  try { provider = await createCourseEmbeddingProvider(scope.user, scope.courseId); }
  catch (failure) { error = failure instanceof AppError ? failure.message : "The course embedding model is unavailable."; }
  const statuses: Record<string, Awaited<ReturnType<typeof getMaterialIndexStatus>> | { state: "needs_model" | "unavailable"; error?: string }> = {};
  const statusSelection = state.locked && state.prepared?.embeddingAi ? state.prepared.embeddingAi as MaterialEmbeddingSelection : provider?.selection;
  for (const id of new Set(tree.rows.flatMap(row => row.resourceId ? [row.resourceId] : []))) {
    if (!statusSelection && !provider) { statuses[id] = { state: "needs_model" }; continue; }
    try { statuses[id] = await getMaterialIndexStatus(scope.user, scope.courseId, id, statusSelection); }
    catch (failure) { statuses[id] = { state: "unavailable", error: failure instanceof AppError ? failure.message : "Material indexing is unavailable." }; }
  }
  const pinned = state.prepared;
  const prepared = Boolean(pinned && sameSelection(selected, pinned.selected) && (state.locked || ((!selected.length || (provider && materialEmbeddingSelectionIdentity(pinned.embeddingAi) === materialEmbeddingSelectionIdentity(provider.selection)))
    && selected.every(id => { const status = statuses[id]; return status?.state === "ready" && "index" in status && status.index && pinned.indexIds.includes(status.index.id); }))));
  return { rows: tree.rows, selected, statuses, prepared, locked: state.locked, revision: state.revision,
    embedding: { identity: materialEmbeddingSelectionIdentity(provider?.selection), resolved: provider ? { connectionId: provider.connectionId, model: provider.model } : null, error,
      preparedModel: typeof pinned?.embeddingAi?.model === "string" ? pinned.embeddingAi.model : null,
      settingsUrl: `/courses/${scope.courseId}?tab=settings&section=ai#material-embeddings` } };
}
function assertVersion(state: ActivityMaterialReferencesState, revision?: string) {
  if (revision !== undefined && revision !== state.revision) throw new AppError(409, "ACTIVITY_REFERENCES_CHANGED", "Reference settings changed. Reload before saving or preparing them.");
}
export async function saveActivityMaterialReferences(scope: ActivityMaterialReferenceScope, input: unknown) {
  const data = z.object({ selected: z.array(z.string().min(1)).max(100), revision: z.string().optional() }).strict().parse(input);
  const handler = await service(scope), tree = await getActivityMaterialReferenceTree(scope);
  if (data.selected.some(id => !tree.rows.some(row => row.resourceId === id))) throw new AppError(400, "MATERIAL_REFERENCE_INVALID", "Choose material from this course's reference list.");
  await prisma.$transaction(async tx => {
    const transaction = sql(tx), state = await handler.read({ ...scope, transaction }); assertVersion(state, data.revision);
    const previous = state.selected ?? tree.defaults;
    if (state.locked && !sameSelection(previous, data.selected)) throw new AppError(409, "ACTIVITY_REFERENCES_LOCKED", "Disable submissions before changing the reference selection.");
    if (state.locked || (state.selected !== null && sameSelection(previous, data.selected))) return;
    await handler.write({ ...scope, transaction, selected: [...new Set(data.selected)] });
  }, { timeout: 30_000 });
  return getActivityMaterialReferences(scope);
}
export async function prepareActivityReferenceMaterial(scope: ActivityMaterialReferenceScope, input: unknown, signal?: AbortSignal) {
  const data = z.object({ resourceId: z.string().min(1), revision: z.string().optional() }).strict().parse(input);
  const state = await getActivityMaterialReferenceState(scope); assertVersion(state, data.revision);
  if (state.locked) throw new AppError(409, "ACTIVITY_REFERENCES_LOCKED", "Disable submissions before preparing references.");
  const selected = await getActivityMaterialReferenceSelection(scope, state.selected);
  if (!selected.includes(data.resourceId)) throw new AppError(400, "MATERIAL_REFERENCE_INVALID", "This material is not selected.");
  const provider = await createCourseEmbeddingProvider(scope.user, scope.courseId);
  const index = await prepareMaterialIndex(scope.user, scope.courseId, data.resourceId, { ...provider.selection, signal });
  const current = await createCourseEmbeddingProvider(scope.user, scope.courseId);
  if (materialEmbeddingSelectionIdentity(provider.selection) !== materialEmbeddingSelectionIdentity(current.selection)) throw new AppError(409, "COURSE_EMBEDDING_MODEL_CHANGED", "The course embedding model changed. Prepare the selection again.");
  return index;
}
export async function finishActivityMaterialReferencePreparation(scope: ActivityMaterialReferenceScope, input: unknown = {}) {
  const data = z.object({ revision: z.string().optional() }).strict().parse(input);
  const handler = await service(scope), tree = await getActivityMaterialReferenceTree(scope);
  await prisma.$transaction(async tx => {
    const transaction = sql(tx), state = await handler.read({ ...scope, transaction }); assertVersion(state, data.revision);
    if (state.locked) throw new AppError(409, "ACTIVITY_REFERENCES_LOCKED", "Disable submissions before preparing references.");
    const selected = state.selected ?? tree.defaults;
    await lockCourseMaterialEmbeddingSettings(tx, scope.courseId);
    const provider = selected.length ? await createCourseEmbeddingProvider(scope.user, scope.courseId) : null;
    const indexes = [];
    for (const id of selected) {
      const status = await getMaterialIndexStatus(scope.user, scope.courseId, id, provider?.selection);
      if (status.state !== "ready" || !status.index) throw new AppError(409, "MATERIAL_EMBEDDINGS_REQUIRED", "Generate embeddings for every selected material first.");
      indexes.push(status.index);
    }
    if (indexes.reduce((sum, index) => sum + index.documentCount, 0) > 10_000 || indexes.reduce((sum, index) => sum + index.documentCount * (index.vectorDimensions ?? 1536), 0) > 20_000_000) throw new AppError(413, "REFERENCE_SELECTION_TOO_LARGE", "Select fewer reference materials.");
    const hidden = new Set(tree.rows.filter(row => row.hidden && row.resourceId).map(row => row.resourceId));
    const prepared: Omit<PreparedActivityMaterialReferences, "id"> = { selected, indexIds: indexes.map(index => index.id), hiddenReferenceIndexIds: indexes.flatMap((index, position) => hidden.has(selected[position]) ? [index.id] : []),
      embeddingAi: provider?.selection ?? null, preparedByUserId: scope.user.id, preparedAt: new Date().toISOString(), selectionFingerprint: contentIndexRevision(selected) };
    await handler.write({ ...scope, transaction, selected, prepared });
  }, { timeout: 30_000 });
  return getActivityMaterialReferences(scope);
}
export async function getActivityMaterialReferencePreview(scope: ActivityMaterialReferenceScope, input: unknown) {
  const data = z.object({ resourceId: z.string().min(1), indexId: z.string().min(1).optional(), offset: z.coerce.number().int().min(0).max(2000).default(0) }).strict().parse(input);
  const state = await getActivityMaterialReferenceState(scope);
  let ids: string[] = [], prepared = false;
  if (state.prepared?.selected.includes(data.resourceId)) { ids = state.prepared.indexIds; prepared = true; }
  else { const status = await getMaterialIndexStatus(scope.user, scope.courseId, data.resourceId); ids = status.index ? [status.index.id] : []; }
  if (data.indexId && !ids.includes(data.indexId)) throw new AppError(409, "MATERIAL_PREVIEW_CHANGED", "The saved reference selection changed. Open the preview again.");
  return { ...await getMaterialIndexPreview(scope.user, scope.courseId, data.resourceId, data.indexId ? [data.indexId] : ids, data.offset), prepared };
}
