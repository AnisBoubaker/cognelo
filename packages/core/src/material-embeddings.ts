import { createHash, randomUUID } from "node:crypto";
import { Prisma, prisma } from "@cognelo/db";
import type { CurrentUser } from "@cognelo/contracts";
import { getServerContentTypePlugin, type ContentEmbeddingDocument, type PreparedContentIndex, type ServerContentResourceRecord } from "@cognelo/content-type-sdk/server";
import { getContentResourceForPluginRoute } from "./course-content";
import { assertCanManageCourse, assertCanViewCourse } from "./authorization";
import { getCourseTeacherQuestionAuthoringAiAgentConnection } from "./ai-agents";
import { decryptCredential } from "./credentials";
import { fetchAiResponse } from "./ai-http";
import { AppError } from "./errors";

export const MATERIAL_EMBEDDING_MODEL = "text-embedding-3-small";
export const MATERIAL_EMBEDDING_DIMENSIONS = 1536;
const MAX_INDEX_CHUNKS = 2000;
export const contentIndexRevision = (value: unknown) => createHash("sha256").update(JSON.stringify(canonical(value))).digest("hex");
function canonical(value: unknown): unknown { return Array.isArray(value) ? value.map(canonical) : value && typeof value === "object" ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, canonical(item)])) : value; }
type IndexedChunk = ContentEmbeddingDocument & { vectorId: string };

async function embeddingConnection(user: CurrentUser, courseId: string, connectionId?: string) {
  await assertCanViewCourse(user, courseId);
  const connection = connectionId ? await prisma.aiAgentConnection.findFirst({ where: { id: connectionId, isEnabled: true } })
    : await getCourseTeacherQuestionAuthoringAiAgentConnection(user, courseId);
  if (!connection || connection.provider !== "openai" || !connection.apiKey) throw new AppError(409, "EMBEDDING_CONNECTION_REQUIRED", "Configure an enabled OpenAI authoring connection before preparing material embeddings.");
  if (connection.ownerId && connection.ownerId !== user.id) {
    const membership = await prisma.courseMembership.findFirst({ where: { courseId, userId: connection.ownerId, source: "explicit", role: { in: ["owner", "teacher"] }, user: { isActive: true } } });
    if (!membership) throw new AppError(403, "EMBEDDING_CONNECTION_UNAVAILABLE", "The embedding connection is no longer authorized for this course.");
  }
  return connection;
}
export async function createCourseEmbeddingProvider(user: CurrentUser, courseId: string, connectionId?: string) {
  const connection = await embeddingConnection(user, courseId, connectionId);
  const baseUrl = (connection.baseUrl ?? "https://api.openai.com/v1").replace(/\/$/, "");
  const modelKey = contentIndexRevision({ provider: "openai", baseUrl, model: MATERIAL_EMBEDDING_MODEL, dimensions: MATERIAL_EMBEDDING_DIMENSIONS });
  const owner = connection.ownerId ? await prisma.user.findUnique({ where: { id: connection.ownerId }, select: { isActive: true, roles: { include: { role: true } } } }) : null;
  const allowPrivate = connection.ownerId === null || Boolean(owner?.isActive && owner.roles.some(entry => entry.role.key === "admin"));
  return { connectionId: connection.id, modelKey, dimensions: MATERIAL_EMBEDDING_DIMENSIONS,
    async embedTexts(texts: string[]) {
      const ids = texts.map(text => contentIndexRevision({ modelKey, text }));
      const cached = await prisma.contentMaterialVector.findMany({ where: { id: { in: [...new Set(ids)] } } });
      const vectors = new Map(cached.map(row => [row.id, decodeVector(row.values)]));
      const missing = [...new Map(texts.map((text, index) => [ids[index], text])).entries()].filter(([id]) => !vectors.has(id));
      for (let start = 0; start < missing.length; start += 32) {
        const batch = missing.slice(start, start + 32);
        if (batch.some(([, text]) => !text.trim() || Buffer.byteLength(text) > 8000)) throw new AppError(400, "EMBEDDING_TEXT_LIMIT", "An embedding input is empty or exceeds its bounded text size.");
        const response = await fetchAiResponse(`${baseUrl}/embeddings`, { headers: { "Authorization": `Bearer ${decryptCredential(connection.apiKey)}`, "Content-Type": "application/json" },
          body: JSON.stringify({ model: MATERIAL_EMBEDDING_MODEL, dimensions: MATERIAL_EMBEDDING_DIMENSIONS, encoding_format: "float", input: batch.map(([, text]) => text) }) }, allowPrivate);
        if (!response.ok) throw new AppError(response.status === 429 ? 429 : 502, "EMBEDDING_REQUEST_FAILED", `Material embedding generation failed (HTTP ${response.status}). Try again after checking the OpenAI connection.`);
        const payload = await response.json() as { data?: Array<{ index: number; embedding: number[] }> };
        if (!Array.isArray(payload.data) || payload.data.length !== batch.length) throw new AppError(502, "EMBEDDING_RESPONSE_INVALID", "The embedding service returned an incomplete response.");
        for (let index = 0; index < batch.length; index++) {
          const values = payload.data.find(row => row.index === index)?.embedding;
          if (!Array.isArray(values) || values.length !== MATERIAL_EMBEDDING_DIMENSIONS || values.some(value => typeof value !== "number" || !Number.isFinite(value))) throw new AppError(502, "EMBEDDING_RESPONSE_INVALID", "The embedding service returned an invalid vector.");
          const id = batch[index][0];
          const saved = await prisma.contentMaterialVector.upsert({ where: { id }, create: { id, modelKey, dimensions: MATERIAL_EMBEDDING_DIMENSIONS, values: encodeVector(values) }, update: {} });
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
    documentCount: Array.isArray(index.documents) ? index.documents.length : 0, connectionId: index.connectionId ?? "" };
}
export async function getMaterialIndexStatus(user: CurrentUser, courseId: string, resourceId: string, connectionId?: string) {
  await assertCanManageCourse(user, courseId);
  const resource = toResource(await getContentResourceForPluginRoute(user, courseId, resourceId));
  const service = getServerContentTypePlugin(resource.pluginKey)?.indexing;
  if (!service) return { state: "unsupported" as const, sourceId: resourceId, title: resource.title, index: null, maxAgeHours: null };
  const provider = await createCourseEmbeddingProvider(user, courseId, connectionId);
  const policy = service.policy(resource);
  const index = await prisma.contentMaterialIndex.findFirst({ where: { resourceId, modelKey: provider.modelKey }, orderBy: { checkedAt: "desc" } });
  const expired = index && policy.maxAgeHours != null && Date.now() - index.checkedAt.getTime() >= policy.maxAgeHours * 3_600_000;
  return { state: !index ? "missing" as const : expired || index.sourceRevision !== policy.revision ? "stale" as const : "ready" as const,
    sourceId: resourceId, title: resource.title, index: index ? descriptor(index) : null, maxAgeHours: policy.maxAgeHours ?? null };
}
export async function prepareMaterialIndex(user: CurrentUser, courseId: string, resourceId: string, options: { connectionId?: string; force?: boolean; signal?: AbortSignal } = {}) {
  const status = await getMaterialIndexStatus(user, courseId, resourceId, options.connectionId);
  if (status.state === "ready" && !options.force) return status.index!;
  const resource = toResource(await getContentResourceForPluginRoute(user, courseId, resourceId));
  const service = getServerContentTypePlugin(resource.pluginKey)?.indexing;
  if (!service) throw new AppError(409, "MATERIAL_INDEX_UNSUPPORTED", "This material type does not offer embedding generation.");
  const provider = await createCourseEmbeddingProvider(user, courseId, options.connectionId);
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
      const vectors = await provider.embedTexts(documents.map(document => document.text));
      if (options.signal?.aborted) throw new AppError(409, "ACTION_CANCELLED", "Material preparation was cancelled.");
      const latest = toResource(await getContentResourceForPluginRoute(user, courseId, resourceId));
      const sourceRevision = service.policy(resource).revision;
      if (service.policy(latest).revision !== sourceRevision) throw new AppError(409, "MATERIAL_CHANGED", "The material changed while it was being indexed. Generate its embeddings again.");
      if (!await prisma.contentMaterialIndexBuild.findFirst({ where: { resourceId, token, expiresAt: { gt: new Date() } } })) throw new AppError(409, "MATERIAL_INDEX_LEASE_LOST", "The indexing lease expired. Generate embeddings again.");
      const stored = documents.map((document, index) => ({ ...document, sourceId: resourceId, vectorId: vectors[index].id }));
      const index = await prisma.contentMaterialIndex.upsert({ where: { sourceId_modelKey_contentFingerprint: { sourceId: resourceId, modelKey: provider.modelKey, contentFingerprint } },
        create: { courseId, resourceId, sourceId: resourceId, connectionId: provider.connectionId, modelKey: provider.modelKey, sourceRevision, contentFingerprint,
          documents: stored as unknown as Prisma.InputJsonValue }, update: { sourceRevision, checkedAt: new Date() } });
      return descriptor(index);
    } });
  } finally { clearInterval(heartbeat); await prisma.contentMaterialIndexBuild.deleteMany({ where: { resourceId, token } }); }
}
export async function createPreparedMaterialSearch(user: CurrentUser, courseId: string, indexIds: string[], groupId?: string) {
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
  if (!indexes[0].connectionId || indexes.some(index => index.modelKey !== indexes[0].modelKey)) throw new AppError(409, "EMBEDDING_INDEX_INCOMPATIBLE", "The prepared materials use incompatible embedding configurations.");
  const provider = await createCourseEmbeddingProvider(user, courseId, indexes[0].connectionId);
  if (provider.modelKey !== indexes[0].modelKey) throw new AppError(409, "EMBEDDING_INDEX_INCOMPATIBLE", "The embedding connection changed. Reprepare the materials before opening submissions.");
  const rows = await prisma.contentMaterialVector.findMany({ where: { id: { in: [...new Set(chunks.map(chunk => chunk.vectorId))] } } });
  const vectors = new Map(rows.map(row => [row.id, decodeVector(row.values)]));
  return { search: async (query: string, limit = 3) => {
    const [{ values }] = await provider.embedTexts([query.slice(0, 2000)]);
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
