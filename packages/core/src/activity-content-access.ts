import type { CurrentUser } from "@cognelo/contracts";
import { prisma } from "@cognelo/db";
import { canManageCourse, canGradeGroup } from "./authorization";
import { AppError, forbidden, notFound } from "./errors";
import { applyAssignmentExceptions, applyGradebookExceptions, assignmentExceptionsForUser } from "./activity-assignment-exceptions";
import { assignmentAssessmentPolicyMode, assignmentAttemptExpiresAt, assignmentTimeLimitMinutes, courseActivityHidesAfterAttempts } from "./activity-assignment-policy";

type Attempt = { id: string; attemptNumber: number; lifecycle: string; startedAt: Date; submittedAt: Date | null };
type Policy = {
  availableUntil: Date | null; timeLimitMinutes: number | null; summative: boolean;
  gradesReleased: boolean; attemptLimitMode: string; maxAttempts: number | null;
};

export function resolveActivityContentLock(policy: Policy, attempts: Attempt[], now = new Date()) {
  const active = attempts.filter((attempt) => attempt.lifecycle !== "deleted");
  const deadlinePassed = Boolean(policy.availableUntil && policy.availableUntil.getTime() <= now.getTime());
  const started = active.filter((attempt) => attempt.lifecycle === "started");
  const canContinue = !deadlinePassed && started.some((attempt) => {
    const expires = assignmentAttemptExpiresAt(attempt.startedAt, policy.timeLimitMinutes, policy.availableUntil);
    return !expires || expires.getTime() > now.getTime();
  });
  const exhausted = policy.summative && policy.attemptLimitMode === "max_attempts"
    && policy.maxAttempts !== null && active.length >= policy.maxAttempts;
  return {
    locked: !canContinue && (deadlinePassed || exhausted || (policy.summative && policy.gradesReleased)),
    // Only declared submission/finalization routes may finish an expired started attempt.
    canFinalize: started.length > 0
  };
}

export async function getActivityContentAccess(user: CurrentUser, courseId: string, groupId: string, activityId: string) {
  const assignment = await prisma.courseGroupActivity.findFirst({
    where: { groupId, activityId, group: { courseId } },
    include: { activity: { select: { title: true, metadata: true } }, gradebookItem: true }
  });
  if (!assignment) throw notFound("Group activity assignment");
  const participant = await prisma.courseGroupParticipant.findFirst({ where: { groupId, userId: user.id }, select: { id: true, role: true } });
  const staff = await canManageCourse(user, courseId) || (participant?.role !== "student" && await canGradeGroup(user, courseId, groupId));
  if (!staff && participant?.role !== "student") throw forbidden();
  const enabled = courseActivityHidesAfterAttempts(assignment.activity.metadata);
  const base = { title: assignment.activity.title, enabled, locked: false, canFinalize: false,
    grade: null as { score: number; maxScore: number } | null,
    receipts: [] as Array<{ attemptNumber: number; submittedAt: string | null; deleted: boolean; reason?: string | null }> };
  if (staff || !enabled) return base;
  const overrides = (await assignmentExceptionsForUser([assignment.id], user.id)).get(assignment.id) ?? {};
  const effective = applyAssignmentExceptions(assignment, overrides);
  const item = assignment.gradebookItem ? applyGradebookExceptions(assignment.gradebookItem, overrides) : null;
  if (!item) throw new AppError(409, "GRADEBOOK_ITEM_MISSING", "The activity's attempt policy is unavailable.");
  const summative = assignmentAssessmentPolicyMode(effective.metadata) === "summative";
  const attempts = await prisma.activityAttempt.findMany({
    where: { groupActivityId: assignment.id, participantId: participant!.id, assessmentMode: summative ? "summative" : "formative" },
    select: { id: true, attemptNumber: true, lifecycle: true, startedAt: true, submittedAt: true },
    orderBy: { attemptNumber: "desc" }
  });
  const state = resolveActivityContentLock({
    availableUntil: effective.availableUntil, timeLimitMinutes: assignmentTimeLimitMinutes(effective.metadata), summative,
    gradesReleased: item.gradesReleased, attemptLimitMode: item.attemptLimitMode, maxAttempts: item.maxAttempts
  }, attempts);
  const deletedIds = attempts.filter((attempt) => attempt.lifecycle === "deleted").map((attempt) => attempt.id);
  const deletions = state.locked && deletedIds.length ? await prisma.gradeEvent.findMany({
    where: { gradebookItemId: item.id, participantId: participant!.id, eventType: "submission_deleted", attemptId: { in: deletedIds } },
    select: { attemptId: true, reason: true }, orderBy: { createdAt: "desc" }
  }) : [];
  const releasedGrade = state.locked && item.gradesReleased ? await prisma.grade.findFirst({
    where: { gradebookItemId: item.id, participantId: participant!.id, isActive: true },
    select: { normalizedScore: true, normalizedMaxScore: true, source: true }
  }) : null;
  const grade = releasedGrade?.normalizedScore !== null && releasedGrade?.normalizedScore !== undefined
    && (releasedGrade.source === "override" || attempts.some((attempt) => attempt.lifecycle === "submitted" || attempt.lifecycle === "graded"))
    ? { score: releasedGrade.normalizedScore, maxScore: releasedGrade.normalizedMaxScore } : null;
  return { ...base, ...state, grade, receipts: state.locked ? attempts.filter((attempt) => attempt.submittedAt).map((attempt) => ({
    attemptNumber: attempt.attemptNumber, submittedAt: attempt.submittedAt!.toISOString(), deleted: attempt.lifecycle === "deleted",
    ...(attempt.lifecycle === "deleted" ? { reason: deletions.find((entry) => entry.attemptId === attempt.id)?.reason ?? null } : {})
  })) : [] };
}

export async function assertActivityContentAccess(user: CurrentUser, courseId: string, groupId: string, activityId: string, options: { allowFinalization?: boolean } = {}) {
  const access = await getActivityContentAccess(user, courseId, groupId, activityId);
  if (access.locked && !(options.allowFinalization && access.canFinalize)) {
    throw new AppError(403, "ACTIVITY_CONTENT_CLOSED", "This activity is closed. Its questions and answers are no longer available.");
  }
  return access;
}
