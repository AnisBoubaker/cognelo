import { readCourseMaterialEmbeddingSelection } from "./course-material-embedding-settings";
import { createHash, randomUUID } from "node:crypto";
import { Prisma, prisma } from "@cognelo/db";
import type { CurrentUser } from "@cognelo/contracts";
import { getServerContentTypePlugin, type ContentEmbeddingDocument, type PreparedContentIndex, type ServerContentResourceRecord } from "@cognelo/content-type-sdk/server";
import { getContentResourceForPluginRoute } from "./course-content";
import { assertCanManageCourse, assertCanViewCourse } from "./authorization";
import { getCourseTeacherQuestionAuthoringAiAgentConnection, getCourseAiAgentConnection, snapshotAiModelSelection, selectAiAgentModel, aiConnectionBaseUrl, type StoredAiModelSelection } from "./ai-agents";
import { requestAiEmbeddings } from "./ai-embeddings";
import { AppError } from "./errors";

export const MATERIAL_EMBEDDING_MODEL = "text-embedding-3-small";
export const MATERIAL_EMBEDDING_DIMENSIONS = 1536;
const MAX_INDEX_CHUNKS = 2000;
export const contentIndexRevision = (value: unknown) => createHash("sha256").update(JSON.stringify(canonical(value))).digest("hex");
function canonical(value: unknown): unknown { return Array.isArray(value) ? value.map(canonical) : value && typeof value === "object" ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, canonical(item)])) : value; }
type IndexedChunk = ContentEmbeddingDocument & { vectorId: string };

export type MaterialEmbeddingSelection = Partial<StoredAiModelSelection> & { dimensions?: number | null; vectorDimensions?: number };
function selectionOptions(selection?: string | MaterialEmbeddingSelection): MaterialEmbeddingSelection { return typeof selection === "string" ? { connectionId: selection } : selection ?? {}; }
export async function createCourseEmbeddingProvider(user: CurrentUser, courseId: string, selection?: string | MaterialEmbeddingSelection, historical = false) {
  await assertCanViewCourse(user, courseId);
  const explicit = selectionOptions(selection);
  const requested = explicit.connectionId || explicit.model ? explicit : { ...await readCourseMaterialEmbeddingSelection(courseId), ...explicit };
  const connection = requested.connectionId
    ? await getCourseAiAgentConnection(user, courseId, { ...requested, connectionId: requested.connectionId }, "embedding", historical)
    : await getCourseAiAgentConnection(user, courseId, snapshotAiModelSelection(selectAiAgentModel(await getCourseTeacherQuestionAuthoringAiAgentConnection(user, courseId), "embedding", requested.model)), "embedding");
  if (!connection.apiKey && connection.provider !== "ollama") throw new AppError(409, "EMBEDDING_CONNECTION_REQUIRED", "Select a configured embedding connection and model for the reference materials.");
  const baseUrl = aiConnectionBaseUrl(connection);
  const dimensions = requested.dimensions !== undefined ? requested.dimensions : connection.provider !== "ollama" && connection.model === MATERIAL_EMBEDDING_MODEL ? MATERIAL_EMBEDDING_DIMENSIONS : null;
  const modelKey = contentIndexRevision({ provider: connection.provider === "codex" ? "openai" : connection.provider, baseUrl, model: connection.model, dimensions });
  const embeddingSelection = { ...snapshotAiModelSelection(connection, requested.selectedByUserId), dimensions };
  return { connectionId: connection.id, modelKey, dimensions, model: connection.model, selection: embeddingSelection,
    async embedTexts(texts: string[], signal?: AbortSignal) {
      signal?.throwIfAborted();
      const ids = texts.map(text => contentIndexRevision({ modelKey, text }));
      const cached = await prisma.contentMaterialVector.findMany({ where: { id: { in: [...new Set(ids)] } } });
      const vectors = new Map(cached.map(row => [row.id, decodeVector(row.values)]));
      let actualDimensions = dimensions ?? cached[0]?.dimensions;
      if (cached.some(row => row.dimensions !== actualDimensions || row.values.byteLength !== row.dimensions * 4)) throw new AppError(409, "EMBEDDING_INDEX_INCOMPATIBLE", "Stored vectors have incompatible dimensions.");
      const missing = [...new Map(texts.map((text, index) => [ids[index], text])).entries()].filter(([id]) => !vectors.has(id));
      for (let start = 0; start < missing.length; start += 16) {
        signal?.throwIfAborted();
        const batch = missing.slice(start, start + 16);
        if (batch.some(([, text]) => !text.trim() || Buffer.byteLength(text) > 8000)) throw new AppError(400, "EMBEDDING_TEXT_LIMIT", "An embedding input is empty or exceeds its bounded text size.");
        const results = await requestAiEmbeddings(connection, batch.map(([, text]) => text), dimensions, signal);
        actualDimensions ??= results[0].length;
        if (results.some(vector => vector.length !== actualDimensions)) throw new AppError(409, "EMBEDDING_INDEX_INCOMPATIBLE", "The embedding model changed vector dimensions. Select a stable model version and regenerate references.");
        for (let index = 0; index < batch.length; index++) {
          const values = results[index], id = batch[index][0];
          const saved = await prisma.contentMaterialVector.upsert({ where: { id }, create: { id, modelKey, dimensions: values.length, values: encodeVector(values) }, update: {} });
          if (saved.dimensions !== actualDimensions || saved.values.byteLength !== saved.dimensions * 4) throw new AppError(409, "EMBEDDING_INDEX_INCOMPATIBLE", "The embedding model changed vector dimensions during preparation.");
          vectors.set(id, decodeVector(saved.values));
        }
      }
      return ids.map(id => ({ id, values: vectors.get(id)! }));
    }
  };
}
export function chunkMaterialDocuments(documents: ContentEmbeddingDocument[]) {
  const chunks: ContentEmbeddingDocument[] = [];
  for (const document of documents) {
    const text = document.text.replace(/\u0000/g, "").trim();
    for (let offset = 0, index = 0; offset < text.length; offset += 1840, index++) {
      const part = text.slice(offset, offset + 2000).trim();
      if (part) chunks.push({ ...document, id: `${document.id}:chunk-${index}`, text: part });
      if (chunks.length > MAX_INDEX_CHUNKS) throw new AppError(413, "MATERIAL_INDEX_TOO_LARGE", "This material has too much text to index in one resource. Split it into smaller materials.");
      if (offset + 2000 >= text.length) break;
    }
  }
  return chunks;
}
function toResource(resource: Awaited<ReturnType<typeof getContentResourceForPluginRoute>>): ServerContentResourceRecord {
  return { ...resource, metadata: resource.metadata as Record<string, unknown> };
}
function descriptor(index: Prisma.ContentMaterialIndexGetPayload<Record<string, never>>): PreparedContentIndex {
  return { id: index.id, sourceId: index.sourceId, modelKey: index.modelKey, sourceRevision: index.sourceRevision,
    contentFingerprint: index.contentFingerprint, indexedAt: index.createdAt.toISOString(), checkedAt: index.checkedAt.toISOString(),
    documentCount: Array.isArray(index.documents) ? index.documents.length : 0, vectorDimensions: indexConfig(index).vectorDimensions ?? indexConfig(index).dimensions ?? MATERIAL_EMBEDDING_DIMENSIONS, embeddingModel: typeof indexConfig(index).model === "string" ? indexConfig(index).model : MATERIAL_EMBEDDING_MODEL, connectionId: index.connectionId ?? "" };
}
export async function getMaterialIndexStatus(user: CurrentUser, courseId: string, resourceId: string, selection?: string | MaterialEmbeddingSelection) {
  await assertCanManageCourse(user, courseId);
  const resource = toResource(await getContentResourceForPluginRoute(user, courseId, resourceId));
  const service = getServerContentTypePlugin(resource.pluginKey)?.indexing;
  if (!service) return { state: "unsupported" as const, sourceId: resourceId, title: resource.title, index: null, maxAgeHours: null };
  const provider = await createCourseEmbeddingProvider(user, courseId, selection);
  const policy = service.policy(resource);
  const index = await prisma.contentMaterialIndex.findFirst({ where: { resourceId, modelKey: provider.modelKey }, orderBy: { checkedAt: "desc" } });
  const expired = index && policy.maxAgeHours != null && Date.now() - index.checkedAt.getTime() >= policy.maxAgeHours * 3_600_000;
  return { state: !index ? "missing" as const : expired || index.sourceRevision !== policy.revision ? "stale" as const : "ready" as const,
    sourceId: resourceId, title: resource.title, index: index ? descriptor(index) : null, maxAgeHours: policy.maxAgeHours ?? null };
}

/** Teacher-only inspection of saved embedding inputs; no vectors, credentials or model requests. */
export async function getMaterialIndexPreview(user: CurrentUser, courseId: string, resourceId: string, indexIds: string[], offset = 0) {
  await assertCanManageCourse(user, courseId);
  const resource = await getContentResourceForPluginRoute(user, courseId, resourceId);
  if (!Number.isInteger(offset) || offset < 0 || offset > MAX_INDEX_CHUNKS || indexIds.length > MAX_INDEX_CHUNKS) {
    throw new AppError(400, "MATERIAL_PREVIEW_PAGE_INVALID", "Choose a valid page of indexed text.");
  }
  const index = await prisma.contentMaterialIndex.findFirst({
    where: { courseId, resourceId, id: { in: indexIds } }, orderBy: { checkedAt: "desc" },
    select: { id: true, documents: true, createdAt: true }
  });
  if (!index) throw new AppError(404, "MATERIAL_PREVIEW_UNAVAILABLE", "No saved indexed text is available for this material. Prepare its references first.");
  const documents = index.documents as unknown as IndexedChunk[];
  if (!Array.isArray(documents) || !documents.length) throw new AppError(409, "MATERIAL_PREVIEW_UNAVAILABLE", "The saved index contains no readable text. Prepare its references again.");
  if (offset && offset >= documents.length) throw new AppError(400, "MATERIAL_PREVIEW_PAGE_INVALID", "This page of indexed text no longer exists. Open the preview again.");
  const pageSize = 10;
  return {
    indexId: index.id, resourceId, title: resource.title, indexedAt: index.createdAt.toISOString(),
    offset, total: documents.length, nextOffset: offset + pageSize < documents.length ? offset + pageSize : null,
    passages: documents.slice(offset, offset + pageSize).map((document, position) => ({ number: offset + position + 1, title: document.title, text: document.text }))
  };
}
export async function prepareMaterialIndex(user: CurrentUser, courseId: string, resourceId: string, options: MaterialEmbeddingSelection & { force?: boolean; signal?: AbortSignal } = {}) {
  const status = await getMaterialIndexStatus(user, courseId, resourceId, options);
  if (status.state === "ready" && !options.force) return status.index!;
  const resource = toResource(await getContentResourceForPluginRoute(user, courseId, resourceId));
  const service = getServerContentTypePlugin(resource.pluginKey)?.indexing;
  if (!service) throw new AppError(409, "MATERIAL_INDEX_UNSUPPORTED", "This material type does not offer embedding generation.");
  const provider = await createCourseEmbeddingProvider(user, courseId, options);
  const token = randomUUID();
  const claimed = await prisma.$queryRaw<Array<{ token: string }>>`INSERT INTO "ContentMaterialIndexBuild" ("resourceId", token, "expiresAt")
    VALUES (${resourceId}, ${token}, NOW() + INTERVAL '10 minutes') ON CONFLICT ("resourceId") DO UPDATE
    SET token=EXCLUDED.token, "expiresAt"=EXCLUDED."expiresAt" WHERE "ContentMaterialIndexBuild"."expiresAt" < NOW() RETURNING token`;
  if (!claimed.length) throw new AppError(409, "MATERIAL_INDEX_BUSY", "This material is already being indexed. Wait for it to finish, then try again.");
  const heartbeat = setInterval(() => { void prisma.contentMaterialIndexBuild.updateMany({ where: { resourceId, token }, data: { expiresAt: new Date(Date.now() + 600_000) } }).catch(() => {}); }, 30_000);
  heartbeat.unref();
  try {
    return await service.prepare({ user, resource, signal: options.signal, store: async extracted => {
      if (options.signal?.aborted) throw new AppError(409, "ACTION_CANCELLED", "Material preparation was cancelled.");
      if (extracted.diagnostics.some(issue => issue.severity === "error")) throw new AppError(422, "MATERIAL_EXTRACTION_FAILED", "This material could not be fully extracted.", { diagnostics: extracted.diagnostics });
      const documents = chunkMaterialDocuments(extracted.documents);
      if (!documents.length) throw new AppError(422, "MATERIAL_TEXT_MISSING", "No readable teaching content was found in this material.");
      const contentFingerprint = contentIndexRevision(documents);
      const vectors = await provider.embedTexts(documents.map(document => document.text), options.signal);
      if (options.signal?.aborted) throw new AppError(409, "ACTION_CANCELLED", "Material preparation was cancelled.");
      const latest = toResource(await getContentResourceForPluginRoute(user, courseId, resourceId));
      const sourceRevision = service.policy(resource).revision;
      if (service.policy(latest).revision !== sourceRevision) throw new AppError(409, "MATERIAL_CHANGED", "The material changed while it was being indexed. Generate its embeddings again.");
      if (!await prisma.contentMaterialIndexBuild.findFirst({ where: { resourceId, token, expiresAt: { gt: new Date() } } })) throw new AppError(409, "MATERIAL_INDEX_LEASE_LOST", "The indexing lease expired. Generate embeddings again.");
      const stored = documents.map((document, index) => ({ ...document, sourceId: resourceId, vectorId: vectors[index].id }));
      const index = await prisma.contentMaterialIndex.upsert({ where: { sourceId_modelKey_contentFingerprint: { sourceId: resourceId, modelKey: provider.modelKey, contentFingerprint } },
        create: { courseId, resourceId, sourceId: resourceId, connectionId: provider.connectionId, modelKey: provider.modelKey, sourceRevision, contentFingerprint,
          embeddingConfig: { ...provider.selection, vectorDimensions: vectors[0].values.length } as Prisma.InputJsonValue, documents: stored as unknown as Prisma.InputJsonValue }, update: { sourceRevision, checkedAt: new Date() } });
      return descriptor(index);
    } });
  } finally { clearInterval(heartbeat); await prisma.contentMaterialIndexBuild.deleteMany({ where: { resourceId, token } }); }
}
export async function createPreparedMaterialSearch(user: CurrentUser, courseId: string, indexIds: string[], groupId?: string, selection?: MaterialEmbeddingSelection) {
  await assertCanViewCourse(user, courseId);
  const indexes = await prisma.contentMaterialIndex.findMany({ where: { id: { in: [...new Set(indexIds)] }, courseId } });
  if (indexes.length !== new Set(indexIds).size) throw new AppError(409, "MATERIAL_INDEX_MISSING", "Prepared reference material is no longer available.");
  for (const index of indexes) {
    // A retained index may outlive its placement, but an extant source must remain in the student's scope.
    if (index.resourceId) await getContentResourceForPluginRoute(user, courseId, index.resourceId, { groupId });
  }
  const chunks = indexes.flatMap(index => (index.documents as unknown as IndexedChunk[]).map(document => ({ ...document, contentResourceId: index.sourceId })));
  if (chunks.length > 10_000) throw new AppError(413, "REFERENCE_SELECTION_TOO_LARGE", "The selected reference set is too large for this workflow.");
  if (!indexes.length) return { search: async (_query: string, _limit = 3) => [] as Array<ContentEmbeddingDocument & { score: number; distance: number; contentResourceId: string }> };
  if ((!selection?.connectionId && !indexes[0].connectionId) || indexes.some(index => index.modelKey !== indexes[0].modelKey)) throw new AppError(409, "EMBEDDING_INDEX_INCOMPATIBLE", "The prepared materials use incompatible embedding configurations.");
  const provider = await createCourseEmbeddingProvider(user, courseId, selection ?? { ...indexConfig(indexes[0]), connectionId: indexes[0].connectionId! }, true);
  if (provider.modelKey !== indexes[0].modelKey) throw new AppError(409, "EMBEDDING_INDEX_INCOMPATIBLE", "The embedding connection changed. Reprepare the materials before opening submissions.");
  const rows = await prisma.contentMaterialVector.findMany({ where: { id: { in: [...new Set(chunks.map(chunk => chunk.vectorId))] } } });
  if (rows.reduce((sum, row) => sum + row.dimensions, 0) > 20_000_000) throw new AppError(413, "REFERENCE_SELECTION_TOO_LARGE", "Choose fewer reference materials for this embedding model.");
  if (rows.length !== new Set(chunks.map(chunk => chunk.vectorId)).size || rows.some(row => row.dimensions !== rows[0].dimensions || row.values.byteLength !== row.dimensions * 4)) throw new AppError(409, "EMBEDDING_INDEX_INCOMPATIBLE", "The prepared vector set is incomplete or incompatible.");
  const vectors = new Map(rows.map(row => [row.id, decodeVector(row.values)]));
  return { search: async (query: string, limit = 3) => {
    const [{ values }] = await provider.embedTexts([query.slice(0, 2000)]);
    if (rows.length && values.length !== rows[0].dimensions) throw new AppError(409, "EMBEDDING_INDEX_INCOMPATIBLE", "The query model does not match the prepared reference vectors.");
    return chunks.flatMap(chunk => {
      const vector = vectors.get(chunk.vectorId); if (!vector) return [];
      const score = vectorCosine(values, vector); const { vectorId: _vectorId, ...document } = chunk;
      return [{ ...document, score, distance: 1 - score }];
    }).sort((left, right) => right.score - left.score).slice(0, Math.max(1, Math.min(limit, 20)));
  } };
}
export function encodeVector(values: number[]) { const bytes = Buffer.alloc(values.length * 4); values.forEach((value, index) => bytes.writeFloatLE(value, index * 4)); return bytes; }
export function decodeVector(bytes: Uint8Array) { const buffer = Buffer.from(bytes); return Float32Array.from({ length: buffer.length / 4 }, (_, index) => buffer.readFloatLE(index * 4)); }
export function vectorCosine(left: ArrayLike<number>, right: ArrayLike<number>) {
  if (left.length !== right.length) return 0;
  let dot = 0, a = 0, b = 0;
  for (let i = 0; i < left.length; i++) { dot += left[i] * right[i]; a += left[i] ** 2; b += right[i] ** 2; }
  return a && b ? dot / Math.sqrt(a * b) : 0;
}

function indexConfig(index: { embeddingConfig?: unknown }): MaterialEmbeddingSelection {
  const value = index.embeddingConfig && typeof index.embeddingConfig === "object" && !Array.isArray(index.embeddingConfig) ? index.embeddingConfig as MaterialEmbeddingSelection : {};
  return typeof value.model === "string" ? value : { model: MATERIAL_EMBEDDING_MODEL, dimensions: MATERIAL_EMBEDDING_DIMENSIONS };
}
