import { z } from "zod";
import type { ContentEmbeddingDocumentsResult, ServerContentResourceRecord, ServerContentTypePlugin } from "@cognelo/content-type-sdk/server";
import { buildContentVectorIndex, searchContentVectorIndex, type ContentVectorIndex } from "@cognelo/content-type-sdk/vector";
import { Prisma, prisma } from "@cognelo/db";

const textPayloadSchema = z.object({
  title: z.string().trim().min(1).max(180).optional(),
  body: z.string().max(20000).optional(),
  format: z.literal("markdown").optional()
});

function bodyFrom(metadata: Record<string, unknown> | undefined) {
  return typeof metadata?.body === "string" ? metadata.body : "";
}

const EMBEDDING_INDEX_KEY = "embeddingIndex";

export const textContentServerPlugin: ServerContentTypePlugin = {
  key: "text-content",
  handlers: {
    async create(input) {
      const parsed = textPayloadSchema.parse(input.payload);
      return {
        title: parsed.title ?? "Text note",
        metadata: {
          body: parsed.body ?? "",
          format: "markdown"
        }
      };
    },
    async update(input) {
      const parsed = textPayloadSchema.parse(input.payload);
      return {
        ...(parsed.title ? { title: parsed.title } : {}),
        metadata: {
          ...(input.resource.metadata ?? {}),
          ...(parsed.body !== undefined ? { body: parsed.body } : {}),
          format: "markdown"
        }
      };
    },
    async resolveOpenAction() {
      return { kind: "viewer" };
    },
    async getEmbeddingSource(input) {
      return { kind: "text", text: bodyFrom(input.resource.metadata), sourceId: input.resource.id };
    },
    async getEmbeddingDocuments(input) {
      return getTextEmbeddingDocuments(input.resource);
    },
    async indexEmbeddingDocuments(input) {
      const { diagnostics, index } = await ensureTextVectorIndex(input.resource);
      return {
        sourceId: input.resource.id,
        documentCount: index.documents.length,
        vectorCount: index.documents.length,
        diagnostics,
        metadata: { dimensions: index.dimensions, modelKey: index.modelKey }
      };
    },
    async searchEmbeddingDocuments(input) {
      const { diagnostics, index } = await ensureTextVectorIndex(input.resource);
      return {
        sourceId: input.resource.id,
        matches: await searchContentVectorIndex(index, {
          limit: input.limit,
          minScore: input.minScore,
          queryText: input.queryText,
          queryVector: input.queryVector
        }),
        diagnostics,
        metadata: { dimensions: index.dimensions, modelKey: index.modelKey }
      };
    }
  }
};

function getTextEmbeddingDocuments(resource: ServerContentResourceRecord): ContentEmbeddingDocumentsResult {
  const text = bodyFrom(resource.metadata);
  return {
    sourceId: resource.id,
    documents: text.trim()
      ? [
          {
            id: `${resource.id}:body`,
            sourceId: resource.id,
            title: resource.title,
            text,
            kind: "markdown",
            metadata: { format: "markdown" }
          }
        ]
      : [],
    diagnostics: text.trim()
      ? []
      : [
          {
            code: "TEXT_CONTENT_EMPTY",
            message: "This text resource has no body.",
            severity: "warning"
          }
        ]
  };
}

async function ensureTextVectorIndex(resource: ServerContentResourceRecord) {
  const documents = getTextEmbeddingDocuments(resource);
  const fingerprint = fingerprintDocuments(documents);
  const existing = readVectorIndex(resource.metadata, fingerprint);
  if (existing) {
    return { diagnostics: documents.diagnostics, index: existing };
  }

  const index = await buildContentVectorIndex(documents);
  await prisma.courseContentResource.update({
    where: { id: resource.id },
    data: {
      metadata: {
        ...(resource.metadata ?? {}),
        [EMBEDDING_INDEX_KEY]: {
          ...index,
          fingerprint
        }
      } as Prisma.InputJsonValue
    }
  });
  return { diagnostics: documents.diagnostics, index };
}

function readVectorIndex(metadata: Record<string, unknown> | undefined, fingerprint: string): ContentVectorIndex | null {
  const value = metadata?.[EMBEDDING_INDEX_KEY];
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const candidate = value as ContentVectorIndex & { fingerprint?: string };
  return candidate.fingerprint === fingerprint && Array.isArray(candidate.documents) ? candidate : null;
}

function fingerprintDocuments(result: ContentEmbeddingDocumentsResult) {
  return JSON.stringify(result.documents.map((document) => [document.id, document.kind, document.languageKey ?? null, document.path ?? null, document.text]));
}
