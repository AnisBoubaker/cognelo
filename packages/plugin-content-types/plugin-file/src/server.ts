import { readBoundedFormData, openStoredMaterial } from "@cognelo/core";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { z } from "zod";
import type { ContentEmbeddingDocumentsResult, ServerContentResourceRecord, ServerContentTypePlugin } from "@cognelo/content-type-sdk/server";
import { buildContentVectorIndex, searchContentVectorIndex, type ContentVectorIndex } from "@cognelo/content-type-sdk/vector";
import { Prisma, prisma } from "@cognelo/db";

const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
const MAX_EMBEDDING_TEXT_BYTES = 512 * 1024;
const SAFE_NAME_PATTERN = /[^a-zA-Z0-9._-]/g;
const EMBEDDING_INDEX_KEY = "embeddingIndex";

const filePayloadSchema = z.object({
  title: z.string().trim().min(1).max(180).optional()
});

type FileMetadata = {
  originalName?: string;
  storedName?: string;
  mimeType?: string;
  size?: number;
  setupStatus?: string;
};

function fileStorageDir(courseId: string) {
  return path.join(process.cwd(), "../../storage/course-content-files", courseId);
}

function readMetadata(metadata: Record<string, unknown> | undefined): FileMetadata {
  return (metadata ?? {}) as FileMetadata;
}


export const fileContentServerPlugin: ServerContentTypePlugin = {
  key: "file-content",
  routes: [
    {
      path: "upload",
      contentTypeKeys: ["file"],
      methods: {
        async PUT({ request, context }) {
          const formData = await readBoundedFormData(request);
          const file = formData.get("file");
          const titleValue = formData.get("title");
          if (!(file instanceof File)) {
            return Response.json({ error: { code: "VALIDATION_ERROR", message: "A file is required." } }, { status: 400 });
          }
          if (file.size > MAX_UPLOAD_BYTES) {
            return Response.json({ error: { code: "UPLOAD_TOO_LARGE", message: "Files must be 25 MB or smaller." } }, { status: 413 });
          }
          const title = filePayloadSchema.parse({ title: typeof titleValue === "string" && titleValue.trim() ? titleValue.trim() : file.name || context.resource?.title || "File" }).title!;
          const originalName = z.string().max(255).parse(file.name || "course-file");
          const storedName = `${randomUUID()}-${originalName.replace(SAFE_NAME_PATTERN, "_").slice(0, 180)}`;
          const storageDir = fileStorageDir(context.courseId);
          await mkdir(storageDir, { recursive: true });
          await writeFile(path.join(storageDir, storedName), Buffer.from(await file.arrayBuffer()));
          const resource = await prisma.courseContentResource.update({
            where: { id: context.resourceId },
            data: {
              title,
              metadata: {
                ...(context.resource?.metadata ?? {}),
                originalName,
                storedName,
                mimeType: file.type || "application/octet-stream",
                size: file.size,
                setupStatus: "uploaded"
              }
            }
          }).catch(async (error) => { await unlink(path.join(storageDir, storedName)).catch(() => undefined); throw error; });
          return { resource };
        }
      }
    },
    {
      path: "download",
      contentTypeKeys: ["file"],
      methods: {
        async GET({ context }) {
          const metadata = readMetadata(context.resource?.metadata);
          if (!metadata.storedName) {
            return Response.json({ error: { code: "NOT_DOWNLOADABLE", message: "This file has not been uploaded yet." } }, { status: 400 });
          }
          const file = await openStoredMaterial(path.resolve(process.cwd(), "../../storage/course-content-files"), [context.courseId], metadata.storedName);
          const fileStat = await file.stat();
          const stream = Readable.toWeb(file.createReadStream()) as ReadableStream;
          return new Response(stream, {
            headers: {
              "Cache-Control": "no-store, max-age=0",
              "Content-Type": metadata.mimeType ?? "application/octet-stream",
              "Content-Length": String(fileStat.size),
              "Content-Disposition": `attachment; filename="${encodeURIComponent(metadata.originalName ?? context.resource?.title ?? "file")}"`
            }
          });
        }
      }
    }
  ],
  handlers: {
    async duplicate(input) {
      const { embeddingIndex: _embeddingIndex, ...metadata } = input.resource.metadata ?? {};
      return { title: input.title, metadata };
    },
    async create(input) {
      const parsed = filePayloadSchema.parse(input.payload);
      return {
        title: parsed.title ?? "File",
        metadata: { setupStatus: "draft" }
      };
    },
    async update(input) {
      const parsed = filePayloadSchema.parse(input.payload);
      return {
        ...(parsed.title ? { title: parsed.title } : {}),
        metadata: input.resource.metadata ?? {}
      };
    },
    async resolveOpenAction(input) {
      const metadata = readMetadata(input.resource.metadata);
      return metadata.storedName ? { kind: "plugin_route", routePath: ["download"] } : { kind: "none" };
    },
    async getEmbeddingSource(input) {
      const metadata = readMetadata(input.resource.metadata);
      return metadata.storedName
        ? { kind: "file", fileRef: metadata.storedName, mimeType: metadata.mimeType, sourceId: input.resource.id }
        : { kind: "none", sourceId: input.resource.id };
    },
    async getEmbeddingDocuments(input) {
      return getFileEmbeddingDocuments(input.resource);
    },
    async indexEmbeddingDocuments(input) {
      const { diagnostics, index } = await ensureFileVectorIndex(input.resource);
      return {
        sourceId: input.resource.id,
        documentCount: index.documents.length,
        vectorCount: index.documents.length,
        diagnostics,
        metadata: { dimensions: index.dimensions, modelKey: index.modelKey }
      };
    },
    async searchEmbeddingDocuments(input) {
      const { diagnostics, index } = await ensureFileVectorIndex(input.resource);
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

async function getFileEmbeddingDocuments(resource: ServerContentResourceRecord): Promise<ContentEmbeddingDocumentsResult> {
  const metadata = readMetadata(resource.metadata);
  if (!metadata.storedName) {
    return {
      sourceId: resource.id,
      documents: [],
      diagnostics: [
        {
          code: "FILE_CONTENT_NOT_UPLOADED",
          message: "This file resource has no uploaded file.",
          severity: "warning"
        }
      ]
    };
  }

  const file = await openStoredMaterial(path.resolve(process.cwd(), "../../storage/course-content-files"), [resource.courseId], metadata.storedName);
  const fileStat = await file.stat();
  if (fileStat.size > MAX_EMBEDDING_TEXT_BYTES) {
    await file.close();
    return {
      sourceId: resource.id,
      documents: [],
      diagnostics: [
        {
          code: "FILE_CONTENT_TOO_LARGE_FOR_EXTRACTION",
          message: "This file is too large for local text extraction.",
          severity: "warning",
          metadata: { size: fileStat.size }
        }
      ]
    };
  }

  const bytes = await file.readFile().finally(() => file.close());
  const mimeType = metadata.mimeType ?? "application/octet-stream";
  const extracted = extractFileText(bytes, mimeType, metadata.originalName ?? resource.title);
  return {
    sourceId: resource.id,
    documents: extracted.text.trim()
      ? [
          {
            id: `${resource.id}:file`,
            sourceId: resource.id,
            title: resource.title,
            text: extracted.text,
            kind: extracted.kind,
            languageKey: extracted.languageKey,
            path: metadata.originalName ?? null,
            metadata: {
              mimeType,
              originalName: metadata.originalName,
              size: fileStat.size
            }
          }
        ]
      : [],
    diagnostics: extracted.diagnostics
  };
}

async function ensureFileVectorIndex(resource: ServerContentResourceRecord) {
  const documents = await getFileEmbeddingDocuments(resource);
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

function extractFileText(bytes: Buffer, mimeType: string, fileName: string) {
  if (isPlainTextFile(mimeType, fileName)) {
    return {
      text: bytes.toString("utf8"),
      kind: isCodeFile(fileName) ? ("code" as const) : ("plain_text" as const),
      languageKey: languageKeyForFile(fileName),
      diagnostics: []
    };
  }

  if (mimeType === "application/pdf" || fileName.toLowerCase().endsWith(".pdf")) {
    const text = extractSimplePdfText(bytes);
    return {
      text,
      kind: "plain_text" as const,
      languageKey: null,
      diagnostics: text.trim()
        ? [
            {
              code: "PDF_TEXT_EXTRACTED_BASIC",
              message: "Extracted PDF text with the file content plugin's basic local extractor.",
              severity: "info" as const
            }
          ]
        : [
            {
              code: "PDF_TEXT_EXTRACTION_EMPTY",
              message: "No text could be extracted from this PDF by the file content plugin.",
              severity: "warning" as const
            }
          ]
    };
  }

  return {
    text: "",
    kind: "plain_text" as const,
    languageKey: null,
    diagnostics: [
      {
        code: "FILE_CONTENT_EXTRACTION_UNSUPPORTED",
        message: "This file type does not expose extractable text yet.",
        severity: "warning" as const,
        metadata: { mimeType }
      }
    ]
  };
}

function isPlainTextFile(mimeType: string, fileName: string) {
  const lowerName = fileName.toLowerCase();
  return (
    mimeType.startsWith("text/") ||
    ["application/json", "application/javascript", "application/typescript", "application/xml"].includes(mimeType) ||
    /\.(c|cc|cpp|css|csv|h|hpp|html|java|js|json|md|py|ts|tsx|txt|xml)$/i.test(lowerName)
  );
}

function isCodeFile(fileName: string) {
  return /\.(c|cc|cpp|css|h|hpp|html|java|js|py|ts|tsx)$/i.test(fileName);
}

function languageKeyForFile(fileName: string) {
  const lowerName = fileName.toLowerCase();
  if (/\.(c|h)$/i.test(lowerName)) return "c";
  if (/\.(cc|cpp|hpp)$/i.test(lowerName)) return "cpp";
  if (/\.py$/i.test(lowerName)) return "python";
  if (/\.(js|jsx)$/i.test(lowerName)) return "javascript";
  if (/\.(ts|tsx)$/i.test(lowerName)) return "typescript";
  if (/\.java$/i.test(lowerName)) return "java";
  if (/\.html$/i.test(lowerName)) return "html";
  if (/\.css$/i.test(lowerName)) return "css";
  return null;
}

/** Linear literal-string scan; malformed nesting must not trigger regex backtracking. */
export function extractSimplePdfText(bytes: Buffer) {
  const raw = bytes.toString("latin1"), values: string[] = [];
  let depth = 0, current: string[] = [];
  for (let index = 0; index < raw.length; index++) {
    const character = raw[index];
    if (!depth) {
      if (character === "(") { depth = 1; current = []; }
      continue;
    }
    if (character === "\\" && index + 1 < raw.length) {
      const escaped = raw[++index];
      if (escaped === "\r" || escaped === "\n") { if (escaped === "\r" && raw[index + 1] === "\n") index++; continue; }
      if (/[0-7]/.test(escaped)) {
        let octal = escaped;
        while (octal.length < 3 && index + 1 < raw.length && /[0-7]/.test(raw[index + 1])) octal += raw[++index];
        current.push(String.fromCharCode(parseInt(octal, 8)));
      } else current.push(({ n: "\n", r: "\r", t: "\t", b: " ", f: " " } as Record<string, string>)[escaped] ?? escaped);
    } else if (character === "(") { depth++; current.push(character); }
    else if (character === ")") { if (--depth === 0) values.push(current.join("")); else current.push(character); }
    else current.push(character);
  }
  return values.join("\n").split("\n").map((line) => line.trimEnd()).join("\n").trim();
}
