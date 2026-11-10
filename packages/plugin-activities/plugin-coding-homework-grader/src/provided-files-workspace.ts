import { createHash, randomUUID } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { AppError } from "@cognelo/core";
import { prisma, type Prisma } from "./db-client";
import { codingHomeworkAttachmentPath, readProvidedAttachmentChunks } from "./attachment-storage";
import { codingHomeworkFileUploadInputSchema } from "./authoring";
import { lockHomeworkSettings } from "./workflow-settings";
import { lockHomeworkTeacherSolution } from "./teacher-solution";
import { providedArchiveNames } from "./provided-files-download";
import { readCodingHomeworkZip } from "./zip";
import { decodeHomeworkUpload, normalizeHomeworkPath } from "./file-preparation";

type Owner = { ownerKind: "course_activity" | "bank_activity"; ownerId: string };
type Database = Pick<Prisma.TransactionClient, "pluginCodingHomeworkAttachment">;
type Entry = { path: string; bytes: Buffer; directory: boolean; attachmentId?: string; metadata?: Prisma.InputJsonObject };
const MAX_ARCHIVE = 25 * 1024 * 1024;
const MAX_EXPANDED = 64 * 1024 * 1024;
const revisionSchema = z.string().regex(/^[a-f0-9]{64}$/);
const uploadSchema = z.object({
  expectedRevision: revisionSchema,
  replaceAll: z.boolean().default(false),
  files: z.array(codingHomeworkFileUploadInputSchema.extend({ base64: z.string().max(Math.ceil(MAX_ARCHIVE / 3) * 4) })).min(1).max(1000)
});
const deleteSchema = z.object({ expectedRevision: revisionSchema, path: z.string().min(1).max(500).optional(), all: z.boolean().optional() })
  .refine(value => value.all === true || Boolean(value.path));

function fail(message: string, status = 400): never { throw new AppError(status, "HOMEWORK_PROVIDED_FILES_INVALID", message); }
function ignored(name: string) { return name.split("/").some(part => part === "__MACOSX" || part === ".DS_Store" || part.startsWith("._")); }
function isZip(name: string, mimeType?: string | null) { return /\.zip$/i.test(name) || ["application/zip", "application/x-zip-compressed"].includes(mimeType ?? ""); }
function archiveEntries(bytes: Buffer): Entry[] {
  const archive = readCodingHomeworkZip(bytes);
  const error = archive.diagnostics.find(issue => issue.severity === "error");
  if (error) fail(error.message);
  return archive.entries.filter(entry => !ignored(entry.path)).map(entry => ({ path: entry.path, bytes: entry.content ?? Buffer.alloc(0), directory: entry.isDirectory }));
}
function checkEntries(entries: Entry[]) {
  if (entries.length > 1000 || entries.reduce((sum, entry) => sum + entry.bytes.length, 0) > MAX_EXPANDED) fail("The provided files exceed the file-count or expanded-size limit.", 413);
  const files = new Set(entries.filter(entry => !entry.directory).map(entry => entry.path.toLowerCase()));
  for (const entry of entries) {
    const parts = entry.path.split("/");
    if (entry.directory && files.has(entry.path.toLowerCase())) fail("A provided file conflicts with a folder at the same path.");
    for (let index = 1; index < parts.length; index++) if (files.has(parts.slice(0, index).join("/").toLowerCase())) fail("A provided file conflicts with a folder at the same path.");
  }
}
function projection(workspace: { revision: string; entries: Entry[] }) {
  return { revision: workspace.revision, files: workspace.entries.filter(entry => !entry.directory).map(entry => ({ path: entry.path, sizeBytes: entry.bytes.length })).sort((a, b) => a.path.localeCompare(b.path, "en", { numeric: true })) };
}

async function readWorkspace(owner: Owner, database: Database = prisma, signal?: AbortSignal) {
  signal?.throwIfAborted();
  const attachments = await database.pluginCodingHomeworkAttachment.findMany({ where: { ...owner, kind: "provided_file" }, orderBy: [{ createdAt: "asc" }, { id: "asc" }], take: 1001 });
  if (attachments.length > 1000 || attachments.reduce((sum, file) => sum + file.sizeBytes, 0n) > 256n * 1024n * 1024n) fail("The provided files exceed the collection limit.", 413);
  const revision = createHash("sha256").update(JSON.stringify(attachments.map(file => [file.id, file.sha256, file.originalName, file.mimeType]))).digest("hex");
  const entries: Entry[] = [];
  const used = new Set<string>();
  const names = providedArchiveNames(attachments);
  for (const [index, attachment] of attachments.entries()) {
    const chunks: Buffer[] = [];
    for await (const chunk of readProvidedAttachmentChunks(attachment, signal)) chunks.push(chunk);
    const bytes = Buffer.concat(chunks);
    const metadata = attachment.metadata as Record<string, unknown>;
    const savedPath = typeof metadata?.providedPath === "string" ? normalizeHomeworkPath(metadata.providedPath) : names[index];
    const folders = Array.isArray(metadata?.providedFolders) ? z.array(z.string()).max(1000).parse(metadata.providedFolders).map(normalizeHomeworkPath) : [];
    const members: Entry[] = metadata?.providedPath === undefined && isZip(attachment.originalName, attachment.mimeType) ? archiveEntries(bytes) : [{ path: savedPath, bytes, directory: false, attachmentId: attachment.id, metadata: metadata as Prisma.InputJsonObject }];
    for (const entry of [...folders.map(folder => ({ path: folder, bytes: Buffer.alloc(0), directory: true })), ...members]) {
      // Legacy attachments may repeat names. Preserve each file with a stable suffix.
      const slash = entry.path.lastIndexOf("/"), dot = entry.path.lastIndexOf(".");
      const split = dot > slash + 1 ? dot : entry.path.length;
      let name = entry.path, number = 2;
      if (entry.directory && used.has(name.toLowerCase())) continue;
      while (used.has(name.toLowerCase())) name = `${entry.path.slice(0, split)} (${number++})${entry.path.slice(split)}`;
      used.add(name.toLowerCase()); entries.push({ ...entry, path: name });
    }
    checkEntries(entries);
  }
  return { revision, entries };
}

export async function getHomeworkProvidedFiles(owner: Owner, signal?: AbortSignal) {
  return projection(await readWorkspace(owner, prisma, signal));
}

export async function getHomeworkProvidedFile(owner: Owner, input: { path: string; revision: string }, signal?: AbortSignal) {
  const workspace = await readWorkspace(owner, prisma, signal);
  assertRevision(workspace.revision, input.revision);
  const entry = workspace.entries.find(entry => !entry.directory && entry.path === input.path);
  if (!entry) throw new AppError(404, "HOMEWORK_PROVIDED_FILE_MISSING", "The provided file was not found.");
  let text: string;
  try {
    const encoding = entry.bytes[0] === 0xff && entry.bytes[1] === 0xfe ? "utf-16le" : entry.bytes[0] === 0xfe && entry.bytes[1] === 0xff ? "utf-16be" : "utf-8";
    text = new TextDecoder(encoding, { fatal: true }).decode(entry.bytes);
    if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(text)) throw new Error("binary");
  } catch { return { path: entry.path, text: "", previewUnavailable: true }; }
  return { path: entry.path, text: text.slice(0, 2_000_000), previewUnavailable: false };
}

function assertRevision(actual: string, expected: string) {
  if (actual !== expected) throw new AppError(409, "HOMEWORK_PROVIDED_FILES_CHANGED", "The provided files changed. Refresh before trying again.");
}

async function changeWorkspace(owner: Owner, expectedRevision: string, change: (entries: Entry[]) => Entry[], signal?: AbortSignal) {
  const written: string[] = [];
  let committed = false;
  try {
    const result = await prisma.$transaction(async transaction => {
      if (owner.ownerKind === "course_activity") await lockHomeworkSettings(transaction, owner.ownerId);
      else await lockHomeworkTeacherSolution(transaction, owner);
      const current = await readWorkspace(owner, transaction, signal);
      assertRevision(current.revision, expectedRevision);
      const entries = change(current.entries);
      checkEntries(entries);
      signal?.throwIfAborted();
      const files = entries.filter(entry => !entry.directory);
      const retained = files.flatMap(entry => entry.attachmentId ? [entry.attachmentId] : []);
      await transaction.pluginCodingHomeworkAttachment.deleteMany({ where: { ...owner, kind: "provided_file", id: { notIn: retained } } });
      const folders = entries.filter(entry => entry.directory).map(entry => entry.path);
      for (const [index, entry] of files.entries()) {
        signal?.throwIfAborted();
        const metadata = { ...entry.metadata, providedPath: entry.path, providedFolders: index === 0 ? folders : [] };
        if (entry.attachmentId) {
          await transaction.pluginCodingHomeworkAttachment.update({ where: { id: entry.attachmentId }, data: { metadata } });
          continue;
        }
        const storedName = `${randomUUID()}-provided-file`;
        const destination = codingHomeworkAttachmentPath(storedName);
        await mkdir(path.dirname(destination), { recursive: true });
        written.push(destination);
        await writeFile(destination, entry.bytes, { flag: "wx" });
        await transaction.pluginCodingHomeworkAttachment.create({ data: { ...owner, kind: "provided_file", originalName: entry.path, storedName, mimeType: "application/octet-stream", sizeBytes: BigInt(entry.bytes.length), sha256: createHash("sha256").update(entry.bytes).digest("hex"), metadata } });
      }
      signal?.throwIfAborted();
      return projection(await readWorkspace(owner, transaction, signal));
    }, { timeout: 30_000 });
    committed = true;
    return result;
  } finally { if (!committed) await Promise.all(written.map(file => rm(file, { force: true }).catch(() => undefined))); }
}

export async function uploadHomeworkProvidedFiles(owner: Owner, input: unknown, signal?: AbortSignal) {
  const parsed = uploadSchema.parse(input);
  const hasZip = parsed.files.some(file => isZip(file.fileName, file.mimeType));
  if (hasZip && (parsed.files.length !== 1 || !parsed.replaceAll)) fail("Upload one ZIP to replace the provided files, or select individual files.");
  let total = 0;
  const incoming = parsed.files.flatMap(file => {
    const bytes = decodeHomeworkUpload(file.base64, MAX_ARCHIVE); total += bytes.length;
    if (total > MAX_ARCHIVE) fail("The upload exceeds the 25 MB upload limit.", 413);
    if (hasZip) return archiveEntries(bytes);
    if (/[\\/\x00-\x1f\x7f]/.test(file.fileName) || [".", ".."].includes(file.fileName)) fail("Choose files with safe filenames.");
    if (bytes.length > 8 * 1024 * 1024) fail("An individual provided file exceeds the 8 MB limit.", 413);
    return [{ path: file.fileName.normalize("NFC"), bytes, directory: false }];
  });
  if (!incoming.some(entry => !entry.directory)) fail("The upload contains no provided files.");
  const names = incoming.map(entry => entry.path.toLowerCase());
  if (new Set(names).size !== names.length) fail("Select only one file for each path.");
  return changeWorkspace(owner, parsed.expectedRevision, entries => parsed.replaceAll ? incoming : [...entries.filter(entry => !names.includes(entry.path.toLowerCase())), ...incoming], signal);
}

export async function deleteHomeworkProvidedFiles(owner: Owner, input: unknown, signal?: AbortSignal) {
  const parsed = deleteSchema.parse(input);
  return changeWorkspace(owner, parsed.expectedRevision, entries => {
    if (parsed.all) return [];
    if (!entries.some(entry => !entry.directory && entry.path === parsed.path)) throw new AppError(404, "HOMEWORK_PROVIDED_FILE_MISSING", "The provided file was not found.");
    return entries.filter(entry => entry.path !== parsed.path);
  }, signal);
}
