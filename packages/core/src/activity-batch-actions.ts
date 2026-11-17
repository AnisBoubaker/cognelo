import { createHash } from "node:crypto";
import { z } from "zod";
import { prisma } from "@cognelo/db";
import type { ActivityBatchAction, CurrentUser } from "@cognelo/contracts";
import { getActivityReportService } from "@cognelo/activity-sdk/server";
import { activityReportScope } from "./activity-report-scope";
import { AppError, notFound } from "./errors";

function validate(actions: ActivityBatchAction[], roster: readonly { participantId: string }[]) {
  const allowed = new Set(roster.map(person => person.participantId));
  if (new Set(actions.map(action => action.id)).size !== actions.length || actions.some(action => action.participantIds.some(id => !allowed.has(id)))) throw new AppError(500, "ACTIVITY_ACTION_CONTRACT_INVALID", "The activity returned an invalid batch selection.");
  return actions.map(action => ({ id: action.id, icon: action.icon, revision: action.revision, participantIds: [...new Set(action.participantIds)], labels: action.labels, messages: action.messages, reasonLabels: action.reasonLabels }));
}
export async function listActivityBatchActions(user: CurrentUser, courseId: string, activityId: string, groupId?: string) {
  const context = await activityReportScope(user, courseId, activityId, groupId);
  const service = getActivityReportService(context.activity.activityType.key)?.activityActions;
  return { actions: service ? validate(await service.list(context), context.participants) : [] };
}
export async function executeActivityBatchAction(user: CurrentUser, courseId: string, activityId: string, value: unknown) {
  const input = z.object({ actionId: z.string().min(1).max(64), reason: z.string().trim().min(1).max(2000), groupId: z.string().min(1).optional(), revision: z.string().regex(/^[a-f0-9]{64}$/), operationId: z.string().uuid() }).strict().parse(value);
  const context = await activityReportScope(user, courseId, activityId, input.groupId);
  const service = getActivityReportService(context.activity.activityType.key)?.activityActions;
  if (!service) throw notFound("Activity action");
  const requestHash = createHash("sha256").update(JSON.stringify({ courseId, activityId, ...input })).digest("hex");
  const receipt = await prisma.courseAuditEvent.findUnique({ where: { id: input.operationId } });
  if (receipt) {
    const metadata = receipt.metadata as Record<string, unknown>;
    if (receipt.courseId !== courseId || receipt.actorUserId !== user.id || receipt.targetId !== activityId || receipt.eventType !== "activity_report_batch_action" || metadata.requestHash !== requestHash) throw new AppError(409, "ACTIVITY_ACTION_CHANGED", "This operation belongs to a different request.");
    return { completed: true, affectedCount: Number(metadata.affectedCount) };
  }
  const action = validate(await service.list(context), context.participants).find(action => action.id === input.actionId);
  if (!action || action.revision !== input.revision) throw new AppError(409, "ACTIVITY_ACTION_CHANGED", "The submissions or saved settings changed. Refresh and confirm the action again.");
  if (!action.participantIds.length) throw new AppError(409, "ACTIVITY_ACTION_NO_SUBMISSIONS", "There are no submissions for this action.");
  if (action.participantIds.length > 500) throw new AppError(413, "ACTIVITY_ACTION_TOO_LARGE", "Select a section with at most 500 students.");
  const result = await service.execute({ ...context, ...input, requestHash });
  return { completed: true, affectedCount: result.affectedCount };
}
