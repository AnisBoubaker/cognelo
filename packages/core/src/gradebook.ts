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
  normalizedScore?: number;
  normalizedMaxScore?: number;
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
    const previousEvents = await tx.gradeEvent.findMany({
      where: {
        gradebookItemId: attempt.gradebookItemId,
        participantId: attempt.participantId,
        attemptId: { not: null }
      },
      orderBy: [{ createdAt: "asc" }]
    });
    const eventCandidates = gradeCandidatesFromEvents(previousEvents);
    const gradedCandidate = buildGradedAttemptCandidate(input, attempt);
    const selectedGrade = selectGradebookGrade({
      gradebookItem: attempt.gradebookItem,
      candidates: [
        ...eventCandidates,
        ...(eventCandidates.length === 0 && previousGrade?.selectedAttemptId ? [gradeCandidateFromCurrentGrade(previousGrade)] : []),
        gradedCandidate
      ]
    });

    const grade = await tx.grade.upsert({
      where: {
        gradebookItemId_participantId: {
          gradebookItemId: attempt.gradebookItemId,
          participantId: attempt.participantId
        }
      },
      update: {
        selectedAttemptId: selectedGrade.attemptId,
        rawScore: selectedGrade.rawScore,
        rawMaxScore: selectedGrade.rawMaxScore,
        normalizedScore: selectedGrade.normalizedScore,
        normalizedMaxScore: selectedGrade.normalizedMaxScore,
        isPass: selectedGrade.isPass,
        latePenaltyApplied: selectedGrade.latePenaltyApplied,
        latePenaltyPercent: selectedGrade.latePenaltyPercent,
        gradedByUserId: user.id,
        gradedAt: now,
        source: input.source,
        rawResult: (input.rawResult ?? {}) as JsonInput,
        normalizedResult: selectedGrade.normalizedResult as JsonInput,
        metadata: (input.metadata ?? {}) as JsonInput
      },
      create: {
        gradebookItemId: attempt.gradebookItemId,
        participantId: attempt.participantId,
        userId: attempt.userId,
        selectedAttemptId: selectedGrade.attemptId,
        rawScore: selectedGrade.rawScore,
        rawMaxScore: selectedGrade.rawMaxScore,
        normalizedScore: selectedGrade.normalizedScore,
        normalizedMaxScore: selectedGrade.normalizedMaxScore,
        isPass: selectedGrade.isPass,
        latePenaltyApplied: selectedGrade.latePenaltyApplied,
        latePenaltyPercent: selectedGrade.latePenaltyPercent,
        gradedByUserId: user.id,
        gradedAt: now,
        source: input.source,
        rawResult: (input.rawResult ?? {}) as JsonInput,
        normalizedResult: selectedGrade.normalizedResult as JsonInput,
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
        nextValue: gradedAttemptSnapshot(gradedCandidate) as JsonInput,
        reason: input.reason ?? null,
        metadata: {
          ...(asJsonObject(input.metadata) ?? {}),
          selectedGrade: gradeSnapshot(grade)
        } as JsonInput,
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
  selectedAttemptId?: string | null;
  rawScore: number;
  rawMaxScore: number;
  normalizedScore: number;
  normalizedMaxScore: number;
  isPass: boolean | null;
  latePenaltyApplied?: boolean;
  latePenaltyPercent?: number | null;
  source: string;
}) {
  return {
    attemptId: grade.selectedAttemptId ?? null,
    rawScore: grade.rawScore,
    rawMaxScore: grade.rawMaxScore,
    normalizedScore: grade.normalizedScore,
    normalizedMaxScore: grade.normalizedMaxScore,
    isPass: grade.isPass,
    latePenaltyApplied: grade.latePenaltyApplied ?? false,
    latePenaltyPercent: grade.latePenaltyPercent ?? null,
    source: grade.source
  };
}

type GradebookItemPolicy = {
  pointsPossible: number;
  gradingMode: "points" | "pass_fail";
  passThresholdPoints: number | null;
  passThresholdOutOf: number | null;
  gradeStrategy: "latest" | "best" | "first" | "weighted_average";
  dropLowestAttempt: boolean;
  latePenaltyPercent: number | null;
  latePenaltyIntervalMinutes: number | null;
  latePenaltyMaxPercent: number | null;
};

type AttemptForGrade = {
  id: string;
  attemptNumber: number;
  isLate: boolean;
  lateBySeconds: number | null;
  gradebookItem: GradebookItemPolicy;
};

type GradedAttemptCandidate = {
  attemptId: string;
  attemptNumber: number;
  rawScore: number;
  rawMaxScore: number;
  normalizedScore: number;
  normalizedMaxScore: number;
  scoreBeforeLatePenalty: number;
  isPass: boolean | null;
  latePenaltyApplied: boolean;
  latePenaltyPercent: number | null;
  normalizedResult: Record<string, unknown>;
};

function buildGradedAttemptCandidate(
  input: RecordActivityAttemptGradingResultInput,
  attempt: AttemptForGrade
): GradedAttemptCandidate {
  if (input.rawMaxScore <= 0) {
    throw new AppError(400, "GRADE_RAW_MAX_INVALID", "Raw max score must be greater than zero.");
  }

  const normalizedMaxScore = input.normalizedMaxScore ?? attempt.gradebookItem.pointsPossible;
  if (normalizedMaxScore <= 0) {
    throw new AppError(400, "GRADE_NORMALIZED_MAX_INVALID", "Normalized max score must be greater than zero.");
  }

  const scoreBeforeLatePenalty =
    input.normalizedScore ?? roundGrade((input.rawScore / input.rawMaxScore) * normalizedMaxScore);
  const latePenalty = computeLatePenalty(attempt, scoreBeforeLatePenalty);
  const normalizedScore = roundGrade(Math.max(0, scoreBeforeLatePenalty - latePenalty.points));
  const isPass = computePassStatus({
    explicit: input.isPass,
    gradebookItem: attempt.gradebookItem,
    normalizedScore,
    normalizedMaxScore
  });

  return {
    attemptId: attempt.id,
    attemptNumber: attempt.attemptNumber,
    rawScore: input.rawScore,
    rawMaxScore: input.rawMaxScore,
    normalizedScore,
    normalizedMaxScore,
    scoreBeforeLatePenalty,
    isPass,
    latePenaltyApplied: latePenalty.percent > 0,
    latePenaltyPercent: latePenalty.percent > 0 ? latePenalty.percent : null,
    normalizedResult: {
      ...(asJsonObject(input.normalizedResult) ?? {}),
      scoreBeforeLatePenalty,
      latePenaltyPercent: latePenalty.percent,
      selectedByStrategy: attempt.gradebookItem.gradeStrategy
    }
  };
}

function selectGradebookGrade(input: {
  gradebookItem: GradebookItemPolicy;
  candidates: GradedAttemptCandidate[];
}): GradedAttemptCandidate {
  const candidates = dedupeCandidatesByAttempt(input.candidates);
  if (!candidates.length) {
    throw new AppError(409, "GRADE_CANDIDATE_MISSING", "At least one graded attempt is required.");
  }

  if (input.gradebookItem.gradeStrategy === "weighted_average") {
    return buildWeightedAverageGrade(input.gradebookItem, candidates);
  }

  if (input.gradebookItem.gradeStrategy === "first") {
    return [...candidates].sort(byAttemptNumber)[0];
  }

  if (input.gradebookItem.gradeStrategy === "best") {
    return [...candidates].sort((left, right) => {
      const scoreDelta = scoreRatio(right) - scoreRatio(left);
      return scoreDelta === 0 ? right.attemptNumber - left.attemptNumber : scoreDelta;
    })[0];
  }

  return [...candidates].sort((left, right) => right.attemptNumber - left.attemptNumber)[0];
}

function buildWeightedAverageGrade(gradebookItem: GradebookItemPolicy, candidates: GradedAttemptCandidate[]): GradedAttemptCandidate {
  const orderedCandidates = [...candidates].sort(byAttemptNumber);
  const usedCandidates =
    gradebookItem.dropLowestAttempt && orderedCandidates.length > 1
      ? orderedCandidates.filter((candidate) => candidate !== [...orderedCandidates].sort((left, right) => scoreRatio(left) - scoreRatio(right))[0])
      : orderedCandidates;
  const normalizedMaxScore = gradebookItem.pointsPossible;
  const averageRatio = usedCandidates.reduce((sum, candidate) => sum + scoreRatio(candidate), 0) / usedCandidates.length;
  const normalizedScore = roundGrade(averageRatio * normalizedMaxScore);

  return {
    attemptId: usedCandidates[usedCandidates.length - 1].attemptId,
    attemptNumber: usedCandidates[usedCandidates.length - 1].attemptNumber,
    rawScore: normalizedScore,
    rawMaxScore: normalizedMaxScore,
    normalizedScore,
    normalizedMaxScore,
    scoreBeforeLatePenalty: normalizedScore,
    isPass: computePassStatus({
      explicit: null,
      gradebookItem,
      normalizedScore,
      normalizedMaxScore
    }),
    latePenaltyApplied: usedCandidates.some((candidate) => candidate.latePenaltyApplied),
    latePenaltyPercent: null,
    normalizedResult: {
      selectedByStrategy: "weighted_average",
      attemptsIncluded: usedCandidates.map((candidate) => candidate.attemptId),
      droppedLowestAttempt: gradebookItem.dropLowestAttempt && orderedCandidates.length > usedCandidates.length
    }
  };
}

function computeLatePenalty(attempt: AttemptForGrade, scoreBeforePenalty: number) {
  const item = attempt.gradebookItem;
  if (!attempt.isLate || !attempt.lateBySeconds || !item.latePenaltyPercent || !item.latePenaltyIntervalMinutes) {
    return { percent: 0, points: 0 };
  }

  const intervalsLate = Math.ceil(attempt.lateBySeconds / (item.latePenaltyIntervalMinutes * 60));
  const uncappedPercent = intervalsLate * item.latePenaltyPercent;
  const percent = clamp(uncappedPercent, 0, item.latePenaltyMaxPercent ?? 100);
  return {
    percent,
    points: scoreBeforePenalty * (percent / 100)
  };
}

function computePassStatus(input: {
  explicit?: boolean | null;
  gradebookItem: GradebookItemPolicy;
  normalizedScore: number;
  normalizedMaxScore: number;
}) {
  if (input.gradebookItem.gradingMode !== "pass_fail") {
    return input.explicit ?? null;
  }
  const thresholdPoints = input.gradebookItem.passThresholdPoints;
  const thresholdOutOf = input.gradebookItem.passThresholdOutOf;
  if (thresholdPoints === null || thresholdOutOf === null || thresholdOutOf <= 0) {
    return input.explicit ?? null;
  }
  const requiredScore = (thresholdPoints / thresholdOutOf) * input.normalizedMaxScore;
  return input.normalizedScore >= requiredScore;
}

function gradeCandidatesFromEvents(events: Array<{ attemptId: string | null; nextValue: unknown }>) {
  return events.flatMap((event) => {
    if (!event.attemptId) {
      return [];
    }
    const value = asJsonObject(event.nextValue);
    if (!value) {
      return [];
    }
    return gradeCandidateFromSnapshot(event.attemptId, value);
  });
}

function gradeCandidateFromCurrentGrade(grade: {
  selectedAttemptId: string | null;
  rawScore: number;
  rawMaxScore: number;
  normalizedScore: number;
  normalizedMaxScore: number;
  isPass: boolean | null;
  latePenaltyApplied: boolean;
  latePenaltyPercent: number | null;
}) {
  return {
    attemptId: grade.selectedAttemptId ?? "",
    attemptNumber: Number.MAX_SAFE_INTEGER - 1,
    rawScore: grade.rawScore,
    rawMaxScore: grade.rawMaxScore,
    normalizedScore: grade.normalizedScore,
    normalizedMaxScore: grade.normalizedMaxScore,
    scoreBeforeLatePenalty: grade.normalizedScore,
    isPass: grade.isPass,
    latePenaltyApplied: grade.latePenaltyApplied,
    latePenaltyPercent: grade.latePenaltyPercent,
    normalizedResult: {}
  };
}

function gradeCandidateFromSnapshot(attemptId: string, value: Record<string, unknown>): GradedAttemptCandidate[] {
  const rawScore = asNumber(value.rawScore);
  const rawMaxScore = asNumber(value.rawMaxScore);
  const normalizedScore = asNumber(value.normalizedScore);
  const normalizedMaxScore = asNumber(value.normalizedMaxScore);
  if (rawScore === null || rawMaxScore === null || normalizedScore === null || normalizedMaxScore === null) {
    return [];
  }

  return [
    {
      attemptId,
      attemptNumber: asNumber(value.attemptNumber) ?? Number.MAX_SAFE_INTEGER,
      rawScore,
      rawMaxScore,
      normalizedScore,
      normalizedMaxScore,
      scoreBeforeLatePenalty: asNumber(value.scoreBeforeLatePenalty) ?? normalizedScore,
      isPass: typeof value.isPass === "boolean" ? value.isPass : null,
      latePenaltyApplied: value.latePenaltyApplied === true,
      latePenaltyPercent: asNumber(value.latePenaltyPercent),
      normalizedResult: asJsonObject(value.normalizedResult) ?? {}
    }
  ];
}

function gradedAttemptSnapshot(candidate: GradedAttemptCandidate) {
  return {
    attemptId: candidate.attemptId,
    attemptNumber: candidate.attemptNumber,
    rawScore: candidate.rawScore,
    rawMaxScore: candidate.rawMaxScore,
    normalizedScore: candidate.normalizedScore,
    normalizedMaxScore: candidate.normalizedMaxScore,
    scoreBeforeLatePenalty: candidate.scoreBeforeLatePenalty,
    isPass: candidate.isPass,
    latePenaltyApplied: candidate.latePenaltyApplied,
    latePenaltyPercent: candidate.latePenaltyPercent,
    normalizedResult: candidate.normalizedResult
  };
}

function dedupeCandidatesByAttempt(candidates: GradedAttemptCandidate[]) {
  const byAttempt = new Map<string, GradedAttemptCandidate>();
  candidates.forEach((candidate) => {
    byAttempt.set(candidate.attemptId, candidate);
  });
  return [...byAttempt.values()].filter((candidate) => candidate.attemptId);
}

function scoreRatio(candidate: GradedAttemptCandidate) {
  return candidate.normalizedMaxScore <= 0 ? 0 : candidate.normalizedScore / candidate.normalizedMaxScore;
}

function byAttemptNumber(left: GradedAttemptCandidate, right: GradedAttemptCandidate) {
  return left.attemptNumber - right.attemptNumber;
}

function roundGrade(value: number) {
  return Math.round(value * 10000) / 10000;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function asJsonObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function asNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
