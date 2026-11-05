import { getActivityDefinition } from "@cognelo/activity-sdk";
import { getActivityTeamworkHandler, type PluginTeamworkTransaction } from "@cognelo/activity-sdk/server";
import type { CurrentUser } from "@cognelo/contracts";
import { Prisma, prisma } from "@cognelo/db";
import { AppError } from "./errors";
import { enqueueBackgroundJob } from "./background-jobs";
import { randomUUID } from "node:crypto";

export type TeamworkDatabase = { $queryRaw<T = unknown>(query: TemplateStringsArray, ...values: unknown[]): Promise<T>; $executeRaw(query: TemplateStringsArray, ...values: unknown[]): Promise<number> };
const object = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
export type ActivityTeamAssignment = { groupingId: string; allowIndividualSubmission: boolean };
export function activityTeamAssignment(metadata: unknown): ActivityTeamAssignment | null {
  const value = object(object(metadata).teamwork);
  return typeof value.groupingId === "string" && value.groupingId ? { groupingId: value.groupingId, allowIndividualSubmission: value.allowIndividualSubmission === true } : null;
}
export function activityTeamworkEnabled(metadata: unknown) { return object(object(metadata).allGroupsAssignment).teamworkEnabled === true; }
export function teamworkTransaction(tx: TeamworkDatabase): PluginTeamworkTransaction {
  return { query: <T>(query: TemplateStringsArray, ...values: unknown[]) => tx.$queryRaw<T>(query, ...values), execute: (query, ...values) => tx.$executeRaw(query, ...values) };
}
export async function lockActivityTeamwork(tx: TeamworkDatabase, activityId: string) {
  await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtextextended(${`activity-teamwork:${activityId}`}, 0))`;
}
export async function lockStudentGroupingWorkspaces(tx: TeamworkDatabase, groupingId: string) {
  await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtextextended(${`student-grouping-workspaces:${groupingId}`}, 0))`;
}
export async function hasActiveTeamworkSubmissions(activityTypeKey: string, activityId: string, groupId?: string, tx: TeamworkDatabase = prisma) {
  if (!getActivityDefinition(activityTypeKey)?.supportsTeamwork) return false;
  const handler = getActivityTeamworkHandler(activityTypeKey);
  if (!handler) throw new AppError(409, "ACTIVITY_TEAMWORK_UNAVAILABLE", "This activity's team workspace service is unavailable.");
  return handler.hasActiveSubmissions({ activityId, groupId, transaction: teamworkTransaction(tx) });
}
export async function validateActivityTeamworkChange(tx: Prisma.TransactionClient, input: {
  activityId: string; activityTypeKey: string; groupId?: string; previousEnabled: boolean; enabled: boolean;
  previous?: ActivityTeamAssignment | null; next?: ActivityTeamAssignment | null;
}) {
  if (input.enabled && !getActivityDefinition(input.activityTypeKey)?.supportsTeamwork) throw new AppError(400, "ACTIVITY_TEAMWORK_UNSUPPORTED", "This activity does not support team submissions.");
  if (!getActivityDefinition(input.activityTypeKey)?.supportsTeamwork) return;
  await lockActivityTeamwork(tx, input.activityId);
  const changed = input.enabled !== input.previousEnabled || (input.groupId && JSON.stringify(input.previous ?? null) !== JSON.stringify(input.next ?? null));
  if (changed && await hasActiveTeamworkSubmissions(input.activityTypeKey, input.activityId, input.groupId, tx)) {
    throw new AppError(409, "ACTIVITY_TEAMWORK_LOCKED", "Cancel the affected submissions before changing team settings.");
  }
  if (input.enabled && input.groupId) {
    if (!input.next?.groupingId || !await tx.studentGrouping.findFirst({ where: { id: input.next.groupingId, groupId: input.groupId }, select: { id: true } })) {
      throw new AppError(400, "ACTIVITY_TEAM_GROUPING_REQUIRED", "Choose a grouping belonging to this section for team submissions.");
    }
  }
}

export type ActivityTeamContext = {
  enabled: boolean; participantId: string; groupingId: string | null; teamId: string | null;
  allowIndividualSubmission: boolean; teamTitle: string | null; visibleToStudents: boolean;
  membershipToken: string; workspaceEpoch: string;
  members: Array<{ participantId: string; userId: string | null; name: string; membershipToken: string }>;
};
export async function getTeamWorkspaceEpoch(tx: TeamworkDatabase, courseId: string, groupingId: string, teamId: string) {
  const [event] = await tx.$queryRaw<Array<{ id: string }>>`SELECT id FROM "CourseAuditEvent" WHERE "courseId"=${courseId} AND "targetId"=${groupingId} AND "eventType"='activity_team_membership_changed'
    AND metadata->'emptyTeamIds' ? ${teamId} ORDER BY (metadata->>'groupingRevision')::int DESC,"createdAt" DESC,id DESC LIMIT 1`;
  return event?.id ?? "initial";
}
/** Resolve current membership afresh; callers never supply a trusted team identity. */
export async function resolveActivityTeamContext(user: CurrentUser, courseId: string, groupId: string, activityId: string, tx: TeamworkDatabase = prisma): Promise<ActivityTeamContext> {
  const [assignment] = await tx.$queryRaw<Array<{ metadata: unknown; activityMetadata: unknown; activityTypeKey: string; participantId: string; membershipToken: string }>>`
    SELECT ga.metadata, a.metadata AS "activityMetadata", typ.key AS "activityTypeKey", p.id AS "participantId",
      COALESCE((SELECT e.id FROM "CourseAuditEvent" e WHERE e."courseId"=${courseId} AND e."targetId"=ga.metadata->'teamwork'->>'groupingId' AND e."eventType"='activity_team_membership_changed' AND e.metadata->'participantIds' ? p.id ORDER BY (e.metadata->>'groupingRevision')::int DESC,e."createdAt" DESC,e.id DESC LIMIT 1),'initial') AS "membershipToken"
    FROM "CourseGroupActivity" ga JOIN "Activity" a ON a.id=ga."activityId" JOIN "ActivityType" typ ON typ.id=a."activityTypeId"
    JOIN "CourseGroup" g ON g.id=ga."groupId" JOIN "CourseGroupParticipant" p ON p."groupId"=g.id AND p."userId"=${user.id} AND p.role='student'
    WHERE ga."activityId"=${activityId} AND ga."groupId"=${groupId} AND a."courseId"=${courseId} AND g."courseId"=${courseId}`;
  if (!assignment) throw new AppError(403, "ACTIVITY_TEAM_ENROLLMENT_REQUIRED", "Student enrollment is required for this workspace.");
  const enabled = getActivityDefinition(assignment.activityTypeKey)?.supportsTeamwork === true && activityTeamworkEnabled(assignment.activityMetadata);
  const base = { enabled, participantId: assignment.participantId, groupingId: null, teamId: null, allowIndividualSubmission: true, teamTitle: null, visibleToStudents: true, membershipToken: assignment.membershipToken ?? "initial", workspaceEpoch: "initial", members: [] };
  if (!enabled) return base;
  const policy = activityTeamAssignment(assignment.metadata);
  if (!policy) throw new AppError(409, "ACTIVITY_TEAM_GROUPING_REQUIRED", "Your teacher must select a grouping for this section.");
  const [grouping] = await tx.$queryRaw<Array<{ visibleToStudents: boolean }>>`SELECT "visibleToStudents" FROM "StudentGrouping" WHERE id=${policy.groupingId} AND "groupId"=${groupId}`;
  if (!grouping) throw new AppError(409, "ACTIVITY_TEAM_GROUPING_REQUIRED", "The assigned grouping is unavailable. Contact your teacher.");
  const [team] = await tx.$queryRaw<Array<{ id: string; title: string }>>`SELECT t.id, t.title FROM "StudentTeamMember" m JOIN "StudentTeam" t ON t.id=m."teamId" AND t."groupingId"=m."groupingId" WHERE m."participantId"=${assignment.participantId} AND m."groupingId"=${policy.groupingId}`;
  const members = team ? await tx.$queryRaw<Array<{ participantId: string; userId: string | null; name: string; membershipToken: string }>>`SELECT p.id AS "participantId", p."userId", trim(p."firstName" || ' ' || p."lastName") AS name,
    COALESCE((SELECT e.id FROM "CourseAuditEvent" e WHERE e."courseId"=${courseId} AND e."targetId"=${policy.groupingId} AND e."eventType"='activity_team_membership_changed' AND e.metadata->'participantIds' ? p.id ORDER BY (e.metadata->>'groupingRevision')::int DESC,e."createdAt" DESC,e.id DESC LIMIT 1),'initial') AS "membershipToken"
    FROM "StudentTeamMember" m JOIN "CourseGroupParticipant" p ON p.id=m."participantId" WHERE m."teamId"=${team.id} AND m."groupingId"=${policy.groupingId} AND p."groupId"=${groupId} AND p.role='student' ORDER BY p.id` : [];
  return { ...base, enabled: true, ...policy, teamId: team?.id ?? null, teamTitle: team?.title ?? null, visibleToStudents: grouping.visibleToStudents,
    workspaceEpoch: team ? await getTeamWorkspaceEpoch(tx, courseId, policy.groupingId, team.id) : base.membershipToken, members };
}

export type TeamMembershipSnapshot = { teamId: string; participantIds: string[] };
/** Runs after membership writes, inside the same host transaction. */
export async function notifyActivityTeamMembershipChanges(tx: Prisma.TransactionClient, user: CurrentUser, courseId: string, groupId: string, groupingId: string, previous: TeamMembershipSnapshot[], next: TeamMembershipSnapshot[], options: { removedParticipantIds?: string[]; groupingRemoved?: boolean } = {}) {
  const before = new Map(previous.flatMap(team => team.participantIds.map(id => [id, team.teamId] as const)));
  const after = new Map(next.flatMap(team => team.participantIds.map(id => [id, team.teamId] as const)));
  const removed = new Set(options.removedParticipantIds ?? []);
  if (options.groupingRemoved) for (const participant of await tx.courseGroupParticipant.findMany({ where: { groupId, role: "student" }, select: { id: true } })) removed.add(participant.id);
  const changedIds = [...new Set([...before.keys(), ...after.keys(), ...removed])].filter(id => before.get(id) !== after.get(id) || removed.has(id));
  const emptyTeamIds = previous.filter(team => team.participantIds.length && !next.some(value => value.teamId === team.teamId && value.participantIds.length)).map(team => team.teamId);
  if (!changedIds.length && !emptyTeamIds.length && !options.groupingRemoved) return;
  // Include retained work from an older assignment/configuration too. Only the
  // owning plugin knows whether it has private work for this grouping/section.
  const activities = await tx.activity.findMany({ where: { courseId }, include: { activityType: true, groupAssignments: { where: { groupId }, select: { metadata: true } } } });
  const applicable = activities.filter(value => getActivityDefinition(value.activityType.key)?.supportsTeamwork);
  if (!applicable.length && !activities.some(value => activityTeamworkEnabled(value.metadata))) return;
  const participants = await tx.courseGroupParticipant.findMany({ where: { id: { in: changedIds }, groupId }, select: { id: true, userId: true } });
  const changes = changedIds.map(participantId => ({ participantId, userId: participants.find(p => p.id === participantId)?.userId ?? null, previousTeamId: before.get(participantId) ?? null, teamId: after.get(participantId) ?? null, ...(removed.has(participantId) ? { removed: true } : {}) }));
  const [revision] = await tx.$queryRaw<Array<{ revision: number }>>`SELECT revision FROM "StudentGrouping" WHERE id=${groupingId}`;
  const membershipToken = randomUUID();
  await tx.courseAuditEvent.create({ data: { id: membershipToken, courseId, actorUserId: user.id, eventType: "activity_team_membership_changed", targetType: "student_grouping", targetId: groupingId,
    nextValue: { changes, emptyTeamIds }, metadata: { groupId, groupingRevision: revision?.revision ?? 0, participantIds: changedIds, emptyTeamIds }, createdAt: new Date() } });
  const teamWorkspaceEpochs: Record<string, string> = {};
  for (const teamId of new Set(changes.flatMap(change => change.teamId ? [change.teamId] : []))) teamWorkspaceEpochs[teamId] = await getTeamWorkspaceEpoch(tx, courseId, groupingId, teamId);
  for (const activity of applicable) {
    const handler = getActivityTeamworkHandler(activity.activityType.key);
    if (!handler) throw new AppError(409, "ACTIVITY_TEAMWORK_UNAVAILABLE", "The team workspace service is unavailable. Try again before changing memberships.");
    const result = await handler.membershipChanged({ user, courseId, groupId, groupingId, activityId: activity.id,
      assignment: activityTeamworkEnabled(activity.metadata) ? activityTeamAssignment(activity.groupAssignments[0]?.metadata) : null,
      changes, emptyTeamIds, membershipToken, teamWorkspaceEpochs, ...(options.groupingRemoved ? { groupingRemoved: true } : {}),
      transaction: teamworkTransaction(tx), enqueue: async job => { await enqueueBackgroundJob(job, tx); } });
    const coreAttempts = await tx.activityAttempt.findMany({ where: { courseId, groupId, activityId: activity.id, participantId: { in: changedIds }, lifecycle: { in: ["started", "submitted", "graded"] }, metadata: { path: ["teamwork", "groupingId"], equals: groupingId } }, select: { id: true } });
    const withdrawn = [...(result.withdrawAttemptIds ?? []), ...coreAttempts.map(attempt => attempt.id)];
    if (withdrawn.length) {
      const { deleteActivitySubmission } = await import("./gradebook");
      for (const attemptId of new Set(withdrawn)) {
        const attempt = await tx.activityAttempt.findFirst({ where: { id: attemptId, courseId, groupId, activityId: activity.id, participantId: { in: changedIds }, lifecycle: { not: "deleted" } }, select: { id: true } });
        if (attempt) await deleteActivitySubmission(user, courseId, { attemptId, reason: "Team membership changed; previous workspace participation was withdrawn." }, { allowStartedReplacement: true, transaction: tx, membershipChange: { groupId, participantIds: changedIds } });
      }
    }
  }
}

/** Roster removal/section deletion must revoke private work before FK cascades. */
export async function removeStudentTeamWorkspaceMemberships(tx: Prisma.TransactionClient, user: CurrentUser, courseId: string, groupId: string, participantIds?: string[]) {
  const groupings = await tx.studentGrouping.findMany({ where: { groupId }, orderBy: { id: "asc" }, select: { id: true } });
  for (const entry of groupings) {
    await lockStudentGroupingWorkspaces(tx, entry.id);
    const grouping = await tx.studentGrouping.findUnique({ where: { id: entry.id }, include: { teams: { include: { members: { select: { participantId: true } } } } } });
    if (!grouping) continue;
    const previous = grouping.teams.map(team => ({ teamId: team.id, participantIds: team.members.map(member => member.participantId) }));
    const removed = participantIds ?? [...new Set(previous.flatMap(team => team.participantIds))];
    await tx.studentTeamMember.deleteMany({ where: { groupingId: grouping.id, ...(participantIds ? { participantId: { in: participantIds } } : {}) } });
    await tx.studentGrouping.updateMany({ where: { id: grouping.id }, data: { revision: { increment: 1 } } });
    await notifyActivityTeamMembershipChanges(tx, user, courseId, groupId, grouping.id, previous,
      participantIds ? previous.map(team => ({ teamId: team.teamId, participantIds: team.participantIds.filter(id => !removed.includes(id)) })) : [],
      { removedParticipantIds: removed, groupingRemoved: !participantIds });
  }
}
