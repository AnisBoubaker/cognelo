import type { ContentEmbeddingDocument, ContentEmbeddingDiagnostic, ContentEmbeddingDocumentsResult } from "./server";

export type ContentEmbeddingVector = {
  dimensions: number;
  modelKey: string;
  values: number[];
};

export type ContentVectorEmbeddingProvider = {
  dimensions: number;
  modelKey: string;
  embedText(text: string): Promise<ContentEmbeddingVector>;
};

export type ContentVectorIndexedDocument = ContentEmbeddingDocument & {
  embedding: ContentEmbeddingVector;
};

export type ContentVectorIndex = {
  dimensions: number;
  documents: ContentVectorIndexedDocument[];
  indexedAt: string;
  modelKey: string;
  sourceId: string;
};

export type ContentVectorIndexResult = {
  sourceId: string;
  documentCount: number;
  vectorCount: number;
  diagnostics: ContentEmbeddingDiagnostic[];
  metadata?: Record<string, unknown>;
};

export type ContentVectorSearchMatch = {
  sourceId: string;
  documentId: string;
  title: string;
  text: string;
  kind: ContentEmbeddingDocument["kind"];
  languageKey?: string | null;
  path?: string | null;
  score: number;
  distance: number;
  metadata?: Record<string, unknown>;
};

export type ContentVectorSearchResult = {
  sourceId: string;
  matches: ContentVectorSearchMatch[];
  diagnostics: ContentEmbeddingDiagnostic[];
  metadata?: Record<string, unknown>;
};

const DEFAULT_VECTOR_DIMENSIONS = 64;
const DEFAULT_VECTOR_MODEL_KEY = "cognelo-deterministic-dev-v1";

export function createDeterministicContentEmbeddingProvider(
  options: {
    dimensions?: number;
    modelKey?: string;
  } = {}
): ContentVectorEmbeddingProvider {
  const dimensions = options.dimensions ?? DEFAULT_VECTOR_DIMENSIONS;
  const modelKey = options.modelKey ?? DEFAULT_VECTOR_MODEL_KEY;
  return {
    dimensions,
    modelKey,
    async embedText(text) {
      return {
        dimensions,
        modelKey,
        values: embedTextDeterministically(text, dimensions)
      };
    }
  };
}

export async function buildContentVectorIndex(
  result: ContentEmbeddingDocumentsResult,
  options: {
    embeddingProvider?: ContentVectorEmbeddingProvider;
    indexedAt?: string;
  } = {}
): Promise<ContentVectorIndex> {
  const provider = options.embeddingProvider ?? createDeterministicContentEmbeddingProvider();
  const documents = await Promise.all(
    result.documents.map(async (document) => ({
      ...document,
      embedding: await provider.embedText(document.text)
    }))
  );
  return {
    dimensions: provider.dimensions,
    documents,
    indexedAt: options.indexedAt ?? new Date().toISOString(),
    modelKey: provider.modelKey,
    sourceId: result.sourceId
  };
}

export async function searchContentVectorIndex(
  index: ContentVectorIndex,
  input: {
    embeddingProvider?: ContentVectorEmbeddingProvider;
    limit?: number;
    minScore?: number;
    queryText?: string;
    queryVector?: number[];
  }
): Promise<ContentVectorSearchMatch[]> {
  const limit = Math.max(1, input.limit ?? 10);
  const queryVector =
    input.queryVector ?? (input.queryText ? (await (input.embeddingProvider ?? createDeterministicContentEmbeddingProvider()).embedText(input.queryText)).values : null);
  if (!queryVector) {
    throw new Error("Vector search requires queryText or queryVector.");
  }
  const minScore = input.minScore ?? -1;
  return index.documents
    .map((document) => {
      const score = cosineSimilarity(queryVector, document.embedding.values);
      return {
        documentId: document.id,
        sourceId: document.sourceId,
        title: document.title,
        text: document.text,
        kind: document.kind,
        languageKey: document.languageKey,
        path: document.path,
        score,
        distance: 1 - score,
        metadata: document.metadata
      };
    })
    .filter((match) => match.score >= minScore)
    .sort((left, right) => right.score - left.score || left.documentId.localeCompare(right.documentId))
    .slice(0, limit);
}

export function cosineSimilarity(left: readonly number[], right: readonly number[]) {
  const length = Math.min(left.length, right.length);
  let dot = 0;
  let leftMagnitude = 0;
  let rightMagnitude = 0;
  for (let index = 0; index < length; index += 1) {
    dot += left[index] * right[index];
    leftMagnitude += left[index] * left[index];
    rightMagnitude += right[index] * right[index];
  }
  if (!leftMagnitude || !rightMagnitude) {
    return 0;
  }
  return dot / (Math.sqrt(leftMagnitude) * Math.sqrt(rightMagnitude));
}

function embedTextDeterministically(text: string, dimensions: number) {
  const values = Array.from({ length: dimensions }, () => 0);
  const tokens = text.toLowerCase().match(/[a-z0-9_]+/g) ?? [];
  for (const token of tokens) {
    const hash = hashToken(token);
    values[hash % dimensions] += 1;
  }
  const magnitude = Math.sqrt(values.reduce((sum, value) => sum + value * value, 0));
  return magnitude ? values.map((value) => value / magnitude) : values;
}

function hashToken(token: string) {
  let hash = 2166136261;
  for (let index = 0; index < token.length; index += 1) {
    hash ^= token.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
