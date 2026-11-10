import type { GradebookActionContext, GradebookActionService } from "@cognelo/activity-sdk/server";
import { AppError } from "@cognelo/core";
import { prisma } from "./db-client";
import { normalizeHomeworkPath } from "./file-preparation";
import { homeworkGradebookActions } from "./gradebook-action-definitions";
import { submittedWorkZipResponse, type SubmittedZipWork } from "./submitted-work";

type Target = { participantId: string; submissionId: string; groupId: string; userId: string };
/** Private hand-in state is interpreted here, including hand-ins with no core attempt yet. */
async function currentTargets(context: GradebookActionContext): Promise<Target[]> {
  const roster = context.participants.filter(person => person.userId);
  if (!roster.length) return [];
  return prisma.$queryRaw<Target[]>`
    WITH authorized AS (SELECT * FROM unnest(${roster.map(p => p.participantId)}::text[],${roster.map(p => p.groupId)}::text[],${roster.map(p => p.userId)}::text[]) AS p("participantId","groupId","userId")),
    latest AS (SELECT DISTINCT ON (p."participantId") p."participantId",s.id AS "submissionId",s."groupId",s."userId",s.status,s."workspaceId",s."workspaceMemberId",s."sharedSourceId",s."coreAttemptId",
      s.metadata ? 'deletion' AS deleted
      FROM authorized p JOIN "PluginCodingHomeworkSubmission" s ON s."groupId"=p."groupId" AND s."userId"=p."userId" AND s."activityId"=${context.activity.id} AND s.kind='final'
      ORDER BY p."participantId",s."createdAt" DESC,s.id DESC)
    SELECT l."participantId",l."submissionId",l."groupId",l."userId" FROM latest l
      LEFT JOIN "ActivityAttempt" a ON a.id=l."coreAttemptId"
      LEFT JOIN "PluginCodingHomeworkWorkspace" w ON w.id=l."workspaceId"
      LEFT JOIN "PluginCodingHomeworkWorkspaceMember" m ON m.id=l."workspaceMemberId"
    WHERE l.status<>'cancelled' AND NOT l.deleted
      AND (l."coreAttemptId" IS NULL OR (a."courseId"=${context.courseId} AND a."activityId"=${context.activity.id} AND a."groupId"=l."groupId" AND a."participantId"=l."participantId" AND a."userId"=l."userId" AND a.lifecycle<>'deleted'))
      AND (l."workspaceId" IS NULL OR (w."activityId"=${context.activity.id} AND w."courseId"=${context.courseId} AND w."groupId"=l."groupId" AND w."currentSubmissionId"=l."sharedSourceId"
        AND m."workspaceId"=w.id AND m."currentSubmissionId"=l."submissionId" AND m."participantId"=l."participantId" AND m."userId"=l."userId"
        AND (w."teamId" IS NULL OR EXISTS(SELECT 1 FROM "StudentTeamMember" tm WHERE tm."participantId"=m."participantId" AND tm."teamId"=w."teamId" AND tm."groupingId"=w."groupingId"))))
      AND EXISTS(SELECT 1 FROM "PluginCodingHomeworkSubmissionFile" f WHERE f."submissionId"=l."submissionId")
    ORDER BY l."participantId"`;
}
export function homeworkArchiveSegment(value: string) {
  const clean = value.normalize("NFC").replace(/[\\/<>:"|?*\x00-\x1f\x7f]/g, "_").replace(/^\.+|\.+$/g, "").trim();
  return [...clean].slice(0, 60).join("") || "submission";
}
async function download(context: GradebookActionContext & { actionId: string }) {
  const batch = context.actionId === "download-all-submitted-work";
  const targets = await currentTargets(context);
  if (targets.length !== context.participants.length) throw new AppError(409, "HOMEWORK_DOWNLOAD_CHANGED", "Submitted work changed. Refresh the gradebook and try again.");
  const files = await prisma.pluginCodingHomeworkSubmissionFile.findMany({ where: { submissionId: { in: targets.map(target => target.submissionId) } },
    select: { submissionId: true, path: true, storedName: true, sizeBytes: true, sha256: true }, orderBy: [{ submissionId: "asc" }, { path: "asc" }], take: 20_001 });
  if (files.length > 20_000 || files.some(file => file.sizeBytes < 0n || file.sizeBytes > 8n * 1024n * 1024n) || files.reduce((sum, file) => sum + file.sizeBytes, 0n) > 256n * 1024n * 1024n) {
    throw new AppError(413, "HOMEWORK_DOWNLOAD_TOO_LARGE", "Download students individually or filter to a smaller section.");
  }
  const [size] = await prisma.$queryRaw<Array<{ folders: bigint }>>`SELECT COALESCE(SUM(jsonb_array_length(CASE WHEN jsonb_typeof(metadata->'folders')='array' THEN metadata->'folders' ELSE '[]'::jsonb END)),0)::bigint AS folders FROM "PluginCodingHomeworkSubmission" WHERE id=ANY(${targets.map(target => target.submissionId)}::text[])`;
  if (size.folders > 10_000n) throw new AppError(413, "HOMEWORK_DOWNLOAD_TOO_LARGE", "Download students individually or filter to a smaller section.");
  const savedFolders = await prisma.$queryRaw<Array<{ id: string; folders: unknown }>>`SELECT id,metadata->'folders' AS folders FROM "PluginCodingHomeworkSubmission" WHERE id=ANY(${targets.map(target => target.submissionId)}::text[])`;
  const work: SubmittedZipWork = { files: [], folders: [] };
  for (const [index, person] of context.participants.entries()) {
    const target = targets.find(target => target.participantId === person.participantId)!;
    const own = files.filter(file => file.submissionId === target.submissionId);
    if (!own.length || own.length > 1000 || own.reduce((sum, file) => sum + file.sizeBytes, 0n) > 25n * 1024n * 1024n) throw new AppError(413, "HOMEWORK_COLLECTION_LIMIT", "A submitted collection exceeds its download limit.");
    const prefix = batch ? `${String(index + 1).padStart(3, "0")}-${homeworkArchiveSegment(`${person.groupTitle}-${person.name}`)}/` : "";
    const folders = new Set<string>();
    const saved = savedFolders.find(row => row.id === target.submissionId)?.folders;
    for (const folder of Array.isArray(saved) ? saved : []) if (typeof folder === "string") folders.add(normalizeHomeworkPath(folder));
    for (const file of own) {
      const normalized = normalizeHomeworkPath(file.path), parts = normalized.split("/");
      for (let i = 1; i < parts.length; i++) folders.add(parts.slice(0, i).join("/"));
      work.files.push({ ...file, path: prefix + normalized });
    }
    if (folders.size > 1000) throw new AppError(413, "HOMEWORK_COLLECTION_LIMIT", "A submitted collection contains too many folders.");
    if (prefix) work.folders.push(prefix.slice(0, -1));
    work.folders.push(...[...folders].sort().map(folder => prefix + folder));
  }
  if (work.files.length + work.folders.length > 30_000) throw new AppError(413, "HOMEWORK_DOWNLOAD_TOO_LARGE", "The download contains too many paths. Download students individually or filter to a smaller section.");
  const validate = async () => {
    context.signal?.throwIfAborted();
    const current = await currentTargets(context);
    if (current.length !== targets.length || targets.some(target => !current.some(row => row.participantId === target.participantId && row.submissionId === target.submissionId))) throw new AppError(409, "HOMEWORK_DOWNLOAD_CHANGED", "Submitted work changed during the download. Try again.");
  };
  await validate();
  const name = batch ? `${homeworkArchiveSegment(context.activity.title)}-submissions.zip` : `${homeworkArchiveSegment(context.participants[0].name)}-submitted-work.zip`;
  return submittedWorkZipResponse(work, name, context.signal, validate);
}
export const homeworkGradebookActionService: GradebookActionService = {
  activityTypeKeys: ["coding-homework-grader"],
  async availability(context) {
    const ids = (await currentTargets(context)).map(target => target.participantId);
    return Object.fromEntries(homeworkGradebookActions.map(action => [action.id, ids]));
  },
  execute: download
};
