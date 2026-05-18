import { prisma, type Prisma } from "@cognelo/db";
import type { CurrentUser } from "@cognelo/contracts";
import { canManageCourse } from "./authorization";
import { AppError, forbidden, notFound } from "./errors";

type JsonInput = Prisma.InputJsonValue;
type ActivityAttemptSource = {
  courseId: string;
  groupId: string;
  activityId: string;
};

export type StartActivityAttemptInput = ActivityAttemptSource & {
  participantId?: string;
  pluginKey: string;
  pluginVersion: string;
  pluginAttemptRef?: string | null;
  activityConfigFingerprint?: string | null;
  metadata?: JsonInput;
  now?: Date;
};

export type SubmitActivityAttemptInput = {
  attemptId: string;
  pluginAttemptRef?: string | null;
  metadata?: JsonInput;
  now?: Date;
};

export type RecordActivityAttemptGradingResultInput = {
  attemptId: string;
  rawScore: number;
  rawMaxScore: number;
  normalizedScore: number;
  normalizedMaxScore: number;
  source: "auto" | "manual" | "override" | "regrade";
  isPass?: boolean | null;
  rawResult?: JsonInput;
  normalizedResult?: JsonInput;
  metadata?: JsonInput;
  reason?: string | null;
  now?: Date;
};

export async function startActivityAttempt(user: CurrentUser, input: StartActivityAttemptInput) {
  const now = input.now ?? new Date();
  const context = await resolveAssignedActivityAttemptContext(user, input);
  await assertAttemptCanStart(context, now);

  return prisma.$transaction(async (tx) => {
    const latestAttempt = await tx.activityAttempt.findFirst({
      where: {
        gradebookItemId: context.gradebookItem.id,
        participantId: context.participant.id
      },
      orderBy: { attemptNumber: "desc" },
      select: { attemptNumber: true }
    });

    const attemptNumber = (latestAttempt?.attemptNumber ?? 0) + 1;
    return tx.activityAttempt.create({
      data: {
        courseId: context.courseId,
        groupId: input.groupId,
        groupActivityId: context.groupActivity.id,
        activityId: input.activityId,
        gradebookItemId: context.gradebookItem.id,
        participantId: context.participant.id,
        userId: context.participant.userId,
        attemptNumber,
        startedAt: now,
        activityVersionId: context.groupActivity.activity.activityVersionId,
        activityConfigFingerprint: input.activityConfigFingerprint ?? null,
        pluginKey: input.pluginKey,
        pluginVersion: input.pluginVersion,
        pluginAttemptRef: input.pluginAttemptRef ?? null,
        metadata: (input.metadata ?? {}) as JsonInput
      }
    });
  });
}

export async function submitActivityAttempt(user: CurrentUser, input: SubmitActivityAttemptInput) {
  const now = input.now ?? new Date();
  const attempt = await prisma.activityAttempt.findUnique({
    where: { id: input.attemptId },
    include: {
      gradebookItem: true,
      groupActivity: true,
      participant: true
    }
  });

  if (!attempt) {
    throw notFound("Activity attempt");
  }
  await assertCanUseAttempt(user, attempt.courseId, attempt.participant);

  if (attempt.lifecycle === "graded") {
    throw new AppError(400, "ACTIVITY_ATTEMPT_ALREADY_GRADED", "This attempt has already been graded.");
  }

  const lateness = computeAttemptLateness(attempt.groupActivity.availableUntil, attempt.gradebookItem.lateGracePeriodMinutes, now);
  const durationSeconds = Math.max(0, Math.round((now.getTime() - attempt.startedAt.getTime()) / 1000));

  return prisma.activityAttempt.update({
    where: { id: attempt.id },
    data: {
      lifecycle: "submitted",
      submittedAt: now,
      durationSeconds,
      isLate: lateness.isLate,
      lateBySeconds: lateness.lateBySeconds,
      pluginAttemptRef: input.pluginAttemptRef ?? attempt.pluginAttemptRef,
      metadata: input.metadata === undefined ? undefined : (input.metadata as JsonInput)
    }
  });
}

export async function recordActivityAttemptGradingResult(user: CurrentUser, input: RecordActivityAttemptGradingResultInput) {
  const now = input.now ?? new Date();
  const attempt = await prisma.activityAttempt.findUnique({
    where: { id: input.attemptId },
    include: {
      participant: true,
      gradebookItem: true
    }
  });

  if (!attempt) {
    throw notFound("Activity attempt");
  }
  await assertCanUseAttempt(user, attempt.courseId, attempt.participant);

  return prisma.$transaction(async (tx) => {
    const previousGrade = await tx.grade.findUnique({
      where: {
        gradebookItemId_participantId: {
          gradebookItemId: attempt.gradebookItemId,
          participantId: attempt.participantId
        }
      }
    });

    const grade = await tx.grade.upsert({
      where: {
        gradebookItemId_participantId: {
          gradebookItemId: attempt.gradebookItemId,
          participantId: attempt.participantId
        }
      },
      update: {
        selectedAttemptId: attempt.id,
        rawScore: input.rawScore,
        rawMaxScore: input.rawMaxScore,
        normalizedScore: input.normalizedScore,
        normalizedMaxScore: input.normalizedMaxScore,
        isPass: input.isPass ?? null,
        gradedByUserId: user.id,
        gradedAt: now,
        source: input.source,
        rawResult: (input.rawResult ?? {}) as JsonInput,
        normalizedResult: (input.normalizedResult ?? {}) as JsonInput,
        metadata: (input.metadata ?? {}) as JsonInput
      },
      create: {
        gradebookItemId: attempt.gradebookItemId,
        participantId: attempt.participantId,
        userId: attempt.userId,
        selectedAttemptId: attempt.id,
        rawScore: input.rawScore,
        rawMaxScore: input.rawMaxScore,
        normalizedScore: input.normalizedScore,
        normalizedMaxScore: input.normalizedMaxScore,
        isPass: input.isPass ?? null,
        gradedByUserId: user.id,
        gradedAt: now,
        source: input.source,
        rawResult: (input.rawResult ?? {}) as JsonInput,
        normalizedResult: (input.normalizedResult ?? {}) as JsonInput,
        metadata: (input.metadata ?? {}) as JsonInput
      }
    });

    const gradedAttempt = await tx.activityAttempt.update({
      where: { id: attempt.id },
      data: {
        lifecycle: "graded",
        submittedAt: attempt.submittedAt ?? now,
        gradedAt: now
      }
    });

    await tx.gradeEvent.create({
      data: {
        gradeId: grade.id,
        gradebookItemId: attempt.gradebookItemId,
        participantId: attempt.participantId,
        attemptId: attempt.id,
        actorUserId: user.id,
        eventType: gradeEventTypeForSource(input.source, Boolean(previousGrade)),
        previousValue: previousGrade ? (gradeSnapshot(previousGrade) as JsonInput) : undefined,
        nextValue: gradeSnapshot(grade) as JsonInput,
        reason: input.reason ?? null,
        metadata: (input.metadata ?? {}) as JsonInput,
        createdAt: now
      }
    });

    return { attempt: gradedAttempt, grade };
  });
}

async function resolveAssignedActivityAttemptContext(user: CurrentUser, input: StartActivityAttemptInput) {
  const groupActivity = await prisma.courseGroupActivity.findFirst({
    where: {
      groupId: input.groupId,
      activityId: input.activityId,
      group: { courseId: input.courseId }
    },
    include: {
      group: { select: { courseId: true } },
      activity: {
        select: {
          id: true,
          activityVersionId: true
        }
      },
      gradebookItem: true
    }
  });

  if (!groupActivity) {
    throw notFound("Group activity assignment");
  }
  if (!groupActivity.gradebookItem) {
    throw new AppError(409, "GRADEBOOK_ITEM_MISSING", "This assigned activity does not have a gradebook item.");
  }

  const participant = await resolveAttemptParticipant(user, input.courseId, input.groupId, input.participantId);

  return {
    courseId: groupActivity.group.courseId,
    groupActivity,
    gradebookItem: groupActivity.gradebookItem,
    participant
  };
}

async function resolveAttemptParticipant(user: CurrentUser, courseId: string, groupId: string, participantId?: string) {
  const where = participantId ? { id: participantId, groupId } : { groupId, userId: user.id };
  const participant = await prisma.courseGroupParticipant.findFirst({ where });

  if (!participant) {
    throw forbidden();
  }

  if (participantId && participant.userId !== user.id && !(await canManageCourse(user, courseId))) {
    throw forbidden();
  }

  return participant;
}

async function assertAttemptCanStart(
  context: Awaited<ReturnType<typeof resolveAssignedActivityAttemptContext>>,
  now: Date
) {
  const availableUntil = context.groupActivity.availableUntil;
  const item = context.gradebookItem;

  if (item.attemptLimitMode === "until_due" && availableUntil && now > availableUntil && !item.lateSubmissionsAllowed) {
    throw new AppError(400, "ATTEMPT_DUE_DATE_PASSED", "No more attempts are allowed after the due date.");
  }

  if (item.attemptLimitMode !== "max_attempts" || item.maxAttempts === null) {
    return;
  }

  const usedAttempts = await prisma.activityAttempt.count({
    where: {
      gradebookItemId: item.id,
      participantId: context.participant.id
    }
  });

  if (usedAttempts >= item.maxAttempts) {
    throw new AppError(400, "ATTEMPT_LIMIT_REACHED", "The attempt limit has been reached.");
  }
}

async function assertCanUseAttempt(
  user: CurrentUser,
  courseId: string,
  participant: { userId: string | null }
) {
  if (participant.userId === user.id) {
    return;
  }
  if (await canManageCourse(user, courseId)) {
    return;
  }
  throw forbidden();
}

function computeAttemptLateness(availableUntil: Date | null, graceMinutes: number | null, now: Date) {
  if (!availableUntil) {
    return { isLate: false, lateBySeconds: null };
  }

  const graceMs = Math.max(0, graceMinutes ?? 0) * 60 * 1000;
  const lateByMs = now.getTime() - availableUntil.getTime() - graceMs;
  if (lateByMs <= 0) {
    return { isLate: false, lateBySeconds: null };
  }

  return { isLate: true, lateBySeconds: Math.ceil(lateByMs / 1000) };
}

function gradeEventTypeForSource(source: RecordActivityAttemptGradingResultInput["source"], isExistingGrade: boolean) {
  if (source === "manual") {
    return "manual_graded";
  }
  if (source === "override") {
    return "overridden";
  }
  if (source === "regrade") {
    return "regraded";
  }
  return isExistingGrade ? "regraded" : "auto_graded";
}

function gradeSnapshot(grade: {
  rawScore: number;
  rawMaxScore: number;
  normalizedScore: number;
  normalizedMaxScore: number;
  isPass: boolean | null;
  source: string;
}) {
  return {
    rawScore: grade.rawScore,
    rawMaxScore: grade.rawMaxScore,
    normalizedScore: grade.normalizedScore,
    normalizedMaxScore: grade.normalizedMaxScore,
    isPass: grade.isPass,
    source: grade.source
  };
}
