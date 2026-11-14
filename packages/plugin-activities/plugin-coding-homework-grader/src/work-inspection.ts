import { createHash } from "node:crypto";
import type { ServerActivityPlugin, WorkInspectionContext } from "@cognelo/activity-sdk/server";
import type { WorkInspectionSection } from "@cognelo/contracts";
import { AppError, activityTeamAssignment, activityTeamworkEnabled } from "@cognelo/core";
import { prisma } from "./db-client";
import { draftFiles, readPreparedBytes, record, type PreparedHomeworkFile } from "./file-preparation";
import { readFrozenHomeworkFile } from "./hand-in";
import { currentHomeworkReportTargets } from "./gradebook-actions";

type FrozenFile = { path: string; storedName: string; sizeBytes: bigint; sha256: string };
type Collection = {
  id: string; revision: number; savedAt: string; kind: "draft" | "frozen";
  bindingId?: string;
  files: Array<PreparedHomeworkFile | FrozenFile>;
  questions: Array<{ id: string; questionText: string; studentAnswer: string | null }>;
};
async function collection(context: WorkInspectionContext): Promise<Collection | null> {
  if (context.embedded) return null;
  const { participant: person, activity } = context;
  let draft: { id: string; revision: number; files: unknown; updatedAt: Date; currentSubmissionId?: string | null; bindingId?: string } | null = null;
  let sourceId: string | null = null;
  if (activityTeamworkEnabled(activity.metadata)) {
    const policy = activityTeamAssignment(context.assignmentMetadata);
    if (!policy) return null;
    const [workspace] = await prisma.$queryRaw<Array<{ id: string; revision: number; files: unknown; updatedAt: Date; currentSubmissionId: string | null; bindingId: string }>>`
      SELECT w.id,w.revision,w.files,w."updatedAt",w."currentSubmissionId",m.id AS "bindingId" FROM "PluginCodingHomeworkWorkspaceMember" m
      JOIN "PluginCodingHomeworkWorkspace" w ON w.id=m."workspaceId" AND w."courseId"=${context.courseId}
      WHERE w."activityId"=${activity.id} AND w."groupId"=${person.groupId} AND w."groupingId"=${policy.groupingId}
        AND m."participantId"=${person.participantId} AND m."userId" IS NOT DISTINCT FROM ${person.userId}::text
        AND ((w."teamId" IS NOT NULL AND EXISTS(SELECT 1 FROM "StudentTeamMember" tm WHERE tm."participantId"=${person.participantId}
          AND tm."groupingId"=w."groupingId" AND tm."teamId"=w."teamId")) OR (w."teamId" IS NULL AND w."ownerParticipantId"=${person.participantId}
          AND ${policy.allowIndividualSubmission} AND NOT EXISTS(SELECT 1 FROM "StudentTeamMember" tm WHERE tm."participantId"=${person.participantId} AND tm."groupingId"=w."groupingId"))) LIMIT 1`;
    if (!workspace) return null;
    draft = workspace; sourceId = workspace.currentSubmissionId;
  } else if (person.userId) {
    draft = await prisma.pluginCodingHomeworkDraft.findUnique({ where: { activityId_groupId_userId: { activityId: activity.id, groupId: person.groupId, userId: person.userId } }, select: { id: true, revision: true, files: true, updatedAt: true } });
  }
  const [target] = await currentHomeworkReportTargets({ ...context, participants: [person] });
  const submissionId = target?.submissionId ?? sourceId;
  if (submissionId) {
    const submission = await prisma.pluginCodingHomeworkSubmission.findFirst({ where: { id: submissionId, activityId: activity.id, groupId: person.groupId, status: { not: "cancelled" } }, select: {
      id: true, metadata: true, updatedAt: true, files: { select: { path: true, storedName: true, sizeBytes: true, sha256: true }, orderBy: { path: "asc" }, take: 1001 },
      questions: { select: { id: true, questionText: true, studentAnswer: true, updatedAt: true }, orderBy: { orderIndex: "asc" }, take: 20 }
    } });
    if (submission && !record(submission.metadata).deletion) {
      if (submission.files.length > 1000) throw new AppError(413, "WORK_INSPECTION_TOO_LARGE", "The saved collection exceeds the inspection limit.");
      return { id: submission.id, revision: 0, kind: "frozen", bindingId: draft?.bindingId, savedAt: new Date(Math.max(submission.updatedAt.getTime(), ...submission.questions.map(q => q.updatedAt.getTime()))).toISOString(), files: submission.files, questions: submission.questions };
    }
  }
  return draft ? { id: draft.id, revision: draft.revision, kind: "draft", bindingId: draft.bindingId, savedAt: draft.updatedAt.toISOString(), files: draftFiles(draft.files), questions: [] } : null;
}
const fileKey = (value: Collection, path: string) => Buffer.from(JSON.stringify([value.kind, value.id, value.revision, value.bindingId ?? "", path])).toString("base64url");
export const homeworkWorkInspection: NonNullable<ServerActivityPlugin["workInspection"]> = {
  activityTypeKeys: ["coding-homework-grader"],
  async read(context) {
    const saved = await collection(context);
    if (!saved) return { sections: [] };
    const sections: WorkInspectionSection[] = saved.files.length ? [{ id: "files", blocks: saved.files.map(file => ({ kind: "file", key: fileKey(saved, file.path), path: file.path, language: /\.[ch]$/i.test(file.path) ? "c" : "text" })) }] : [];
    sections.push(...saved.questions.map((question, index) => ({ id: question.id, title: `${index + 1}`, blocks: [
      { kind: "markdown" as const, text: question.questionText }, { kind: "text" as const, text: question.studentAnswer ?? "" }
    ] })));
    return { sections, savedAt: saved.savedAt };
  },
  async readFile(context) {
    const saved = await collection(context);
    const file = saved?.files.find(file => fileKey(saved, file.path) === context.key);
    if (!saved || !file) throw new AppError(409, "WORK_INSPECTION_CHANGED", "The saved work changed. Refresh before opening this file.");
    const bytes = saved.kind === "draft" ? await readPreparedBytes(saved.id, file as PreparedHomeworkFile) : await readFrozenHomeworkFile(file as FrozenFile);
    if (createHash("sha256").update(bytes).digest("hex") !== file.sha256) throw new AppError(409, "HOMEWORK_FILE_CHANGED", "The saved file could not be verified.");
    const latest = await collection(context);
    if (!latest?.files.some(file => fileKey(latest, file.path) === context.key)) throw new AppError(409, "WORK_INSPECTION_CHANGED", "The saved work changed. Refresh before opening this file.");
    if (bytes.includes(0)) throw new AppError(415, "WORK_INSPECTION_BINARY_FILE", "A text preview is unavailable for this file.");
    const text = bytes.toString("utf8");
    return { path: file.path, text: text.slice(0, 2_000_000), truncated: text.length > 2_000_000 };
  }
};
