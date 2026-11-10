import type { PluginTeamworkTransaction } from "@cognelo/activity-sdk/server";
import { z } from "zod";
import { AiModelSelectionSchema, type CurrentUser } from "@cognelo/contracts";
import { Prisma, prisma } from "@cognelo/db";
import { assertCanManageCourse } from "./authorization";
import { AppError } from "./errors";
import { getAiAgentConnectionForUser, listAiAgentConnections, snapshotAiModelSelection, type StoredAiModelSelection } from "./ai-agents";
import { createCourseEmbeddingProvider } from "./material-embeddings";

export async function lockCourseMaterialEmbeddingSettings(tx: { $queryRaw: PluginTeamworkTransaction["query"] }, courseId: string) {
  await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtextextended(${`course-material-embedding:${courseId}`}, 0))`;
}
export async function readCourseMaterialEmbeddingSelection(courseId: string): Promise<StoredAiModelSelection | undefined> {
  const row = await prisma.courseMaterialEmbeddingSettings.findUnique({ where: { courseId }, select: { selection: true } });
  const selected = row?.selection as Record<string, unknown> | undefined;
  return selected && typeof selected.connectionId === "string" && typeof selected.model === "string" ? selected as StoredAiModelSelection : undefined;
}
export async function getCourseMaterialEmbeddingSettings(user: CurrentUser, courseId: string) {
  await assertCanManageCourse(user, courseId);
  const selection = await readCourseMaterialEmbeddingSelection(courseId);
  let resolved: { connectionId: string; model: string } | null = null, error: string | null = null;
  try { const provider = await createCourseEmbeddingProvider(user, courseId); resolved = { connectionId: provider.connectionId, model: provider.model }; }
  catch (failure) { error = failure instanceof AppError ? failure.message : "The course embedding model is unavailable."; }
  return { selection: selection ? { connectionId: selection.connectionId, model: selection.model } : null, resolved, error,
    connections: (await listAiAgentConnections(user)).connections.filter(connection => connection.isEnabled) };
}
export async function updateCourseMaterialEmbeddingSettings(user: CurrentUser, courseId: string, input: unknown) {
  await assertCanManageCourse(user, courseId);
  const { selection } = z.object({ selection: AiModelSelectionSchema.nullable() }).strict().parse(input);
  const current = await readCourseMaterialEmbeddingSelection(courseId);
  if (selection && current?.connectionId === selection.connectionId && current.model === selection.model) return getCourseMaterialEmbeddingSettings(user, courseId);
  const stored = selection ? snapshotAiModelSelection(await getAiAgentConnectionForUser(user, selection, "embedding"), user.id) : {};
  if (selection) await createCourseEmbeddingProvider(user, courseId, stored);
  await prisma.$transaction(async tx => {
    await lockCourseMaterialEmbeddingSettings(tx, courseId);
    const previous = await tx.courseMaterialEmbeddingSettings.findUnique({ where: { courseId }, select: { selection: true } });
    await tx.courseMaterialEmbeddingSettings.upsert({ where: { courseId }, create: { courseId, selection: stored as Prisma.InputJsonValue, updatedByUserId: user.id }, update: { selection: stored as Prisma.InputJsonValue, updatedByUserId: user.id } });
    await tx.courseAuditEvent.create({ data: { courseId, actorUserId: user.id, eventType: "course_material_embedding_model_updated", targetType: "course", targetId: courseId, previousValue: previous?.selection ?? {}, nextValue: stored as Prisma.InputJsonValue } });
  });
  return getCourseMaterialEmbeddingSettings(user, courseId);
}
