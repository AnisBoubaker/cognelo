import { homeworkFileStageSettings } from "./stage-scheduling";
import { acceptHomeworkStageTiming } from "./submission-window";
import { lockHomeworkSettings } from "./workflow-settings";
import { unlink } from "node:fs/promises";
import { z } from "zod";
import { AppError, teamworkTransaction } from "@cognelo/core";
import { acquireHomeworkUploadSlot, limitHomeworkUploads, lockHomeworkUploadBudget } from "./upload-budget";
import { readCodingHomeworkZip } from "./zip";
import { validateCodingHomeworkArchive, codingHomeworkSubmissionReadiness } from "./validation";
import { applyHomeworkPreparedUpload, decodeHomeworkUpload, draftFiles, draftFilePath, getHomeworkRequirements, homeworkUploadSchema, normalizeHomeworkPath, readHomeworkDraftEntries, readPreparedBytes, type HomeworkStudentScope } from "./file-preparation";
import { auditHomeworkWorkspace, withHomeworkTeamWorkspace, type TeamHomeworkAccess } from "./team-workspaces";

export function teamWorkspaceProjection(access: TeamHomeworkAccess) {
  return { contextKey: `${access.workspace.id}:${access.member.id}`, draftRevision: access.workspace.revision, teamId: access.context.teamId,
    teamName: access.context.visibleToStudents ? access.context.teamTitle : null,
    members: access.context.visibleToStudents ? access.context.members.map(member => ({ name: member.name, isSelf: member.participantId === access.context.participantId })) : [],
    canSubmit: Boolean(access.context.teamId) || access.context.allowIndividualSubmission };
}
export function assertTeamContext(access: TeamHomeworkAccess, contextKey?: string) {
  if (contextKey !== `${access.workspace.id}:${access.member.id}`) throw new AppError(409, "HOMEWORK_MEMBERSHIP_CHANGED", "Your team workspace changed. Reload before continuing.");
}
function assertWritable(access: TeamHomeworkAccess, contextKey?: string) {
  assertTeamContext(access, contextKey);
  if (access.workspace.currentSubmissionId) throw new AppError(409, "HOMEWORK_FILES_FROZEN", "Your team's work is already submitted. Only your teacher can reopen the submission.");
}
export async function getTeamHomeworkPreparation(scope: HomeworkStudentScope) {
  return withHomeworkTeamWorkspace(scope, async (_tx, access) => {
    const entries = await readHomeworkDraftEntries(access.workspace), requirements = await getHomeworkRequirements(scope.activityId);
    const validation = await validateCodingHomeworkArchive({ entries, requirements, archiveSizeBytes: entries.reduce((sum, entry) => sum + entry.uncompressedSize, 0) });
    return { draft: { revision: access.workspace.revision, files: draftFiles(access.workspace.files).map(({ storedName: _stored, ...file }) => file), folders: access.workspace.folders },
      validation, readiness: codingHomeworkSubmissionReadiness(validation), requirements, teamwork: teamWorkspaceProjection(access) };
  });
}
export async function uploadTeamHomeworkPreparation(scope: HomeworkStudentScope, input: unknown) {
  const data = homeworkUploadSchema.parse(input);
  await limitHomeworkUploads(scope.activityId, scope.user.id);
  const release = acquireHomeworkUploadSlot(), written: string[] = [], obsolete: string[] = [];
  let committed = false;
  try {
    if (data.kind !== "folder" && typeof data.base64 !== "string") throw new AppError(400, "HOMEWORK_UPLOAD_REQUIRED", "Upload a file.");
    const requirements = await getHomeworkRequirements(scope.activityId);
    const bytes = data.kind === "folder" ? null : decodeHomeworkUpload(data.base64 ?? "", Math.min(requirements.maxArchiveBytes, data.kind === "file" ? 8 * 1024 * 1024 : 25 * 1024 * 1024));
    const zip = data.kind === "zip" ? readCodingHomeworkZip(bytes!, requirements) : null;
    if (zip?.diagnostics.some(issue => issue.severity === "error")) throw new AppError(400, "HOMEWORK_ZIP_INVALID", "The ZIP could not be safely read.", { issues: zip.diagnostics });
    const incoming = zip ? zip.entries : [{ path: normalizeHomeworkPath(data.path ?? data.fileName ?? ""), isDirectory: data.kind === "folder", content: bytes, compressedSize: bytes?.length ?? 0, uncompressedSize: bytes?.length ?? 0 }];
    await withHomeworkTeamWorkspace(scope, async (tx, access) => {
      await lockHomeworkSettings(tx, scope.activityId);
      await acceptHomeworkStageTiming(scope, access.workspace.preparationStartedAt);
      assertWritable(access, data.contextKey);
      if (access.workspace.revision !== data.expectedRevision) throw new AppError(409, "HOMEWORK_DRAFT_CONFLICT", "The shared files changed. Reload them before uploading.");
      await lockHomeworkUploadBudget(tx, scope.activityId, scope.user.id, incoming.reduce((sum, entry) => sum + entry.uncompressedSize, 0));
      const update = await applyHomeworkPreparedUpload(access.workspace, data, incoming, requirements, written);
      const preparedAt = (await acceptHomeworkStageTiming(scope, access.workspace.preparationStartedAt)).submittedAt;
      const stageClock = (await homeworkFileStageSettings(scope)).filesStageEnabled ? new Date(preparedAt) : null;
      await tx.$executeRaw`UPDATE "PluginCodingHomeworkWorkspace" SET "preparationStartedAt"=COALESCE("preparationStartedAt",${stageClock}),files=${JSON.stringify(update.files)}::jsonb, folders=${JSON.stringify(update.folders)}::jsonb, revision=revision+1,"updatedAt"=${new Date(preparedAt)} WHERE id=${access.workspace.id}`;
      const sql = teamworkTransaction(tx);
      for (const change of update.changes) await auditHomeworkWorkspace(sql, access.workspace, scope.user, change.operation, { ...change, metadata: { revision: access.workspace.revision + 1 } });
      if (data.kind === "zip" || data.kind === "folder") await auditHomeworkWorkspace(sql, access.workspace, scope.user, data.kind === "zip" ? "zip_replaced" : "folder_added", { path: data.kind === "folder" ? data.path : undefined, metadata: { revision: access.workspace.revision + 1, fileCount: update.files.length } });
      obsolete.push(...update.obsolete);
    });
    committed = true;
    await Promise.all(obsolete.map(file => unlink(file).catch(() => {})));
    return getTeamHomeworkPreparation(scope);
  } catch (error) { if (!committed) await Promise.all(written.map(file => unlink(file).catch(() => {}))); throw error; }
  finally { release(); }
}
export async function removeTeamHomeworkPreparedFile(scope: HomeworkStudentScope, input: unknown) {
  const data = z.union([z.object({ path: z.string().min(1).max(500), expectedRevision: z.number().int().min(0), contextKey: z.string().max(200).optional() }).strict(), z.object({ all: z.literal(true), expectedRevision: z.number().int().min(0), contextKey: z.string().max(200).optional() }).strict()]).parse(input);
  const removed = await withHomeworkTeamWorkspace(scope, async (tx, access) => {
    await lockHomeworkSettings(tx, scope.activityId);
    await acceptHomeworkStageTiming(scope, access.workspace.preparationStartedAt);
    assertWritable(access, data.contextKey);
    if (access.workspace.revision !== data.expectedRevision) throw new AppError(409, "HOMEWORK_DRAFT_CONFLICT", "The shared files changed. Reload them before removing files.");
    const files = draftFiles(access.workspace.files), clear = "all" in data;
    const removed = clear ? files : files.filter(file => file.path === data.path);
    const preparedAt = (await acceptHomeworkStageTiming(scope, access.workspace.preparationStartedAt)).submittedAt;
    await tx.$executeRaw`UPDATE "PluginCodingHomeworkWorkspace" SET files=${JSON.stringify(clear ? [] : files.filter(file => file.path !== data.path))}::jsonb,
      folders=${JSON.stringify(clear ? [] : access.workspace.folders)}::jsonb, revision=revision+1,"updatedAt"=${new Date(preparedAt)} WHERE id=${access.workspace.id}`;
    for (const file of removed) await auditHomeworkWorkspace(teamworkTransaction(tx), access.workspace, scope.user, "file_deleted", { path: file.path, previousHash: file.sha256, metadata: { revision: access.workspace.revision + 1 } });
    if (clear) await auditHomeworkWorkspace(teamworkTransaction(tx), access.workspace, scope.user, "files_cleared", { metadata: { revision: access.workspace.revision + 1, fileCount: removed.length } });
    return removed.map(file => draftFilePath(access.workspace.id, file.storedName));
  });
  await Promise.all(removed.map(file => unlink(file).catch(() => {})));
  return getTeamHomeworkPreparation(scope);
}
export async function getTeamHomeworkPreparedFile(scope: HomeworkStudentScope, filePath: string) {
  return withHomeworkTeamWorkspace(scope, async (_tx, access) => {
    const file = draftFiles(access.workspace.files).find(file => file.path === normalizeHomeworkPath(filePath));
    if (!file) throw new AppError(404, "HOMEWORK_FILE_NOT_FOUND", "The file was not found in your current workspace.");
    const bytes = await readPreparedBytes(access.workspace.id, file);
    return { path: file.path, text: bytes.toString("utf8").slice(0, 2_000_000), truncated: bytes.length > 2_000_000 };
  });
}
