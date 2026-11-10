import { z } from "zod";
import { prisma } from "@cognelo/db";
import type { CurrentUser } from "@cognelo/contracts";
import { getActivityDefinition } from "@cognelo/activity-sdk";
import { getGradebookActionService, type GradebookActionContext, type GradebookActionParticipant } from "@cognelo/activity-sdk/server";
import { assertCanViewCourseGradebook } from "./authorization";
import { AppError, forbidden, notFound } from "./errors";

async function actionScope(user: CurrentUser, courseId: string, activityId: string, groupId?: string, participantId?: string) {
  const capabilities = await assertCanViewCourseGradebook(user, courseId);
  if (groupId && capabilities.gradingGroupIds !== null && !capabilities.gradingGroupIds.includes(groupId)) throw forbidden();
  const activity = await prisma.activity.findFirst({ where: { id: activityId, courseId }, include: { activityType: true } });
  if (!activity) throw notFound("Activity");
  if (groupId && !await prisma.courseGroup.findFirst({ where: { id: groupId, courseId }, select: { id: true } })) throw notFound("Section");
  const definition = getActivityDefinition(activity.activityType.key);
  const definitions = definition?.gradebookActions ?? [];
  const service = getGradebookActionService(activity.activityType.key);
  if (!definitions.length) return { definitions, service, context: null };
  if (definition?.provider.kind === "plugin") {
    const installation = await prisma.activityPluginInstallation.findUnique({ where: { key: definition.provider.key }, select: { isActivated: true } });
    if (!installation?.isActivated) throw new AppError(409, "GRADEBOOK_ACTION_UNAVAILABLE", "This activity's provider is inactive.");
  }
  if (!service) throw new AppError(503, "GRADEBOOK_ACTION_UNAVAILABLE", "This activity's gradebook actions are unavailable.");
  const roster = await prisma.courseGroupParticipant.findMany({ where: {
    role: "student", ...(participantId ? { id: participantId } : {}),
    group: { courseId, activities: { some: { activityId } } },
    ...(groupId ? { groupId } : capabilities.gradingGroupIds !== null ? { groupId: { in: capabilities.gradingGroupIds } } : {})
  }, select: { id: true, userId: true, groupId: true, firstName: true, lastName: true, email: true, group: { select: { title: true } } },
  orderBy: [{ groupId: "asc" }, { lastName: "asc" }, { firstName: "asc" }, { id: "asc" }], take: 1001 });
  if (roster.length > 1000) throw new AppError(413, "GRADEBOOK_ACTION_TOO_LARGE", "Select a section with fewer students for this download.");
  const participants: GradebookActionParticipant[] = roster.map(person => ({ participantId: person.id, groupId: person.groupId, userId: person.userId,
    name: [person.firstName, person.lastName].filter(Boolean).join(" ") || person.email, groupTitle: person.group.title }));
  const context: GradebookActionContext = { user, courseId, activity: { ...activity, config: activity.config as Record<string, unknown>, metadata: activity.metadata as Record<string, unknown> }, participants };
  return { definitions, service, context };
}
function validatedAvailability(definitions: readonly { id: string }[], participants: readonly GradebookActionParticipant[], value: Record<string, readonly string[]>) {
  const allowed = new Set(participants.map(person => person.participantId));
  if (Object.entries(value).some(([id, ids]) => !definitions.some(action => action.id === id) || !Array.isArray(ids) || ids.some(id => !allowed.has(id)))) {
    throw new AppError(500, "GRADEBOOK_ACTION_CONTRACT_INVALID", "The activity returned an invalid action selection.");
  }
  return value;
}
export async function listGradebookPluginActions(user: CurrentUser, courseId: string, activityId: string, groupId?: string) {
  const { definitions, service, context } = await actionScope(user, courseId, activityId, groupId);
  if (!context || !service) return { actions: [] };
  const available = validatedAvailability(definitions, context.participants, await service.availability(context));
  return { actions: definitions.map(action => ({ ...action, participantIds: [...new Set(available[action.id] ?? [])] })) };
}
export async function executeGradebookPluginAction(user: CurrentUser, courseId: string, activityId: string, actionId: string, value: unknown, signal?: AbortSignal) {
  await assertCanViewCourseGradebook(user, courseId);
  const input = z.object({ groupId: z.string().min(1).optional(), participantId: z.string().min(1).optional() }).strict().parse(value);
  const { definitions, service, context } = await actionScope(user, courseId, activityId, input.groupId, input.participantId);
  const action = definitions.find(action => action.id === actionId);
  if (!action || !service || !context) throw notFound("Gradebook action");
  if ((action.scope === "participant") !== Boolean(input.participantId)) throw new AppError(400, "GRADEBOOK_ACTION_SELECTION_REQUIRED", "Select the student required by this action.");
  if (input.participantId && !context.participants.some(person => person.participantId === input.participantId)) throw forbidden();
  signal?.throwIfAborted();
  const availability = validatedAvailability(definitions, context.participants, await service.availability(context));
  const selected = new Set(availability[action.id] ?? []);
  const participants = context.participants.filter(person => selected.has(person.participantId));
  if (!participants.length) throw new AppError(409, "GRADEBOOK_ACTION_NO_SUBMISSIONS", "No submitted files are available for this selection.");
  const response = await service.execute({ ...context, participants, actionId, signal });
  const headers = new Headers(response.headers);
  headers.set("Cache-Control", "private, no-store");
  headers.set("X-Content-Type-Options", "nosniff");
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}
