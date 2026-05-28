import { randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { z } from "zod";
import type { ServerContentTypePlugin } from "@cognelo/content-type-sdk/server";
import { prisma } from "@cognelo/db";

const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
const SAFE_NAME_PATTERN = /[^a-zA-Z0-9._-]/g;

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
          const formData = await request.formData();
          const file = formData.get("file");
          const titleValue = formData.get("title");
          if (!(file instanceof File)) {
            return Response.json({ error: { code: "VALIDATION_ERROR", message: "A file is required." } }, { status: 400 });
          }
          if (file.size > MAX_UPLOAD_BYTES) {
            return Response.json({ error: { code: "UPLOAD_TOO_LARGE", message: "Files must be 25 MB or smaller." } }, { status: 413 });
          }
          const title = typeof titleValue === "string" && titleValue.trim() ? titleValue.trim() : file.name || context.resource?.title || "File";
          const originalName = file.name || "course-file";
          const storedName = `${randomUUID()}-${originalName.replace(SAFE_NAME_PATTERN, "_")}`;
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
          });
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
          const filePath = path.join(fileStorageDir(context.courseId), metadata.storedName);
          const fileStat = await stat(filePath);
          const stream = Readable.toWeb(createReadStream(filePath)) as ReadableStream;
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
    }
  }
};
