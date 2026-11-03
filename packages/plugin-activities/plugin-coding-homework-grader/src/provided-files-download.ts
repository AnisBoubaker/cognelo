import { constants } from "node:fs";
import { open } from "node:fs/promises";
import { Readable } from "node:stream";
import { createHash } from "node:crypto";
import { Zip, ZipPassThrough } from "fflate";
import { AppError } from "@cognelo/core";
import { prisma } from "./db-client";
import { codingHomeworkAttachmentPath } from "./authoring";

const MAX_FILES = 1000;
const MAX_FILE_BYTES = 25 * 1024 * 1024;
const MAX_TOTAL_BYTES = 256 * 1024 * 1024;
type Owner = { ownerKind: "course_activity" | "bank_activity"; ownerId: string };
type Attachment = { storedName: string; originalName: string; sizeBytes: bigint; sha256: string; mimeType: string | null };

export function providedArchiveNames(files: Array<{ originalName: string }>) {
  const used = new Set<string>();
  return files.map(file => {
    const base = file.originalName.replace(/\\/g, "/").split("/").at(-1)?.normalize("NFC").replace(/[\x00-\x1f\x7f]/g, "").replace(/[<>:"|?*]/g, "_").trim();
    const safe = !base || base === "." || base === ".." ? "provided-file" : base;
    const split = safe.lastIndexOf(".");
    const stem = split > 0 ? safe.slice(0, split) : safe, extension = split > 0 ? safe.slice(split) : "";
    let name = safe, number = 2;
    while (used.has(name.toLowerCase())) name = `${stem} (${number++})${extension}`;
    used.add(name.toLowerCase()); return name;
  });
}

async function* attachmentChunks(attachment: Attachment, signal?: AbortSignal) {
  signal?.throwIfAborted();
  const file = await open(codingHomeworkAttachmentPath(attachment.storedName), constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const stat = await file.stat();
    if (!stat.isFile() || stat.size > MAX_FILE_BYTES || BigInt(stat.size) !== attachment.sizeBytes) throw new AppError(409, "HOMEWORK_PROVIDED_FILE_CHANGED", "A provided file is unavailable or changed. Ask your teacher to upload it again.");
    const hash = createHash("sha256");
    const buffer = Buffer.alloc(64 * 1024);
    let position = 0;
    while (position < stat.size) {
      signal?.throwIfAborted();
      const { bytesRead } = await file.read(buffer, 0, Math.min(buffer.length, stat.size - position), position);
      if (!bytesRead) throw new AppError(409, "HOMEWORK_PROVIDED_FILE_CHANGED", "A provided file could not be read completely.");
      const chunk = Buffer.from(buffer.subarray(0, bytesRead)); position += bytesRead; hash.update(chunk); yield chunk;
    }
    if (hash.digest("hex") !== attachment.sha256) throw new AppError(409, "HOMEWORK_PROVIDED_FILE_CHANGED", "A provided file failed its integrity check.");
  } finally { await file.close(); }
}

async function* archiveChunks(files: Attachment[], signal?: AbortSignal) {
  const names = providedArchiveNames(files);
  const pending: Uint8Array[] = [];
  let failure: Error | null = null;
  const zip = new Zip((error, data) => { if (error) failure = error; else pending.push(data); });
  try {
    for (const [index, file] of files.entries()) {
      signal?.throwIfAborted();
      const entry = new ZipPassThrough(names[index]); zip.add(entry);
      while (pending.length) yield pending.shift()!;
      for await (const chunk of attachmentChunks(file, signal)) {
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
  const alreadyZip = files.length === 1 && (/\.zip$/i.test(files[0].originalName) || ["application/zip", "application/x-zip-compressed"].includes(files[0].mimeType ?? ""));
  const fileName = alreadyZip ? providedArchiveNames(files)[0] : "provided-files.zip";
  const stream = Readable.toWeb(Readable.from(alreadyZip ? attachmentChunks(files[0], signal) : archiveChunks(files, signal), { objectMode: false })) as ReadableStream;
  return new Response(stream, { headers: { "Content-Type": "application/zip", "Content-Disposition": `attachment; filename="${encodeURIComponent(fileName)}"; filename*=UTF-8''${encodeURIComponent(fileName)}`, "Cache-Control": "private, no-store, max-age=0", "X-Content-Type-Options": "nosniff" } });
}
