import { z } from "zod";
import { prisma } from "@cognelo/db";
import { getActivityDefinition } from "@cognelo/activity-sdk";
import { getWorkInspectionService, type WorkInspectionContext, type ServerActivityRecord } from "@cognelo/activity-sdk/server";
import type { CurrentUser, WorkInspection, WorkInspectionSection } from "@cognelo/contracts";
import { activityReportScope } from "./activity-report-scope";
import { assignmentAssessmentMode } from "./gradebook";
import { AppError, notFound } from "./errors";

const object = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
const blockSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.enum(["text", "markdown"]), text: z.string().max(2_000_000) }),
  z.object({ kind: z.literal("code"), text: z.string().max(2_000_000), language: z.string().max(80).optional() }),
  z.object({ kind: z.literal("file"), key: z.string().max(4000), path: z.string().max(1000), language: z.string().max(80).optional() })
]);
const sectionsSchema = z.array(z.object({ id: z.string().max(300), title: z.string().max(1000).optional(), blocks: z.array(blockSchema).max(1000) })).max(300);
function publicSections(value: WorkInspectionSection[]) {
  const sections = sectionsSchema.parse(value);
  if (Buffer.byteLength(JSON.stringify(sections)) > 4 * 1024 * 1024) throw new AppError(413, "WORK_INSPECTION_TOO_LARGE", "The saved work exceeds the inspection limit.");
  return sections;
}
async function inspectionContext(user: CurrentUser, courseId: string, activityId: string, groupId: string, participantId: string) {
  const scope = await activityReportScope(user, courseId, activityId, groupId, participantId);
  if (!getActivityDefinition(scope.activity.activityType.key)?.supportsWorkInspection) throw new AppError(400, "WORK_INSPECTION_UNSUPPORTED", "This activity does not support saved-work inspection.");
  const assignment = await prisma.courseGroupActivity.findUnique({ where: { groupId_activityId: { groupId, activityId } }, select: { id: true, metadata: true } });
  if (!assignment) throw notFound("Activity assignment");
  const participant = scope.participants[0];
  const context: WorkInspectionContext = { user, courseId, activity: scope.activity, participant, assignmentMetadata: assignment.metadata, state: null, embedded: false };
  return { context, assignment };
}
/** Staff inspection is a read-only snapshot: no runtime initialization, expiry recovery, grading or execution. */
export async function inspectActivityWork(user: CurrentUser, courseId: string, activityId: string, groupId: string, participantId: string, testItemId?: string): Promise<WorkInspection> {
  const { context, assignment } = await inspectionContext(user, courseId, activityId, groupId, participantId);
  const [attempt, draft] = await Promise.all([
    prisma.activityAttempt.findFirst({ where: { courseId, activityId, groupActivityId: assignment.id, participantId, assessmentMode: assignmentAssessmentMode(assignment.metadata), lifecycle: "started" }, orderBy: { attemptNumber: "desc" }, select: { id: true, attemptNumber: true, startedAt: true, updatedAt: true } }),
    prisma.activityResponseDraft.findUnique({ where: { groupActivityId_participantId: { groupActivityId: assignment.id, participantId } }, select: { state: true, updatedAt: true } })
  ]);
  let sections: WorkInspectionSection[] = [], savedAt: string | null = draft?.updatedAt.toISOString() ?? null;
  let items: Array<{ id: string; title: string }> | undefined, selectedItemId: string | undefined;
  if (context.activity.activityType.key === "test") {
    const parent = attempt ? await prisma.activityAttempt.findFirst({ where: { id: attempt.id, courseId, activityId, participantId, groupId, lifecycle: "started" }, select: { metadata: true, testRevisionId: true } }) : null;
    if (parent) {
      const manifest = object(object(parent.metadata).manifest);
      items = (Array.isArray(manifest.items) ? manifest.items : []).flatMap(raw => {
        const item = object(raw);
        return typeof item.testItemId === "string" ? [{ id: item.testItemId, title: typeof item.title === "string" ? item.title : "" }] : [];
      }).slice(0, 300);
      selectedItemId = testItemId ?? items[0]?.id;
      if (testItemId && !items.some(item => item.id === testItemId)) throw notFound("Test question");
      if (selectedItemId) {
        const [response, revision] = await Promise.all([
          prisma.testItemAttempt.findUnique({ where: { parentAttemptId_testItemId: { parentAttemptId: attempt!.id, testItemId: selectedItemId } }, select: { result: true, updatedAt: true, activity: { include: { activityType: true } } } }),
          parent.testRevisionId ? prisma.testRevisionItem.findUnique({ where: { testRevisionId_sourceTestItemId: { testRevisionId: parent.testRevisionId, sourceTestItemId: selectedItemId } } }) : null
        ]);
        if (response) {
          const activity: ServerActivityRecord = { ...response.activity, title: revision?.title ?? response.activity.title,
            config: object(revision?.config ?? response.activity.config), metadata: object(revision?.metadata ?? response.activity.metadata) };
          const service = getWorkInspectionService(revision?.activityTypeKey ?? activity.activityType.key);
          if (service) {
            const result = await service.read({ ...context, activity, state: object(object(response.result).state), embedded: true });
            sections = result.sections; savedAt = response.updatedAt.toISOString();
          }
        }
      }
    }
  } else {
    const service = getWorkInspectionService(context.activity.activityType.key);
    if (!service) throw new AppError(503, "WORK_INSPECTION_UNAVAILABLE", "Saved-work inspection is unavailable.");
    const result = await service.read({ ...context, state: draft ? object(draft.state) : null });
    sections = result.sections; savedAt = result.savedAt ?? savedAt;
  }
  return { activityTitle: context.activity.title, participantName: context.participant.name, groupTitle: context.participant.groupTitle,
    attemptNumber: attempt?.attemptNumber ?? null, startedAt: attempt?.startedAt.toISOString() ?? null, savedAt, sections: publicSections(sections), ...(items ? { items, selectedItemId } : {}) };
}
export async function inspectActivityWorkFile(user: CurrentUser, courseId: string, activityId: string, groupId: string, participantId: string, key: string) {
  const { context } = await inspectionContext(user, courseId, activityId, groupId, participantId);
  const service = getWorkInspectionService(context.activity.activityType.key);
  if (!service?.readFile) throw notFound("Saved file");
  const result = await service.readFile({ ...context, key });
  return z.object({ path: z.string().max(1000), text: z.string().max(2_000_000), truncated: z.boolean() }).parse(result);
}
