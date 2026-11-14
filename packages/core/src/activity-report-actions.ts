import { z } from "zod";
import { getActivityReportService } from "@cognelo/activity-sdk/server";
import type { CurrentUser, ActivityStudentActionList } from "@cognelo/contracts";
import { activityReportScope } from "./activity-report-scope";
import { AppError, notFound } from "./errors";

export async function listActivityStudentActions(user: CurrentUser, courseId: string, activityId: string, groupId?: string) {
  const context = await activityReportScope(user, courseId, activityId, groupId);
  const service = getActivityReportService(context.activity.activityType.key)?.studentActions;
  if (!service) return { actions: [], issues: [] };
  return validateActions(await service.list({ ...context, recoverAutomatic: true }), context.participants);
}
function validateActions(result: ActivityStudentActionList, participants: readonly { participantId: string; groupId: string }[]) {
  const keys = new Set(participants.map(p => `${p.groupId}:${p.participantId}`));
  if (result.actions.some(action => !keys.has(`${action.groupId}:${action.participantId}`))) throw new AppError(500, "ACTIVITY_ACTION_CONTRACT_INVALID", "The activity returned an invalid student action.");
  return { issues: result.issues.map(issue => issue.slice(0, 2000)), actions: result.actions.map(action => ({
    id: action.id, participantId: action.participantId, groupId: action.groupId, targetId: action.targetId,
    labels: action.labels, messages: action.messages, reasonLabels: action.reasonLabels, icon: action.icon
  })) };
}
export async function executeActivityStudentAction(user: CurrentUser, courseId: string, activityId: string, value: unknown) {
  const input = z.object({ actionId: z.string().min(1).max(64), targetId: z.string().min(1).max(200), participantId: z.string().min(1), groupId: z.string().min(1), reason: z.string().trim().min(1).max(2000) }).strict().parse(value);
  const context = await activityReportScope(user, courseId, activityId, input.groupId, input.participantId);
  const service = getActivityReportService(context.activity.activityType.key)?.studentActions;
  if (!service) throw notFound("Student action");
  const available = validateActions(await service.list({ ...context, recoverAutomatic: false }), context.participants);
  if (!available.actions.some(action => action.id === input.actionId && action.targetId === input.targetId && action.participantId === input.participantId && action.groupId === input.groupId)) {
    throw new AppError(409, "ACTIVITY_ACTION_CHANGED", "The submission changed. Refresh the results and try again.");
  }
  await service.execute({ ...context, actionId: input.actionId, targetId: input.targetId, reason: input.reason });
  return { completed: true };
}
