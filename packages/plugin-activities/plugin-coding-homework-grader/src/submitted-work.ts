import { createHash } from "node:crypto";
import { Readable } from "node:stream";
import path from "node:path";
import { Zip, ZipPassThrough } from "fflate";
import { AppError, activityTeamworkEnabled, openStoredMaterial } from "@cognelo/core";
import { prisma } from "./db-client";
import { assertHomeworkStudentScope, getHomeworkRequirements, homeworkStorageRoot, normalizeHomeworkPath, record, type HomeworkStudentScope } from "./file-preparation";
import { normalizeCodingHomeworkSubmissionRequirements, validateCodingHomeworkArchive, codingHomeworkSubmissionReadiness } from "./validation";
import { readFrozenHomeworkFile } from "./hand-in";
import { assertCurrentTeamSubmissionAccess, getCurrentTeamHomeworkSubmission } from "./team-submissions";

async function frozenWork(scope: HomeworkStudentScope, expectedId?: string | null) {
  const activity = await assertHomeworkStudentScope(scope);
  const submission = activityTeamworkEnabled(activity.metadata) ? await getCurrentTeamHomeworkSubmission(scope)
    : await prisma.pluginCodingHomeworkSubmission.findFirst({ where: { activityId: scope.activityId, groupId: scope.groupId, userId: scope.user.id, kind: "final" }, orderBy: { createdAt: "desc" } });
  if (!submission || submission.status === "cancelled" || record(submission.metadata).deletion || (expectedId && submission.id !== expectedId)) throw new AppError(404, "HOMEWORK_NOT_SUBMITTED", "No current submitted work is available in your workspace.");
  const files = await prisma.pluginCodingHomeworkSubmissionFile.findMany({ where: { submissionId: submission.id }, orderBy: { path: "asc" } });
  if (files.length > 1000 || files.reduce((sum, file) => sum + file.sizeBytes, 0n) > 25n * 1024n * 1024n) throw new AppError(413, "HOMEWORK_COLLECTION_LIMIT", "The submitted collection exceeds its read limit.");
  const metadata = record(submission.metadata);
  const folders = new Set<string>();
  for (const folder of Array.isArray(metadata.folders) ? metadata.folders : []) if (typeof folder === "string") folders.add(normalizeHomeworkPath(folder));
  for (const file of files) { const parts = normalizeHomeworkPath(file.path).split("/"); for (let i = 1; i < parts.length; i++) folders.add(parts.slice(0, i).join("/")); }
  if (folders.size > 1000) throw new AppError(413, "HOMEWORK_COLLECTION_LIMIT", "The submitted collection contains too many folders.");
  return { submission, files, folders: [...folders].sort() };
}
async function* fileChunks(file: { storedName: string; sizeBytes: bigint; sha256: string }, signal?: AbortSignal) {
  const segments = file.storedName.split("/");
  if (segments.length < 2 || segments.some(segment => !/^[a-zA-Z0-9._-]+$/.test(segment) || segment === "." || segment === "..")) throw new AppError(409, "HOMEWORK_FILE_INVALID", "Invalid stored file reference.");
  const handle = await openStoredMaterial(path.join(homeworkStorageRoot(), "submissions"), segments.slice(0, -1), segments.at(-1)!);
  try {
    const stat = await handle.stat();
    if (stat.size > 8 * 1024 * 1024 || BigInt(stat.size) !== file.sizeBytes) throw new AppError(409, "HOMEWORK_FILE_CHANGED", "The submitted file could not be verified.");
    const hash = createHash("sha256"), buffer = Buffer.alloc(64 * 1024); let position = 0;
    while (position < stat.size) {
      signal?.throwIfAborted();
      const { bytesRead } = await handle.read(buffer, 0, Math.min(buffer.length, stat.size - position), position);
      if (!bytesRead) throw new AppError(409, "HOMEWORK_FILE_CHANGED", "The submitted file could not be read completely.");
      position += bytesRead; const chunk = Buffer.from(buffer.subarray(0, bytesRead)); hash.update(chunk); yield chunk;
    }
    if (hash.digest("hex") !== file.sha256) throw new AppError(409, "HOMEWORK_FILE_CHANGED", "The submitted file failed its integrity check.");
  } finally { await handle.close(); }
}
async function* submittedZip(work: Awaited<ReturnType<typeof frozenWork>>, signal?: AbortSignal) {
  const pending: Uint8Array[] = []; let failure: Error | null = null;
  const zip = new Zip((error, bytes) => { if (error) failure = error; else pending.push(bytes); });
  try {
    for (const folder of work.folders) {
      signal?.throwIfAborted(); const entry = new ZipPassThrough(`${folder}/`); zip.add(entry); entry.push(new Uint8Array(), true);
      if (failure) throw failure; while (pending.length) yield pending.shift()!;
    }
    for (const file of work.files) {
      signal?.throwIfAborted(); const entry = new ZipPassThrough(normalizeHomeworkPath(file.path)); zip.add(entry);
      while (pending.length) yield pending.shift()!;
      for await (const bytes of fileChunks(file, signal)) { entry.push(bytes); if (failure) throw failure; while (pending.length) yield pending.shift()!; }
      entry.push(new Uint8Array(), true); if (failure) throw failure; while (pending.length) yield pending.shift()!;
    }
    zip.end(); if (failure) throw failure; while (pending.length) yield pending.shift()!;
  } finally { zip.terminate(); }
}
export async function downloadSubmittedHomework(scope: HomeworkStudentScope, expectedId?: string | null, signal?: AbortSignal) {
  const work = await frozenWork(scope, expectedId);
  await assertCurrentTeamSubmissionAccess(scope, work.submission);
  return new Response(Readable.toWeb(Readable.from(submittedZip(work, signal), { objectMode: false })) as ReadableStream, {
    headers: { "Content-Type": "application/zip", "Content-Disposition": 'attachment; filename="submitted-work.zip"', "Cache-Control": "private, no-store, max-age=0", "X-Content-Type-Options": "nosniff" }
  });
}
export async function checkSubmittedHomework(scope: HomeworkStudentScope, expectedId?: string | null) {
  const work = await frozenWork(scope, expectedId);
  const requirements = record(work.submission.metadata).requirements ? normalizeCodingHomeworkSubmissionRequirements(record(work.submission.metadata).requirements) : await getHomeworkRequirements(scope.activityId);
  const entries = work.folders.map(folder => ({ path: folder, isDirectory: true, content: null as Buffer | null, compressedSize: 0, uncompressedSize: 0 }));
  for (const file of work.files) {
    const content = await readFrozenHomeworkFile(file);
    entries.push({ path: file.path, isDirectory: false, content, compressedSize: content.length, uncompressedSize: content.length });
  }
  const validation = await validateCodingHomeworkArchive({ entries, requirements, archiveSizeBytes: work.files.reduce((sum, file) => sum + Number(file.sizeBytes), 0) });
  await assertCurrentTeamSubmissionAccess(scope, work.submission);
  return { validation, readiness: codingHomeworkSubmissionReadiness(validation) };
}
