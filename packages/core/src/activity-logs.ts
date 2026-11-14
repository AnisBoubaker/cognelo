import { prisma } from "@cognelo/db";
import { getActivityReportService } from "@cognelo/activity-sdk/server";
import type { ActivityLogCursor, ActivityLogEvidence, ActivityLogPage, CurrentUser } from "@cognelo/contracts";
import { activityReportScope } from "./activity-report-scope";

export function compareActivityLogs(a: { at: string; id: string }, b: { at: string; id: string }) {
  return b.at.localeCompare(a.at) || (a.id === b.id ? 0 : a.id < b.id ? 1 : -1);
}
/** Apply the same composite ordering inside each source, including timestamp ties. */
export function activityLogBefore(field: string, prefix: string, before?: ActivityLogCursor) {
  if (!before) return {};
  const at = new Date(before.at);
  const tie = before.id.startsWith(prefix) ? { [field]: at, id: { lt: before.id.slice(prefix.length) } }
    : prefix < before.id ? { [field]: at } : null;
  return { OR: [{ [field]: { lt: at } }, ...(tie ? [tie] : [])] };
}
export async function listActivityLogs(user: CurrentUser, courseId: string, activityId: string, options: { groupId?: string; before?: ActivityLogCursor; limit?: number } = {}): Promise<ActivityLogPage> {
  const context = await activityReportScope(user, courseId, activityId, options.groupId);
  const limit = Math.min(100, Math.max(1, options.limit ?? 50));
  if (!context.participants.length) return { entries: [], nextCursor: null };
  const participantIds = context.participants.map(person => person.participantId);
  const where = { courseId, activityId, participantId: { in: participantIds } };
  const select = { id: true, participantId: true, groupId: true, userId: true, startedAt: true, submittedAt: true, attemptNumber: true };
  const [starts, submissions, grades, archived, privateEvents] = await Promise.all([
    prisma.activityAttempt.findMany({ where: { ...where, ...activityLogBefore("startedAt", "start:", options.before) }, select, orderBy: [{ startedAt: "desc" }, { id: "desc" }], take: limit + 1 }),
    prisma.activityAttempt.findMany({ where: { ...where, submittedAt: { not: null }, ...activityLogBefore("submittedAt", "submit:", options.before) }, select, orderBy: [{ submittedAt: "desc" }, { id: "desc" }], take: limit + 1 }),
    prisma.gradeEvent.findMany({ where: { gradebookItem: { courseId, activityId }, participantId: { in: participantIds }, ...activityLogBefore("createdAt", "grade:", options.before) },
      select: { id: true, participantId: true, eventType: true, actorUserId: true, reason: true, createdAt: true, gradebookItem: { select: { groupId: true } }, attempt: { select: { attemptNumber: true } } },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: limit + 1 }),
    // Reopening clears the live submittedAt; its immutable audit retains that earlier completion.
    prisma.$queryRaw<Array<{ id: string; at: Date; participantId: string; groupId: string; actorUserId: string | null; attemptNumber: number | null }>>`
      WITH archived AS (SELECT 'archive:'||e.id AS id,(e."previousValue"#>>'{attempt,submittedAt}')::timestamptz AS at,
        e."participantId",i."groupId",a."userId" AS "actorUserId",a."attemptNumber"
        FROM "GradeEvent" e JOIN "GradebookItem" i ON i.id=e."gradebookItemId" LEFT JOIN "ActivityAttempt" a ON a.id=e."attemptId"
        WHERE i."courseId"=${courseId} AND i."activityId"=${activityId} AND e."participantId"=ANY(${participantIds}::text[])
          AND e."eventType"='submission_reopened')
      SELECT * FROM archived WHERE at IS NOT NULL AND (${options.before?.at ?? null}::timestamptz IS NULL
        OR (at,id)<(${options.before?.at ?? null}::timestamptz,${options.before?.id ?? ""}::text)) ORDER BY at DESC,id DESC LIMIT ${limit + 1}`,
    getActivityReportService(context.activity.activityType.key)?.logs?.({ ...context, before: options.before, limit: limit + 1 }) ?? []
  ]);
  const evidence: ActivityLogEvidence[] = [
    ...starts.map(row => ({ id: `start:${row.id}`, at: row.startedAt.toISOString(), type: "attempt_started" as const, participantId: row.participantId, groupId: row.groupId, actorUserId: row.userId, attemptNumber: row.attemptNumber })),
    ...submissions.filter(row => row.submittedAt).map(row => ({ id: `submit:${row.id}`, at: row.submittedAt!.toISOString(), type: "submitted" as const, participantId: row.participantId, groupId: row.groupId, actorUserId: row.userId, attemptNumber: row.attemptNumber })),
    ...grades.map(row => ({ id: `grade:${row.id}`, at: row.createdAt.toISOString(), type: row.eventType, participantId: row.participantId, groupId: row.gradebookItem.groupId, actorUserId: row.actorUserId, reason: row.reason, attemptNumber: row.attempt?.attemptNumber })),
    ...archived.map(row => ({ ...row, at: row.at.toISOString(), type: "submitted" as const })),
    ...privateEvents
  ];
  const roster = new Map(context.participants.map(person => [`${person.groupId}:${person.participantId}`, person]));
  const sorted = [...new Map(evidence.filter(event => roster.has(`${event.groupId}:${event.participantId}`) && Number.isFinite(Date.parse(event.at)))
    .map(event => [event.id, { ...event, at: new Date(event.at).toISOString() }])).values()]
    .filter(event => !options.before || compareActivityLogs(event, options.before) > 0).sort(compareActivityLogs);
  const page = sorted.slice(0, limit);
  const actors = await prisma.user.findMany({ where: { id: { in: [...new Set(page.flatMap(event => event.actorUserId ? [event.actorUserId] : []))] } }, select: { id: true, firstName: true, lastName: true, name: true, email: true } });
  const names = new Map(actors.map(actor => [actor.id, [actor.firstName, actor.lastName].filter(Boolean).join(" ") || actor.name || actor.email]));
  return { entries: page.map(event => {
    const person = roster.get(`${event.groupId}:${event.participantId}`)!;
    // Explicit public projection: never return plugin metadata, answers, or grade snapshots.
    return { id: event.id, at: event.at, type: event.type, participantId: person.participantId, groupId: person.groupId,
      student: person.name, group: person.groupTitle, actor: event.actorUserId ? names.get(event.actorUserId) ?? null : null,
      ...(event.attemptNumber ? { attemptNumber: event.attemptNumber } : {}), ...(event.reason ? { reason: event.reason.slice(0, 2000) } : {}) };
  }), nextCursor: sorted.length > limit ? { at: page[page.length - 1].at, id: page[page.length - 1].id } : null };
}
