import type { CurrentUser } from "@cognelo/contracts";
import { getCourseAiAgentConnection, getCourseTeacherQuestionAuthoringAiAgentConnection, snapshotAiModelSelection, type StoredAiModelSelection, type MaterialEmbeddingSelection } from "@cognelo/core";
import { prisma } from "./db-client";
import { record } from "./file-preparation";

export function storedHomeworkAiSelection(value: unknown): StoredAiModelSelection | null {
  const data = record(value);
  if (typeof data.connectionId !== "string" || typeof data.model !== "string") return null;
  return { connectionId: data.connectionId, model: data.model,
    ...(typeof data.selectedByUserId === "string" ? { selectedByUserId: data.selectedByUserId } : {}),
    ...(typeof data.endpointKey === "string" ? { endpointKey: data.endpointKey } : {}) };
}
export function homeworkEmbeddingSelection(settings: Record<string, unknown>): MaterialEmbeddingSelection | undefined {
  const selection = storedHomeworkAiSelection(settings.embeddingAi);
  if (selection) {
    const dimensions = record(settings.embeddingAi).dimensions;
    return { ...selection, ...(dimensions === null || typeof dimensions === "number" ? { dimensions } : {}) };
  }
  return typeof settings.embeddingConnectionId === "string" ? { connectionId: settings.embeddingConnectionId, model: "text-embedding-3-small", dimensions: 1536 } : undefined;
}
export async function getHomeworkQuestionConnection(scope: { user: CurrentUser; courseId: string; activityId: string }, settings?: Record<string, unknown>) {
  const configuration = settings ?? record((await prisma.pluginCodingHomeworkAssignment.findUnique({ where: { activityId: scope.activityId } }))?.settings);
  const selected = storedHomeworkAiSelection(configuration.questionGenerationAi);
  if (selected) return getCourseAiAgentConnection(scope.user, scope.courseId, selected, "generation");
  const connection = await getCourseTeacherQuestionAuthoringAiAgentConnection(scope.user, scope.courseId);
  return getCourseAiAgentConnection(scope.user, scope.courseId, snapshotAiModelSelection(connection), "generation");
}
