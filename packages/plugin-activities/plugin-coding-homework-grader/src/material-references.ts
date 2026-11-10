import { questionStageLocksReferences } from "./stage-activation-state";
import { randomUUID } from "node:crypto";
import type { ActivityMaterialReferencesService, PreparedActivityMaterialReferences } from "@cognelo/activity-sdk/server";
import { AppError, contentIndexRevision } from "@cognelo/core";
import { record } from "./file-preparation";

const strings = (value: unknown) => Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
export const homeworkMaterialReferences: ActivityMaterialReferencesService = {
  activityTypeKeys: ["coding-homework-grader"],
  async read({ activityId, courseId, transaction: sql }) {
    await sql.query`SELECT 1 FROM pg_advisory_xact_lock(hashtextextended(${`homework-settings:${activityId}`}, 0))`;
    const [assignment] = await sql.query<Array<{ settings: unknown }>>`SELECT settings FROM "PluginCodingHomeworkAssignment" WHERE "activityId"=${activityId}`;
    const settings = record(assignment?.settings), selected = Array.isArray(settings.referenceMaterialIds) ? strings(settings.referenceMaterialIds) : null;
    let prepared: PreparedActivityMaterialReferences | null = null;
    if (typeof settings.preparedSnapshotId === "string") {
      const [snapshot] = await sql.query<Array<{ id: string; status: string; metadata: unknown }>>`SELECT id,status,metadata FROM "PluginCodingHomeworkDocumentationSnapshot" WHERE id=${settings.preparedSnapshotId} AND "activityId"=${activityId} AND "courseId"=${courseId} AND "groupId" IS NULL`;
      const data = record(snapshot?.metadata);
      if (snapshot?.status === "ready") prepared = { id: snapshot.id, selected: strings(data.selected), indexIds: strings(data.indexIds), hiddenReferenceIndexIds: strings(data.hiddenReferenceIndexIds), embeddingAi: data.embeddingAi ? record(data.embeddingAi) : null,
        preparedByUserId: typeof data.preparedByUserId === "string" ? data.preparedByUserId : "", preparedAt: typeof data.preparedAt === "string" ? data.preparedAt : "", selectionFingerprint: String(data.selectionFingerprint ?? "") };
    }
    return { selected, prepared, locked: questionStageLocksReferences(settings), revision: contentIndexRevision({ selected, preparedId: settings.preparedSnapshotId ?? null, locked: questionStageLocksReferences(settings) }) };
  },
  async write({ activityId, courseId, selected, prepared, transaction: sql }) {
    const [assignment] = await sql.query<Array<{ settings: unknown }>>`SELECT settings FROM "PluginCodingHomeworkAssignment" WHERE "activityId"=${activityId}`;
    const previous = record(assignment?.settings);
    if (questionStageLocksReferences(previous)) throw new AppError(409, "HOMEWORK_SELECTION_LOCKED", "Deactivate the question stage before changing references.");
    const next: Record<string, unknown> = { ...previous, workflowVersion: 2, referenceMaterialIds: selected };
    delete next.preparedSnapshotId;
    if (prepared) {
      const id = randomUUID();
      await sql.execute`INSERT INTO "PluginCodingHomeworkDocumentationSnapshot" (id,"activityId","courseId",status,"contentTreeFingerprint",metadata,"updatedAt") VALUES
        (${id},${activityId},${courseId},'ready',${prepared.selectionFingerprint},${JSON.stringify({ workflowVersion: 2, ...prepared })}::jsonb,NOW())`;
      Object.assign(next, { preparedSnapshotId: id, ...(prepared.embeddingAi ? { embeddingAi: prepared.embeddingAi, embeddingConnectionId: prepared.embeddingAi.connectionId } : {}) });
    }
    await sql.execute`INSERT INTO "PluginCodingHomeworkAssignment" (id,"activityId",settings,"updatedAt") VALUES (${randomUUID()},${activityId},${JSON.stringify(next)}::jsonb,NOW())
      ON CONFLICT ("activityId") DO UPDATE SET settings=EXCLUDED.settings,"updatedAt"=NOW()`;
  }
};
