import { assignmentTimeLimitException } from "./activity-assignment-policy";
import { randomUUID } from "node:crypto";
import { getActivityDefinition } from "@cognelo/activity-sdk";
import { getActivitySubmissionStagesHandler, type PluginTeamworkTransaction } from "@cognelo/activity-sdk/server";
import { SubmissionStagePoliciesSchema, defaultSubmissionStagePolicy, mergeSubmissionStagePolicies, submissionStageWindow, type SubmissionStagePolicies, type SubmissionStagePolicy } from "@cognelo/contracts";
import { AppError } from "./errors";
const record = (v: unknown): Record<string, unknown> => v && typeof v === "object" && !Array.isArray(v) ? v as Record<string, unknown> : {};
export function readSubmissionStagePolicies(value: unknown): SubmissionStagePolicies { return SubmissionStagePoliciesSchema.parse(value ?? {}); }
/** New placements start closed; older records without these keys retain legacy defaults. */
export function initialSubmissionStageMetadata(typeKey: string, value: unknown) {
  const metadata = record(value), stages = getActivityDefinition(typeKey)?.submissionStages ?? [];
  if (!stages.length) return metadata;
  const rule = record(metadata.allGroupsAssignment);
  return { ...metadata, allGroupsAssignment: { ...rule, submissionStages: mergeSubmissionStagePolicies(
    readSubmissionStagePolicies(rule.submissionStages), Object.fromEntries(stages.map(stage => [stage.id, { enabled: false }]))
  ) } };
}
export function configuredSubmissionStageActivations(configuration: Awaited<ReturnType<typeof getActivitySubmissionStageConfiguration>>, general: SubmissionStagePolicies, groups: ReadonlyArray<{ assigned: boolean; submissionStages?: SubmissionStagePolicies; exceptions?: ReadonlyArray<{ submissionStages?: SubmissionStagePolicies }> }>) {
  return Object.fromEntries(configuration.stages.map(stage => {
    const enabled = (policies: SubmissionStagePolicies) => ({ ...defaultSubmissionStagePolicy, ...policies[stage.id] }).enabled !== false;
    return [stage.id, stage.active && (enabled(general) || groups.some(group => group.assigned && (
      enabled(mergeSubmissionStagePolicies(general, group.submissionStages)) || group.exceptions?.some(exception => enabled(mergeSubmissionStagePolicies(general, group.submissionStages, exception.submissionStages)))
    )))];
  }));
}
export async function configuredActivityStageActivations(transaction: { $queryRaw: PluginTeamworkTransaction["query"] }, activityId: string, configuration: Awaited<ReturnType<typeof getActivitySubmissionStageConfiguration>>) {
  const [activity] = await transaction.$queryRaw<Array<{ metadata: unknown }>>`SELECT metadata FROM "Activity" WHERE id=${activityId}`;
  const assignments = await transaction.$queryRaw<Array<{ metadata: unknown; exceptions: unknown }>>`SELECT ga.metadata,COALESCE(jsonb_agg(e.settings) FILTER (WHERE e.id IS NOT NULL),'[]'::jsonb) AS exceptions
    FROM "CourseGroupActivity" ga LEFT JOIN "ActivityAssignmentException" e ON e."groupActivityId"=ga.id WHERE ga."activityId"=${activityId} GROUP BY ga.id`;
  const general = mergeSubmissionStagePolicies(configuration.defaults, readSubmissionStagePolicies(record(record(activity?.metadata).allGroupsAssignment).submissionStages));
  return configuredSubmissionStageActivations(configuration, general, assignments.map(assignment => ({ assigned: true,
    submissionStages: readSubmissionStagePolicies(record(assignment.metadata).submissionStages), exceptions: (Array.isArray(assignment.exceptions) ? assignment.exceptions : []).map(settings => ({ submissionStages: readSubmissionStagePolicies(record(settings).submissionStages) })) })));
}
/** Neutral tagged SQL supports both core and plugin-owned transactions. */
export function submissionStageActivationResolver(transaction: { $queryRaw: PluginTeamworkTransaction["query"] }, activityId: string, configuration: Awaited<ReturnType<typeof getActivitySubmissionStageConfiguration>>) {
  return async ({ groupId, userId, stageId }: { groupId: string; userId: string; stageId: string }) => {
    const stage = configuration.stages.find(stage => stage.id === stageId);
    if (!stage?.active) return false;
    const [row] = await transaction.$queryRaw<Array<{ activityMetadata: unknown; assignmentMetadata: unknown; assignmentId: string; participantId: string }>>`
      SELECT a.metadata AS "activityMetadata",ga.metadata AS "assignmentMetadata",ga.id AS "assignmentId",p.id AS "participantId"
      FROM "Activity" a JOIN "CourseGroupActivity" ga ON ga."activityId"=a.id AND ga."groupId"=${groupId}
      JOIN "CourseGroup" g ON g.id=ga."groupId" AND g."courseId"=a."courseId"
      JOIN "CourseGroupParticipant" p ON p."groupId"=ga."groupId" AND p."userId"=${userId} AND p.role='student'
      JOIN "User" u ON u.id=p."userId" AND u."isActive"=TRUE WHERE a.id=${activityId}`;
    if (!row) return false;
    const exceptions = await transaction.$queryRaw<Array<{ settings: unknown }>>`SELECT e.settings FROM "ActivityAssignmentException" e
      WHERE e."groupActivityId"=${row.assignmentId} AND (e."participantId"=${row.participantId} OR EXISTS(
        SELECT 1 FROM "StudentTeamMember" m WHERE m."teamId"=e."teamId" AND m."participantId"=${row.participantId}))
      ORDER BY (e."participantId" IS NOT NULL),e.priority DESC,e.id`;
    const policies = mergeSubmissionStagePolicies(configuration.defaults, readSubmissionStagePolicies(record(record(row.activityMetadata).allGroupsAssignment).submissionStages),
      readSubmissionStagePolicies(record(row.assignmentMetadata).submissionStages), ...exceptions.map(exception => readSubmissionStagePolicies(record(exception.settings).submissionStages)));
    return policies[stageId]?.enabled !== false;
  };
}
export function legacyGeneralStagePolicies(typeKey: string, minutes: unknown): SubmissionStagePolicies {
  const stage = getActivityDefinition(typeKey)?.submissionStages?.find(stage => stage.assessment);
  return stage ? { [stage.id]: { timeLimitMinutes: typeof minutes === "number" && Number.isInteger(minutes) && minutes > 0 && minutes <= 1440 ? minutes : null } } : {};
}
export function legacySectionStageOverrides(typeKey: string, value: unknown, fields?: readonly string[]): SubmissionStagePolicies {
  const metadata = record(value);
  if (Object.prototype.hasOwnProperty.call(metadata, "submissionStageOverrides")) return readSubmissionStagePolicies(metadata.submissionStageOverrides);
  const assessment = getActivityDefinition(typeKey)?.submissionStages?.find(stage => stage.assessment);
  if (assessment && record(record(metadata.submissionStages)[assessment.id]).timeLimitMinutes === null) return { [assessment.id]: { timeLimitMinutes: null } };
  const overrides = fields ?? (Array.isArray(metadata.overrideFields) ? metadata.overrideFields as string[] : undefined);
  return (overrides ? overrides.includes("timeLimit") : Object.prototype.hasOwnProperty.call(metadata, "timeLimitMinutes")) ? legacyGeneralStagePolicies(typeKey, metadata.timeLimitMinutes) : {};
}
export async function getActivitySubmissionStageConfiguration(activity: { id: string; activityType: { key: string } }) {
  const declared = getActivityDefinition(activity.activityType?.key ?? "")?.submissionStages ?? [];
  if (!declared.length) return { stages: [], defaults: {} as SubmissionStagePolicies };
  const configuration = await getActivitySubmissionStagesHandler(activity.activityType.key)?.configuration({ activityId: activity.id });
  const active = configuration?.activeStageIds;
  return { stages: declared.map(stage => ({ ...stage, active: !active || active.includes(stage.id) })), defaults: readSubmissionStagePolicies(configuration?.defaults) };
}
export function validateSubmissionStagePolicies(typeKey: string, policies: SubmissionStagePolicies | undefined, availableFrom?: string | null, activeStageIds?: readonly string[]) {
  const stages = getActivityDefinition(typeKey)?.submissionStages ?? [];
  for (const [id, value] of Object.entries(policies ?? {})) {
    const stage = stages.find(stage => stage.id === id);
    if (!stage) throw new AppError(400, "SUBMISSION_STAGE_UNKNOWN", "Choose a declared submission stage.");
    if ((value.allowLate === true || value.lateLimitMinutes != null) && !stage.allowsLateSubmissions) throw new AppError(400, "SUBMISSION_STAGE_LATE_UNSUPPORTED", "This stage does not accept late submissions.");
    if ((!activeStageIds || activeStageIds.includes(id)) && availableFrom && value.deadline && Date.parse(value.deadline) < Date.parse(availableFrom)) throw new AppError(400, "SUBMISSION_STAGE_BEFORE_OPENING", "A stage deadline cannot precede the activity opening.");
  }
}
export async function resolveActivitySubmissionStage(activity: { id: string; activityType: { key: string }; metadata?: unknown }, assignment: { metadata: unknown; availableUntil?: Date | string | null }, stageId: string) {
  const configuration = await getActivitySubmissionStageConfiguration(activity), metadata = record(assignment.metadata);
  const stage = configuration.stages.find(stage => stage.id === stageId);
  if (!stage) throw new AppError(400, "SUBMISSION_STAGE_UNKNOWN", "The submission stage is unavailable.");
  const general = record(record(activity.metadata).allGroupsAssignment);
  const legacyFields = !Array.isArray(metadata.overrideFields) && (metadata.timeLimitMinutes ?? null) === (general.timeLimitMinutes ?? null) ? [] : undefined;
  const legacyException = Object.prototype.hasOwnProperty.call(metadata, assignmentTimeLimitException) ? legacyGeneralStagePolicies(activity.activityType.key, Reflect.get(metadata, assignmentTimeLimitException)) : {};
  const policies = mergeSubmissionStagePolicies(configuration.defaults, legacyGeneralStagePolicies(activity.activityType.key, general.timeLimitMinutes), readSubmissionStagePolicies(general.submissionStages), readSubmissionStagePolicies(metadata.submissionStages), legacySectionStageOverrides(activity.activityType.key, metadata, legacyFields), legacyException, readSubmissionStagePolicies(metadata.submissionStageExceptionOverrides));
  const policy: SubmissionStagePolicy = { ...defaultSubmissionStagePolicy, ...policies[stageId] };
  // Existing general time limits remain the legacy default for the answering stage.
  if (stage.assessment && !Object.prototype.hasOwnProperty.call(policies[stageId] ?? {}, "timeLimitMinutes")) policy.timeLimitMinutes = typeof metadata.timeLimitMinutes === "number" ? metadata.timeLimitMinutes : null;
  return { stage, policy, availableUntil: assignment.availableUntil ?? null, window: submissionStageWindow(policy, assignment.availableUntil ?? null) };
}
export async function assertActivitySubmissionStageEnabled(activity: { id: string; activityType: { key: string }; metadata?: unknown }, assignment: { metadata: unknown; availableUntil?: Date | string | null }, stageId: string) {
  const resolved = await resolveActivitySubmissionStage(activity, assignment, stageId);
  if (!resolved.stage.active || resolved.policy.enabled === false) throw new AppError(409, "SUBMISSION_STAGE_NOT_ACTIVATED", "This stage is awaiting teacher activation.", { stageId });
  return resolved;
}
export async function activityAssessmentStageAssignment<T extends { metadata: unknown; availableUntil?: Date | null }>(activity: { id: string; activityType: { key: string }; metadata?: unknown }, assignment: T): Promise<T> {
  const definition = getActivityDefinition(activity.activityType?.key ?? ""), stage = definition?.submissionStages?.find(stage => stage.assessment);
  if (!stage) return assignment;
  const resolved = await resolveActivitySubmissionStage(activity, assignment, stage.id);
  if (!resolved.stage.active) return { ...assignment, metadata: { ...record(assignment.metadata), timeLimitMinutes: null } };
  return { ...assignment, availableUntil: resolved.window.closesAt ? new Date(resolved.window.closesAt) : null,
    metadata: { ...record(assignment.metadata), timeLimitMinutes: resolved.policy.timeLimitMinutes, submissionAssessmentStage: stage.id, submissionStageDeadline: resolved.window.deadline } };
}

/** Compatibility bridge for plugin-owned legacy policy endpoints. Core owns all new writes. */
export async function updateCourseActivitySubmissionStage(scope: { user: import("@cognelo/contracts").CurrentUser; courseId: string; activityId: string }, stageId: string, patch: Partial<SubmissionStagePolicy>, transaction?: Pick<import("@cognelo/db").Prisma.TransactionClient, "$queryRaw" | "$executeRaw">) {
  const { assertCanManageCourse } = await import("./authorization"), { prisma } = await import("@cognelo/db");
  await assertCanManageCourse(scope.user, scope.courseId);
  const apply = async (tx: Pick<import("@cognelo/db").Prisma.TransactionClient, "$queryRaw" | "$executeRaw">) => {
    const [activity] = await tx.$queryRaw<Array<{ id: string; metadata: unknown; typeKey: string }>>`SELECT a.id,a.metadata,t.key AS "typeKey" FROM "Activity" a JOIN "ActivityType" t ON t.id=a."activityTypeId" WHERE a.id=${scope.activityId} AND a."courseId"=${scope.courseId} FOR UPDATE OF a`;
    if (!activity) throw new AppError(404, "ACTIVITY_NOT_FOUND", "The activity was not found.");
    validateSubmissionStagePolicies(activity.typeKey, { [stageId]: patch });
    const metadata = record(activity.metadata), rule = record(metadata.allGroupsAssignment);
    const policies = mergeSubmissionStagePolicies(legacyGeneralStagePolicies(activity.typeKey, rule.timeLimitMinutes), readSubmissionStagePolicies(rule.submissionStages), { [stageId]: patch });
    await tx.$executeRaw`UPDATE "Activity" SET metadata=${JSON.stringify({ ...metadata, allGroupsAssignment: { ...rule, submissionStages: policies } })}::jsonb,"updatedAt"=NOW() WHERE id=${activity.id}`;
    const groups = await tx.$queryRaw<Array<{ id: string; metadata: unknown }>>`SELECT id,metadata FROM "CourseGroupActivity" WHERE "activityId"=${activity.id} FOR UPDATE`;
    for (const group of groups) {
      const previous = record(group.metadata), overrides = legacySectionStageOverrides(activity.typeKey, previous);
      const next = mergeSubmissionStagePolicies(readSubmissionStagePolicies(previous.submissionStages), policies, overrides);
      await tx.$executeRaw`UPDATE "CourseGroupActivity" SET metadata=${JSON.stringify({ ...previous, submissionStages: next, submissionStageOverrides: overrides })}::jsonb,"updatedAt"=NOW() WHERE id=${group.id}`;
    }
    await tx.$executeRaw`INSERT INTO "CourseAuditEvent" (id,"courseId","actorUserId","eventType","targetType","targetId","previousValue","nextValue","createdAt") VALUES (${randomUUID()},${scope.courseId},${scope.user.id},'activity_stage_schedule_updated','activity',${activity.id},${JSON.stringify(rule.submissionStages ?? {})}::jsonb,${JSON.stringify(policies)}::jsonb,NOW())`;
  };
  if (transaction) await apply(transaction); else await prisma.$transaction(apply);
}
export async function getCourseActivitySubmissionStage(scope: { user: import("@cognelo/contracts").CurrentUser; courseId: string; activityId: string }, stageId: string) {
  const { assertCanManageCourse } = await import("./authorization"), { prisma } = await import("@cognelo/db");
  await assertCanManageCourse(scope.user, scope.courseId);
  const activity = await prisma.activity.findFirstOrThrow({ where: { id: scope.activityId, courseId: scope.courseId }, include: { activityType: true } });
  const rule = record(record(activity.metadata).allGroupsAssignment);
  return resolveActivitySubmissionStage(activity, { metadata: { submissionStages: rule.submissionStages, submissionStageOverrides: {}, timeLimitMinutes: rule.timeLimitMinutes }, availableUntil: typeof rule.availableUntil === "string" ? rule.availableUntil : null }, stageId);
}
