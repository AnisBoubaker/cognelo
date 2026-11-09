import { acceptHomeworkStageTiming } from "./submission-window";
import { lockHomeworkSettings } from "./workflow-settings";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { AppError, activityTeamworkEnabled, getGroupAssignedActivity, openStoredMaterial } from "@cognelo/core";
import type { CurrentUser } from "@cognelo/contracts";
import { prisma, type Prisma } from "./db-client";
import { acquireHomeworkUploadSlot, limitHomeworkUploads, lockHomeworkUploadBudget, type UploadTransaction } from "./upload-budget";
import { normalizeCodingHomeworkSubmissionRequirements, validateCodingHomeworkArchive, codingHomeworkSubmissionReadiness } from "./validation";
import { readCodingHomeworkZip, type CodingHomeworkZipEntry } from "./zip";

export type HomeworkStudentScope = { user: CurrentUser; courseId: string; groupId: string; activityId: string };
export type PreparedHomeworkFile = { path: string; storedName: string; sizeBytes: number; sha256: string };
export const homeworkUploadSchema = z.object({
  kind: z.enum(["file", "zip", "folder"]), fileName: z.string().max(240).optional(), base64: z.string().optional(),
  path: z.string().max(500).optional(), contextKey: z.string().max(200).optional(), expectedRevision: z.number().int().min(0), replace: z.boolean().default(false)
}).strict();
export const record = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
export const json = (value: unknown) => JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
export const homeworkStorageRoot = () => path.resolve(process.cwd(), "../../storage/coding-homework-grader");

export function normalizeHomeworkPath(value: string) {
  const normalized = value.replace(/\\/g, "/");
  if (!normalized || normalized.length > 500 || normalized.startsWith("/") || /^[A-Za-z]:/.test(normalized)
    || /[\x00-\x1f\x7f]/.test(normalized) || normalized.split("/").some(part => !part || part === "." || part === "..")) {
    throw new AppError(400, "HOMEWORK_FILE_PATH_INVALID", "Choose a relative file or folder path without parent-directory segments.");
  }
  return normalized;
}
export function decodeHomeworkUpload(base64: string, maxBytes: number) {
  if (base64.length > Math.ceil(maxBytes / 3) * 4 + 4 || !/^[A-Za-z0-9+/]*={0,2}$/.test(base64)) throw new AppError(413, "HOMEWORK_UPLOAD_INVALID", "The upload is invalid or exceeds its size limit.");
  const bytes = Buffer.from(base64, "base64");
  if (bytes.length > maxBytes) throw new AppError(413, "HOMEWORK_UPLOAD_TOO_LARGE", "The file exceeds its size limit.");
  return bytes;
}
export async function assertHomeworkStudentScope(scope: HomeworkStudentScope) {
  const activity = await getGroupAssignedActivity(scope.user, scope.courseId, scope.groupId, scope.activityId);
  if (activity.activityType.key !== "coding-homework-grader") throw new AppError(404, "HOMEWORK_NOT_FOUND", "Programming Homework was not found.");
  const now = Date.now();
  if (activity.assignment.availableFrom && now < activity.assignment.availableFrom.getTime()
    || activity.assignment.availableUntil && now >= activity.assignment.availableUntil.getTime()) throw new AppError(403, "GROUP_ACTIVITY_NOT_AVAILABLE", "This activity is not currently available.");
  return activity;
}
export async function lockHomeworkWorkflow(tx: UploadTransaction, scope: Pick<HomeworkStudentScope, "activityId" | "groupId" | "user">) {
  await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtextextended(${JSON.stringify(["homework-workflow", scope.activityId, scope.groupId, scope.user.id])}, 0))`;
}
export async function assertHomeworkDraftWritable(tx: Prisma.TransactionClient, scope: HomeworkStudentScope) {
  const latest = await tx.pluginCodingHomeworkSubmission.findFirst({ where: { activityId: scope.activityId, groupId: scope.groupId, userId: scope.user.id, kind: "final" }, orderBy: { createdAt: "desc" } });
  if (latest && latest.status !== "cancelled" && !record(latest.metadata).deletion && latest.status !== "invalid_structure") {
    throw new AppError(409, "HOMEWORK_FILES_FROZEN", "Your work is already submitted. Only your teacher can permit another submission.");
  }
}
export function draftFiles(value: unknown): PreparedHomeworkFile[] { return Array.isArray(value) ? value as PreparedHomeworkFile[] : []; }
export function draftFilePath(draftId: string, storedName: string) {
  if (!/^[a-zA-Z0-9-]+$/.test(draftId) || !/^[a-f0-9-]+$/.test(storedName)) throw new AppError(400, "HOMEWORK_FILE_INVALID", "Invalid stored file reference.");
  return path.join(homeworkStorageRoot(), "drafts", draftId, storedName);
}
export async function readHomeworkDraftEntries(draft: { id: string; files: unknown; folders: unknown }) {
  const entries: CodingHomeworkZipEntry[] = [];
  for (const folder of Array.isArray(draft.folders) ? draft.folders : []) if (typeof folder === "string") entries.push({ path: folder, isDirectory: true, content: null, compressedSize: 0, uncompressedSize: 0 });
  for (const file of draftFiles(draft.files)) {
    const content = await readPreparedBytes(draft.id, file);
    if (content.length !== file.sizeBytes || createHash("sha256").update(content).digest("hex") !== file.sha256) throw new AppError(409, "HOMEWORK_FILE_CHANGED", "A saved file could not be verified. Upload it again.");
    entries.push({ path: file.path, isDirectory: false, content, compressedSize: content.length, uncompressedSize: content.length });
  }
  return entries;
}
export async function getHomeworkRequirements(activityId: string) {
  const value = await prisma.pluginCodingHomeworkSubmissionRequirementSet.findUnique({ where: { activityId } });
  return normalizeCodingHomeworkSubmissionRequirements(value?.requirements);
}
export async function getHomeworkPreparation(scope: HomeworkStudentScope) {
  const activity = await assertHomeworkStudentScope(scope);
  if (activityTeamworkEnabled(activity.metadata)) return (await import("./team-preparation")).getTeamHomeworkPreparation(scope);
  const draft = await prisma.pluginCodingHomeworkDraft.findUnique({ where: { activityId_groupId_userId: { activityId: scope.activityId, groupId: scope.groupId, userId: scope.user.id } } });
  const entries = draft ? await readHomeworkDraftEntries(draft) : [];
  const requirements = await getHomeworkRequirements(scope.activityId);
  const validation = await validateCodingHomeworkArchive({ entries, requirements, archiveSizeBytes: entries.reduce((sum, file) => sum + file.uncompressedSize, 0) });
  return { draft: { revision: draft?.revision ?? 0, files: draftFiles(draft?.files).map(({ storedName: _storedName, ...file }) => file), folders: draft?.folders ?? [] },
    validation, readiness: codingHomeworkSubmissionReadiness(validation), requirements };
}
export async function uploadHomeworkPreparation(scope: HomeworkStudentScope, input: unknown) {
  const activity = await assertHomeworkStudentScope(scope);
  if (activityTeamworkEnabled(activity.metadata)) return (await import("./team-preparation")).uploadTeamHomeworkPreparation(scope, input);
  const data = homeworkUploadSchema.parse(input);
  await limitHomeworkUploads(scope.activityId, scope.user.id);
  const release = acquireHomeworkUploadSlot();
  const written: string[] = [];
  let committed = false;
  const obsolete: string[] = [];
  try {
    if (data.kind !== "folder" && typeof data.base64 !== "string") throw new AppError(400, "HOMEWORK_UPLOAD_REQUIRED", "Upload a file.");
    const requirements = await getHomeworkRequirements(scope.activityId);
    const bytes = data.kind === "folder" ? null : decodeHomeworkUpload(data.base64 ?? "", Math.min(requirements.maxArchiveBytes, data.kind === "file" ? 8 * 1024 * 1024 : 25 * 1024 * 1024));
    const zip = data.kind === "zip" ? readCodingHomeworkZip(bytes!, requirements) : null;
    if (zip?.diagnostics.some(issue => issue.severity === "error")) throw new AppError(400, "HOMEWORK_ZIP_INVALID", "The ZIP could not be safely read.", { issues: zip.diagnostics });
    const incoming = zip ? zip.entries : [{ path: normalizeHomeworkPath(data.path ?? data.fileName ?? ""), isDirectory: data.kind === "folder", content: bytes,
      compressedSize: bytes?.length ?? 0, uncompressedSize: bytes?.length ?? 0 }];
    await prisma.$transaction(async tx => {
      await lockHomeworkSettings(tx, scope.activityId);
      await acceptHomeworkStageTiming(scope);
      await lockHomeworkWorkflow(tx, scope);
      await lockHomeworkUploadBudget(tx, scope.activityId, scope.user.id, incoming.reduce((sum, file) => sum + file.uncompressedSize, 0));
      await assertHomeworkDraftWritable(tx, scope);
      const draft = await tx.pluginCodingHomeworkDraft.upsert({ where: { activityId_groupId_userId: { activityId: scope.activityId, groupId: scope.groupId, userId: scope.user.id } },
        create: { activityId: scope.activityId, groupId: scope.groupId, userId: scope.user.id }, update: {} });
      await acceptHomeworkStageTiming(scope, draft.preparationStartedAt);
      if (draft.revision !== data.expectedRevision) throw new AppError(409, "HOMEWORK_DRAFT_CONFLICT", "Your prepared files changed. Reload them before uploading.");
      const next = await applyHomeworkPreparedUpload(draft, data, incoming, requirements, written);
      const preparedAt = (await acceptHomeworkStageTiming(scope, draft.preparationStartedAt)).submittedAt;
      await tx.pluginCodingHomeworkDraft.update({ where: { id: draft.id }, data: { preparationStartedAt: draft.preparationStartedAt ?? new Date(preparedAt), updatedAt: new Date(preparedAt), files: json(next.files), folders: json(next.folders), revision: { increment: 1 } } });
      obsolete.push(...next.obsolete);
    }, { timeout: 30_000, maxWait: 30_000 });
    committed = true;
    await Promise.all(obsolete.map(file => unlink(file).catch(() => {})));
    return getHomeworkPreparation(scope);
  } catch (error) { if (!committed) await Promise.all(written.map(file => unlink(file).catch(() => {}))); throw error; }
  finally { release(); }
}
export async function removeHomeworkPreparedFile(scope: HomeworkStudentScope, input: unknown) {
  const activity = await assertHomeworkStudentScope(scope);
  if (activityTeamworkEnabled(activity.metadata)) return (await import("./team-preparation")).removeTeamHomeworkPreparedFile(scope, input);
  const data = z.union([
    z.object({ path: z.string().min(1).max(500), expectedRevision: z.number().int().min(0) }).strict(),
    z.object({ all: z.literal(true), expectedRevision: z.number().int().min(0) }).strict()
  ]).parse(input);
  const removed = await prisma.$transaction(async tx => {
    await lockHomeworkSettings(tx, scope.activityId);
    await acceptHomeworkStageTiming(scope);
    await lockHomeworkWorkflow(tx, scope); await assertHomeworkDraftWritable(tx, scope);
    const draft = await tx.pluginCodingHomeworkDraft.findUnique({ where: { activityId_groupId_userId: { activityId: scope.activityId, groupId: scope.groupId, userId: scope.user.id } } });
    if (!draft || draft.revision !== data.expectedRevision) throw new AppError(409, "HOMEWORK_DRAFT_CONFLICT", "Your prepared files changed. Reload them first.");
    const files = draftFiles(draft.files);
    const clearAll = "all" in data;
    const targets = clearAll ? files : files.filter(file => file.path === data.path);
    const removedPaths = targets.map(file => draftFilePath(draft.id, file.storedName));
    const preparedAt = (await acceptHomeworkStageTiming(scope, draft.preparationStartedAt)).submittedAt;
    await tx.pluginCodingHomeworkDraft.update({ where: { id: draft.id }, data: { updatedAt: new Date(preparedAt), files: json(clearAll ? [] : files.filter(file => file.path !== data.path)),
      ...(clearAll ? { folders: json([]) } : {}), revision: { increment: 1 } } });
    return removedPaths;
  });
  await Promise.all(removed.map(file => unlink(file).catch(() => {})));
  return getHomeworkPreparation(scope);
}
export async function getHomeworkPreparedFile(scope: HomeworkStudentScope, filePath: string) {
  const activity = await assertHomeworkStudentScope(scope);
  if (activityTeamworkEnabled(activity.metadata)) return (await import("./team-preparation")).getTeamHomeworkPreparedFile(scope, filePath);
  const draft = await prisma.pluginCodingHomeworkDraft.findUnique({ where: { activityId_groupId_userId: { activityId: scope.activityId, groupId: scope.groupId, userId: scope.user.id } } });
  const file = draftFiles(draft?.files).find(file => file.path === normalizeHomeworkPath(filePath));
  if (!draft || !file) throw new AppError(404, "HOMEWORK_FILE_NOT_FOUND", "The file was not found.");
  const bytes = await readPreparedBytes(draft.id, file);
  return { path: file.path, text: bytes.toString("utf8").slice(0, 2_000_000), truncated: bytes.length > 2_000_000 };
}

export async function readPreparedBytes(draftId: string, file: PreparedHomeworkFile) {
  draftFilePath(draftId, file.storedName);
  const handle = await openStoredMaterial(path.join(homeworkStorageRoot(), "drafts"), [draftId], file.storedName);
  try {
    const stat = await handle.stat();
    if (stat.size > 8 * 1024 * 1024 || stat.size !== file.sizeBytes) throw new AppError(409, "HOMEWORK_FILE_CHANGED", "A saved file could not be verified. Upload it again.");
    return await handle.readFile();
  } finally { await handle.close(); }
}


export async function applyHomeworkPreparedUpload(
  draft: { id: string; files: unknown; folders: unknown },
  data: Pick<z.infer<typeof homeworkUploadSchema>, "kind" | "replace">,
  incoming: CodingHomeworkZipEntry[], requirements: Awaited<ReturnType<typeof getHomeworkRequirements>>, written: string[]
) {
  const previous = draftFiles(draft.files);
  if (!data.replace && (data.kind === "zip" ? previous.length > 0 : previous.some(file => incoming.some(next => next.path === file.path)))) {
    throw new AppError(409, "HOMEWORK_REPLACE_CONFIRMATION_REQUIRED", "Confirm replacement of existing prepared files.");
  }
  let next = data.kind === "zip" ? [] : [...previous];
  let folders = data.kind === "zip" ? [] : (Array.isArray(draft.folders) ? draft.folders.filter((folder): folder is string => typeof folder === "string") : []);
  for (const entry of incoming) {
    const entryPath = normalizeHomeworkPath(entry.path);
    if (entry.isDirectory) { folders.push(entryPath); continue; }
    if (!entry.content) continue;
    if (requirements.ignoredPaths.some(ignored => entryPath === ignored || entryPath.startsWith(`${ignored}/`))) continue;
    const sha256 = createHash("sha256").update(entry.content).digest("hex");
    const storedName = `${randomUUID()}-${sha256}`;
    const filename = draftFilePath(draft.id, storedName);
    await mkdir(path.dirname(filename), { recursive: true, mode: 0o750 });
    await writeFile(filename, entry.content, { mode: 0o640, flag: "wx" }); written.push(filename);
    next = [...next.filter(file => file.path !== entryPath), { path: entryPath, storedName, sha256, sizeBytes: entry.content.length }];
    const segments = entryPath.split("/"); for (let i = 1; i < segments.length; i++) folders.push(segments.slice(0, i).join("/"));
  }
  next.sort((a, b) => a.path.localeCompare(b.path)); folders = [...new Set(folders)].sort();
  if (next.length > requirements.maxFileCount || folders.length > 1000 || next.reduce((sum, file) => sum + file.sizeBytes, 0) > requirements.maxArchiveBytes) throw new AppError(413, "HOMEWORK_COLLECTION_LIMIT", "The prepared collection exceeds the configured file-count or size limit.");
  const testEntries = await readHomeworkDraftEntries({ ...draft, files: next, folders });
  const report = await validateCodingHomeworkArchive({ entries: testEntries, requirements, archiveSizeBytes: next.reduce((sum, file) => sum + file.sizeBytes, 0) });
  if (codingHomeworkSubmissionReadiness(report).blocking.length) throw new AppError(400, "HOMEWORK_FILES_INVALID", "The uploaded files violate the file requirements or safety limits.", { issues: codingHomeworkSubmissionReadiness(report).blocking });
  const changes: Array<{ operation: string; path: string; previousHash?: string; nextHash?: string }> = [];
  for (const file of next) {
    const old = previous.find(value => value.path === file.path);
    if (!old || old.storedName !== file.storedName) changes.push({ operation: old ? "file_replaced" : "file_added", path: file.path, previousHash: old?.sha256, nextHash: file.sha256 });
  }
  for (const old of previous) if (!next.some(value => value.path === old.path)) changes.push({ operation: "file_deleted", path: old.path, previousHash: old.sha256 });
  return { files: next, folders, changes, obsolete: previous.filter(file => !next.some(value => value.storedName === file.storedName)).map(file => draftFilePath(draft.id, file.storedName)) };
}
