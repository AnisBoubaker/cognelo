import { Readable } from "node:stream";
import { Zip, ZipPassThrough } from "fflate";
import { AppError } from "@cognelo/core";
import { prisma } from "./db-client";
import { readProvidedAttachmentChunks } from "./attachment-storage";

const MAX_FILES = 1000;
const MAX_FILE_BYTES = 25 * 1024 * 1024;
const MAX_TOTAL_BYTES = 256 * 1024 * 1024;
type Owner = { ownerKind: "course_activity" | "bank_activity"; ownerId: string };
type Attachment = { storedName: string; originalName: string; sizeBytes: bigint; sha256: string; mimeType: string | null; metadata?: unknown };

function savedPath(value: unknown) {
  if (typeof value !== "string" || !value || value.length > 500 || /^[\\/]|^[A-Za-z]:/.test(value) || /[\\\x00-\x1f\x7f]/.test(value) || value.split("/").some(part => !part || part === "." || part === "..")) throw new AppError(409, "HOMEWORK_PROVIDED_PATH_INVALID", "A provided file has an invalid stored path.");
  return value;
}
function metadata(value: unknown): Record<string, unknown> { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}; }

export function providedArchiveNames(files: Array<{ originalName: string; metadata?: unknown }>) {
  const used = new Set<string>();
  return files.map(file => {
    const base = file.originalName.replace(/\\/g, "/").split("/").at(-1)?.normalize("NFC").replace(/[\x00-\x1f\x7f]/g, "").replace(/[<>:"|?*]/g, "_").trim();
    const storedPath = metadata(file.metadata).providedPath;
    const safe = storedPath !== undefined ? savedPath(storedPath) : !base || base === "." || base === ".." ? "provided-file" : base;
    const split = safe.lastIndexOf(".");
    const hasExtension = split > safe.lastIndexOf("/") + 1;
    const stem = hasExtension ? safe.slice(0, split) : safe, extension = hasExtension ? safe.slice(split) : "";
    let name = safe, number = 2;
    while (used.has(name.toLowerCase())) name = `${stem} (${number++})${extension}`;
    used.add(name.toLowerCase()); return name;
  });
}


async function* archiveChunks(files: Attachment[], signal?: AbortSignal) {
  const names = providedArchiveNames(files);
  const pending: Uint8Array[] = [];
  let failure: Error | null = null;
  const zip = new Zip((error, data) => { if (error) failure = error; else pending.push(data); });
  try {
    const folders = new Set<string>();
    for (const file of files) {
      const values = metadata(file.metadata).providedFolders;
      if (values === undefined) continue;
      if (!Array.isArray(values) || values.length > 1000) throw new AppError(409, "HOMEWORK_PROVIDED_PATH_INVALID", "The provided folders are invalid.");
      for (const value of values) folders.add(savedPath(value));
      if (folders.size > 1000) throw new AppError(413, "HOMEWORK_PROVIDED_FILES_LIMIT", "Too many provided folders.");
    }
    for (const folder of folders) {
      signal?.throwIfAborted();
      const entry = new ZipPassThrough(`${folder}/`); zip.add(entry); entry.push(new Uint8Array(), true);
      if (failure) throw failure;
      while (pending.length) yield pending.shift()!;
    }
    for (const [index, file] of files.entries()) {
      signal?.throwIfAborted();
      const entry = new ZipPassThrough(names[index]); zip.add(entry);
      while (pending.length) yield pending.shift()!;
      for await (const chunk of readProvidedAttachmentChunks(file, signal)) {
        entry.push(chunk); if (failure) throw failure;
        while (pending.length) yield pending.shift()!;
      }
      entry.push(new Uint8Array(), true); if (failure) throw failure;
      while (pending.length) yield pending.shift()!;
    }
    zip.end(); if (failure) throw failure;
    while (pending.length) yield pending.shift()!;
  } finally { zip.terminate(); }
}

export async function downloadHomeworkProvidedFiles(owner: Owner, signal?: AbortSignal) {
  const files = await prisma.pluginCodingHomeworkAttachment.findMany({ where: { ...owner, kind: "provided_file" }, orderBy: [{ createdAt: "asc" }, { id: "asc" }], take: MAX_FILES + 1 });
  if (!files.length) throw new AppError(404, "HOMEWORK_PROVIDED_FILES_MISSING", "No provided files are available for this activity.");
  if (files.length > MAX_FILES || files.some(file => file.sizeBytes < 0n || file.sizeBytes > BigInt(MAX_FILE_BYTES)) || files.reduce((sum, file) => sum + file.sizeBytes, 0n) > BigInt(MAX_TOTAL_BYTES)) throw new AppError(413, "HOMEWORK_PROVIDED_FILES_LIMIT", "The provided files exceed the combined download limit. Ask your teacher to reduce or package the files.");
  const alreadyZip = files.length === 1 && metadata(files[0].metadata).providedPath === undefined && (/\.zip$/i.test(files[0].originalName) || ["application/zip", "application/x-zip-compressed"].includes(files[0].mimeType ?? ""));
  const fileName = alreadyZip ? providedArchiveNames(files)[0] : "provided-files.zip";
  const stream = Readable.toWeb(Readable.from(alreadyZip ? readProvidedAttachmentChunks(files[0], signal) : archiveChunks(files, signal), { objectMode: false })) as ReadableStream;
  return new Response(stream, { headers: { "Content-Type": "application/zip", "Content-Disposition": `attachment; filename="${encodeURIComponent(fileName)}"; filename*=UTF-8''${encodeURIComponent(fileName)}`, "Cache-Control": "private, no-store, max-age=0", "X-Content-Type-Options": "nosniff" } });
}
