import { assignmentTimeLimitException } from "./activity-assignment-policy";
import { randomUUID } from "node:crypto";
import { getActivityDefinition } from "@cognelo/activity-sdk";
import { getActivitySubmissionStagesHandler } from "@cognelo/activity-sdk/server";
import { SubmissionStagePoliciesSchema, defaultSubmissionStagePolicy, mergeSubmissionStagePolicies, submissionStageWindow, type SubmissionStagePolicies, type SubmissionStagePolicy } from "@cognelo/contracts";
import { AppError } from "./errors";
const record = (v: unknown): Record<string, unknown> => v && typeof v === "object" && !Array.isArray(v) ? v as Record<string, unknown> : {};
export function readSubmissionStagePolicies(value: unknown): SubmissionStagePolicies { return SubmissionStagePoliciesSchema.parse(value ?? {}); }
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
