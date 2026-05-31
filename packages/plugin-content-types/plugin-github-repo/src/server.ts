import { z } from "zod";
import type { ContentEmbeddingDocumentsResult, ServerContentResourceRecord, ServerContentTypePlugin } from "@cognelo/content-type-sdk/server";
import { buildContentVectorIndex, searchContentVectorIndex, type ContentVectorIndex } from "@cognelo/content-type-sdk/vector";
import { Prisma, prisma } from "@cognelo/db";
import { normalizeGithubRepoUrl } from "./shared";

const EMBEDDING_INDEX_KEY = "embeddingIndex";

const githubRepoPayloadSchema = z.object({
  title: z.string().trim().min(1).max(180).optional(),
  url: z.string().trim().url().optional()
});

function parseGithubRepoPayload(payload: unknown) {
  const input = githubRepoPayloadSchema.parse(payload);
  const url = input.url ? normalizeGithubRepoUrl(input.url) : null;
  return {
    title: input.title ?? "GitHub repository",
    url
  };
}

function readUrl(metadata: Record<string, unknown> | undefined) {
  const url = metadata?.url;
  return typeof url === "string" ? url : null;
}

export const githubRepoContentServerPlugin: ServerContentTypePlugin = {
  key: "github-repo-content",
  handlers: {
    async create(input) {
      const parsed = parseGithubRepoPayload(input.payload);
      return {
        title: parsed.title,
        metadata: parsed.url ? { url: parsed.url } : { setupStatus: "draft" }
      };
    },
    async update(input) {
      const currentUrl = readUrl(input.resource.metadata);
      const parsed = githubRepoPayloadSchema.partial().parse(input.payload);
      const nextUrl = parsed.url ? normalizeGithubRepoUrl(parsed.url) : currentUrl;
      return {
        ...(parsed.title !== undefined ? { title: parsed.title } : {}),
        metadata: {
          ...(input.resource.metadata ?? {}),
          ...(nextUrl ? { url: nextUrl } : {})
        }
      };
    },
    async resolveOpenAction(input) {
      const url = readUrl(input.resource.metadata);
      return url ? { kind: "external_url", href: url } : { kind: "none" };
    },
    async getEmbeddingSource(input) {
      const url = readUrl(input.resource.metadata);
      return url ? { kind: "external_url", url, sourceId: input.resource.id } : { kind: "none", sourceId: input.resource.id };
    },
    async getEmbeddingDocuments(input) {
      return getGithubEmbeddingDocuments(input.resource);
    },
    async indexEmbeddingDocuments(input) {
      const { diagnostics, index } = await ensureGithubVectorIndex(input.resource);
      return {
        sourceId: input.resource.id,
        documentCount: index.documents.length,
        vectorCount: index.documents.length,
        diagnostics,
        metadata: { dimensions: index.dimensions, modelKey: index.modelKey }
      };
    },
    async searchEmbeddingDocuments(input) {
      const { diagnostics, index } = await ensureGithubVectorIndex(input.resource);
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

function getGithubEmbeddingDocuments(resource: ServerContentResourceRecord): ContentEmbeddingDocumentsResult {
  const url = readUrl(resource.metadata);
  return {
    sourceId: resource.id,
    documents: url
      ? [
          {
            id: `${resource.id}:repo-url`,
            sourceId: resource.id,
            title: resource.title,
            text: url,
            kind: "external_reference",
            metadata: { url }
          }
        ]
      : [],
    diagnostics: url
      ? [
          {
            code: "GITHUB_REPO_URL_INDEXING_DEFERRED",
            message: "Repository cloning and source extraction are owned by the GitHub content plugin and are not implemented yet.",
            severity: "info"
          }
        ]
      : [
          {
            code: "GITHUB_REPO_URL_MISSING",
            message: "This GitHub repository resource has no URL.",
            severity: "warning"
          }
        ]
  };
}

async function ensureGithubVectorIndex(resource: ServerContentResourceRecord) {
  const documents = getGithubEmbeddingDocuments(resource);
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
