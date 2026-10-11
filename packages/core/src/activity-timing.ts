import type { CurrentUser } from "@cognelo/contracts";
import { prisma } from "@cognelo/db";
import { assignmentTimeLimitMinutes } from "./activity-assignment-policy";
import {
  activityAttemptTimeLimitMinutes,
  getActivityAttemptAvailability,
  startActivityAttempt,
  submitActivityAttempt
} from "./gradebook";
import { AppError } from "./errors";
import { getGroupAssignedActivity } from "./groups";
import { canManageCourse } from "./authorization";

export async function getTimedActivityRuntime(
  user: CurrentUser,
  courseId: string,
  groupId: string,
  activityId: string
) {
  const context = await resolveTimedActivityContext(user, courseId, groupId, activityId);
  const activeAttempt = await findActiveAttempt(context.assignmentId, context.participantId);
  const snapshotLimit = activeAttempt ? activityAttemptTimeLimitMinutes(activeAttempt.metadata) : null;
  const timeLimitMinutes = snapshotLimit ?? assignmentTimeLimitMinutes(context.assignmentMetadata);
  const expiresAt = activeAttempt && snapshotLimit
    ? new Date(activeAttempt.startedAt.getTime() + snapshotLimit * 60_000)
    : null;
  return {
    timeLimitMinutes,
    attempt: activeAttempt ? {
      id: activeAttempt.id,
      attemptNumber: activeAttempt.attemptNumber,
      lifecycle: activeAttempt.lifecycle,
      startedAt: activeAttempt.startedAt.toISOString()
    } : null,
    timing: {
      expiresAt: expiresAt?.toISOString() ?? null,
      remainingSeconds: expiresAt ? Math.max(0, Math.ceil((expiresAt.getTime() - Date.now()) / 1000)) : null,
      isExpired: Boolean(expiresAt && expiresAt.getTime() <= Date.now())
    },
    availability: await getActivityAttemptAvailability(user, { courseId, groupId, activityId })
  };
}

export async function startOrResumeTimedActivityAttempt(
  user: CurrentUser,
  courseId: string,
  groupId: string,
  activityId: string
) {
  const context = await resolveTimedActivityContext(user, courseId, groupId, activityId);
  const existing = await findActiveAttempt(context.assignmentId, context.participantId);
  if (!existing) {
    const timeLimitMinutes = assignmentTimeLimitMinutes(context.assignmentMetadata);
    if (!timeLimitMinutes) {
      throw new AppError(409, "ACTIVITY_TIME_LIMIT_DISABLED", "This activity does not have a time limit.");
    }
    const pluginKey = context.providerKind === "plugin"
      ? context.providerKey
      : `core:${context.activityTypeKey}`;
    if (!pluginKey) {
      throw new AppError(409, "ACTIVITY_RUNTIME_MISSING", "This activity does not have a submission runtime.");
    }
    await startActivityAttempt(user, {
      courseId,
      groupId,
      activityId,
      pluginKey,
      pluginVersion: "0.1.0",
      metadata: {
        timeLimitSnapshotMinutes: timeLimitMinutes,
        timedAttempt: true
      }
    });
  }
  return getTimedActivityRuntime(user, courseId, groupId, activityId);
}

export async function finalizeExpiredTimedActivityAttempt(
  user: CurrentUser,
  courseId: string,
  groupId: string,
  activityId: string
) {
  const context = await resolveTimedActivityContext(user, courseId, groupId, activityId);
  const activeAttempt = await findActiveAttempt(context.assignmentId, context.participantId);
  if (!activeAttempt) {
    return getTimedActivityRuntime(user, courseId, groupId, activityId);
  }
  const timeLimitMinutes = activityAttemptTimeLimitMinutes(activeAttempt.metadata);
  if (!timeLimitMinutes || Date.now() < activeAttempt.startedAt.getTime() + timeLimitMinutes * 60_000) {
    throw new AppError(409, "ACTIVITY_TIME_LIMIT_ACTIVE", "The timed attempt has not expired.");
  }
  const draft = await prisma.activityResponseDraft.findUnique({
    where: {
      groupActivityId_participantId: {
        groupActivityId: context.assignmentId,
        participantId: context.participantId
      }
    },
    select: { state: true }
  });
  await submitActivityAttempt(user, {
    attemptId: activeAttempt.id,
    metadata: {
      ...(asRecord(activeAttempt.metadata)),
      timedOut: true,
      ...(draft ? { savedResponse: draft.state } : {})
    }
  });
  return getTimedActivityRuntime(user, courseId, groupId, activityId);
}

export async function assertTimedActivityWriteAllowed(
  user: CurrentUser,
  courseId: string,
  groupId: string,
  activityId: string,
  options: { allowExpiredAttempt?: boolean } = {}
) {
  if (await canManageCourse(user, courseId)) return;
  const context = await resolveTimedActivityContext(user, courseId, groupId, activityId);
  const activeAttempt = await findActiveAttempt(context.assignmentId, context.participantId);
  if (!activeAttempt) {
    if (assignmentTimeLimitMinutes(context.assignmentMetadata)) {
      throw new AppError(409, "TIMED_ACTIVITY_NOT_STARTED", "Start the timed attempt before changing or submitting a response.");
    }
    return;
  }
  const timeLimitMinutes = activityAttemptTimeLimitMinutes(activeAttempt.metadata);
  if (
    !options.allowExpiredAttempt &&
    timeLimitMinutes &&
    Date.now() >= activeAttempt.startedAt.getTime() + timeLimitMinutes * 60_000
  ) {
    throw new AppError(409, "ACTIVITY_TIME_LIMIT_EXPIRED", "The activity time limit has expired. Submit the saved response to finish the attempt.");
  }
}

async function resolveTimedActivityContext(
  user: CurrentUser,
  courseId: string,
  groupId: string,
  activityId: string
) {
  const activity = await getGroupAssignedActivity(user, courseId, groupId, activityId);
  if (activity.activityType.key === "test") {
    throw new AppError(400, "TEST_TIMING_ROUTE_UNSUPPORTED", "Tests use the compound Test timing runtime.");
  }
  const participant = await prisma.courseGroupParticipant.findFirst({
    where: { groupId, userId: user.id, role: "student" },
    select: { id: true }
  });
  if (!participant) {
    throw new AppError(403, "PARTICIPANT_REQUIRED", "Only enrolled students can start a timed activity.");
  }
  return {
    assignmentId: activity.assignment.id,
    assignmentMetadata: activity.assignment.metadata,
    participantId: participant.id,
    activityTypeKey: activity.activityType.key,
    providerKind: activity.activityType.providerKind,
    providerKey: activity.activityType.providerKey
  };
}

async function findActiveAttempt(groupActivityId: string, participantId: string) {
  const attempts = await prisma.activityAttempt.findMany({
    where: { groupActivityId, participantId, lifecycle: "started" },
    orderBy: [{ attemptNumber: "desc" }]
  });
  return attempts.find((attempt) => activityAttemptTimeLimitMinutes(attempt.metadata) !== null) ?? null;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
