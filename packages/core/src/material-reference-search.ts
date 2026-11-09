import type { CurrentUser } from "@cognelo/contracts";
import { prisma as coreDb } from "@cognelo/db";
import { createPreparedMaterialSearch, type MaterialEmbeddingSelection } from "./material-embeddings";
import { AppError } from "./errors";
import { assertCanManageCourse } from "./authorization";
const record = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};

/** Only private server-side generation consumes teacher-authorized hidden references. */
export async function createPreparedActivityReferenceSearch(scope: { user: CurrentUser; courseId: string; groupId?: string }, snapshot: Record<string, unknown>) {
  const indexIds = Array.isArray(snapshot.indexIds) ? [...new Set(snapshot.indexIds.filter((id): id is string => typeof id === "string"))] : [];
  const hiddenIds = Array.isArray(snapshot.hiddenReferenceIndexIds) ? [...new Set(snapshot.hiddenReferenceIndexIds.filter((id): id is string => typeof id === "string"))] : [];
  if (hiddenIds.some(id => !indexIds.includes(id))) throw new AppError(409, "MATERIAL_PRIVATE_REFERENCES_UNAVAILABLE", "Prepare the reference selection again before generating questions.");
  const stored = record(snapshot.embeddingAi);
  const selection = typeof stored.connectionId === "string" && typeof stored.model === "string" ? stored as MaterialEmbeddingSelection : undefined;
  const publicSearch = await createPreparedMaterialSearch(scope.user, scope.courseId, indexIds.filter(id => !hiddenIds.includes(id)), scope.groupId, selection);
  if (!hiddenIds.length) return publicSearch;
  const preparer = typeof snapshot.preparedByUserId === "string" ? await coreDb.user.findUnique({ where: { id: snapshot.preparedByUserId }, select: { id: true, isActive: true, email: true, name: true, firstName: true, lastName: true, roles: { select: { role: { select: { key: true } } } } } }) : null;
  if (!preparer?.isActive) throw new AppError(409, "MATERIAL_PRIVATE_REFERENCES_UNAVAILABLE", "An active course manager must prepare the hidden reference selection again.");
  const author: CurrentUser = { ...preparer, roles: preparer.roles.map(value => value.role.key) as CurrentUser["roles"] };
  await assertCanManageCourse(author, scope.courseId);
  const privateSearch = await createPreparedMaterialSearch(author, scope.courseId, hiddenIds, scope.groupId, selection);
  return { search: async (query: string, limit = 3, signal?: AbortSignal) => {
    signal?.throwIfAborted();
    const count = Math.max(1, Math.min(limit, 20));
    // The second lookup reuses the cached query vector rather than racing the same embedding request.
    const publicMatches = await publicSearch.search(query, count, signal);
    const privateMatches = await privateSearch.search(query, count, signal);
    return [...publicMatches, ...privateMatches].sort((left, right) => right.score - left.score).slice(0, count);
  } };
}
