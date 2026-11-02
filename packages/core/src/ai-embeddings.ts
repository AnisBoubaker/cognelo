import { prisma } from "@cognelo/db";
import { AppError } from "./errors";
import { decryptCredential } from "./credentials";
import { fetchAiResponse } from "./ai-http";
import { aiConnectionBaseUrl } from "./ai-agents";
export const MAX_EMBEDDING_DIMENSIONS = 8192;

export async function requestAiEmbeddings(connection: { ownerId: string | null; provider: "openai" | "codex" | "claude" | "ollama"; baseUrl: string | null; apiKey: string | null; model: string }, texts: string[], dimensions: number | null, signal?: AbortSignal) {
  if (connection.provider === "claude") throw new AppError(409, "AI_EMBEDDING_PROVIDER_UNSUPPORTED", "Choose an embedding-capable connection; Claude connections provide text generation.");
  const owner = connection.ownerId ? await prisma.user.findUnique({ where: { id: connection.ownerId }, select: { isActive: true, roles: { include: { role: true } } } }) : null;
  const allowPrivate = connection.ownerId === null || Boolean(owner?.isActive && owner.roles.some(entry => entry.role.key === "admin"));
  const ollama = connection.provider === "ollama";
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (connection.apiKey) headers.Authorization = `Bearer ${decryptCredential(connection.apiKey)}`;
  const response = await fetchAiResponse(`${aiConnectionBaseUrl(connection)}${ollama ? "/api/embed" : "/embeddings"}`, { signal, headers,
    body: JSON.stringify({ model: connection.model, input: texts, ...(dimensions ? { dimensions } : {}), ...(ollama ? { truncate: false } : { encoding_format: "float" }) }) }, allowPrivate);
  if (!response.ok) throw new AppError(response.status === 429 ? 429 : 502, "EMBEDDING_REQUEST_FAILED", `The selected embedding model returned HTTP ${response.status}. Check the connection and that this model supports embeddings.`);
  const payload = await response.json().catch(() => null) as { data?: Array<{ index: number; embedding: number[] }>; embeddings?: number[][] } | null;
  if (!payload || typeof payload !== "object") throw new AppError(502, "EMBEDDING_RESPONSE_INVALID", "The embedding service returned an invalid response.");
  if (!ollama && (!Array.isArray(payload.data) || payload.data.length !== texts.length || payload.data.some(row => !row || typeof row !== "object") || new Set(payload.data.map(row => row.index)).size !== texts.length)) throw new AppError(502, "EMBEDDING_RESPONSE_INVALID", "The embedding service returned an incomplete response.");
  const vectors = ollama ? payload.embeddings : texts.map((_, index) => payload.data!.find(row => row.index === index)?.embedding);
  if (!Array.isArray(vectors) || vectors.length !== texts.length) throw new AppError(502, "EMBEDDING_RESPONSE_INVALID", "The embedding service returned an incomplete response.");
  const actualDimensions = dimensions ?? vectors[0]?.length;
  if (!actualDimensions || actualDimensions > MAX_EMBEDDING_DIMENSIONS || vectors.some(values => !Array.isArray(values) || values.length !== actualDimensions || values.some(value => typeof value !== "number" || !Number.isFinite(value) || Math.abs(value) > 3.4028234663852886e38))) throw new AppError(502, "EMBEDDING_RESPONSE_INVALID", "The embedding service returned invalid or incompatible vector dimensions.");
  return vectors as number[][];
}
