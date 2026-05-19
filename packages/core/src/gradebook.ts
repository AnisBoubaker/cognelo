import { prisma, type Prisma } from "@cognelo/db";
import type { CurrentUser } from "@cognelo/contracts";
import { assertCanViewCourse, canManageCourse, isAdmin } from "./authorization";
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

export type ActivityAttemptAvailabilityInput = ActivityAttemptSource & {
  participantId?: string;
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

export async function getActivityAttemptAvailability(user: CurrentUser, input: ActivityAttemptAvailabilityInput) {
  const context = await resolveAssignedActivityAttemptContext(user, {
    ...input,
    pluginKey: "availability-check",
    pluginVersion: "0"
  });

  try {
    await assertAttemptCanStart(context, input.now ?? new Date());
    return { canStart: true as const, reason: null };
  } catch (error) {
    if (error instanceof AppError && (error.code === "ATTEMPT_LIMIT_REACHED" || error.code === "ATTEMPT_DUE_DATE_PASSED")) {
      return { canStart: false as const, reason: error.code };
    }
    throw error;
  }
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

export type CourseGradebookStatusFilter = "all" | "missing" | "late" | "needs_grading" | "graded";

export type CourseGradebookFilters = {
  groupId?: string | null;
  activityId?: string | null;
  status?: CourseGradebookStatusFilter | null;
};

export type SetGradebookItemReleaseInput = {
  released: boolean;
  now?: Date;
};

export async function getCourseGradebook(user: CurrentUser, courseId: string, filters: CourseGradebookFilters = {}) {
  await canManageCourseOrThrow(user, courseId);
  await ensureCourseGradebookItems(courseId);
  const statusFilter = filters.status ?? "all";
  const items = await prisma.gradebookItem.findMany({
    where: {
      courseId,
      ...(filters.groupId ? { groupId: filters.groupId } : {}),
      ...(filters.activityId ? { activityId: filters.activityId } : {})
    },
    include: {
      group: {
        select: {
          id: true,
          title: true,
          participants: {
            where: { role: "student" },
            orderBy: [{ lastName: "asc" }, { firstName: "asc" }, { email: "asc" }],
            include: {
              user: { select: { id: true, email: true, name: true } }
            }
          }
        }
      },
      activity: {
        select: {
          id: true,
          title: true,
          activityType: { select: { key: true, name: true } }
        }
      },
      groupActivity: {
        select: {
          id: true,
          availableFrom: true,
          availableUntil: true
        }
      },
      grades: {
        include: {
          selectedAttempt: true
        }
      },
      attempts: {
        orderBy: [{ attemptNumber: "asc" }]
      }
    },
    orderBy: [{ group: { title: "asc" } }, { titleSnapshot: "asc" }]
  });

  const groups = new Map<string, { id: string; title: string }>();
  const activities = new Map<string, { id: string; title: string }>();

  const rows = items.flatMap((item) => {
    groups.set(item.group.id, { id: item.group.id, title: item.group.title });
    activities.set(item.activity.id, { id: item.activity.id, title: item.activity.title });

    return item.group.participants.flatMap((participant) => {
      const grade = item.grades.find((candidate) => candidate.participantId === participant.id) ?? null;
      const attempts = item.attempts.filter((attempt) => attempt.participantId === participant.id);
      const status = getGradebookRowStatus(grade, attempts);
      if (statusFilter !== "all" && status !== statusFilter) {
        return [];
      }

      return {
        gradebookItemId: item.id,
        groupId: item.group.id,
        groupTitle: item.group.title,
        activityId: item.activity.id,
        activityTitle: item.titleSnapshot || item.activity.title,
        activityTypeName: item.activity.activityType.name,
        gradesReleased: item.gradesReleased,
        participantId: participant.id,
        participantName: formatParticipantName(participant),
        participantEmail: participant.email,
        externalId: participant.externalId,
        status,
        score: grade?.normalizedScore ?? null,
        maxScore: grade?.normalizedMaxScore ?? item.pointsPossible,
        isPass: grade?.isPass ?? null,
        latePenaltyApplied: grade?.latePenaltyApplied ?? false,
        latePenaltyPercent: grade?.latePenaltyPercent ?? null,
        selectedAttemptNumber: grade?.selectedAttempt?.attemptNumber ?? null,
        attemptCount: attempts.length,
        lateAttemptCount: attempts.filter((attempt) => attempt.isLate).length,
        submittedAttemptCount: attempts.filter((attempt) => attempt.lifecycle === "submitted" || attempt.lifecycle === "graded").length,
        needsGradingCount: attempts.filter((attempt) => attempt.lifecycle === "submitted").length,
        attempts: attempts.map((attempt) => ({
          id: attempt.id,
          attemptNumber: attempt.attemptNumber,
          lifecycle: attempt.lifecycle,
          startedAt: attempt.startedAt.toISOString(),
          submittedAt: attempt.submittedAt?.toISOString() ?? null,
          gradedAt: attempt.gradedAt?.toISOString() ?? null,
          isLate: attempt.isLate,
          lateBySeconds: attempt.lateBySeconds,
          durationSeconds: attempt.durationSeconds
        }))
      };
    });
  });

  return {
    filters: {
      groupId: filters.groupId ?? null,
      activityId: filters.activityId ?? null,
      status: statusFilter
    },
    groups: [...groups.values()].sort((left, right) => left.title.localeCompare(right.title)),
    activities: [...activities.values()].sort((left, right) => left.title.localeCompare(right.title)),
    rows
  };
}

async function ensureCourseGradebookItems(courseId: string) {
  const assignments = await prisma.courseGroupActivity.findMany({
    where: {
      group: { courseId },
      gradebookItem: null
    },
    include: {
      group: { select: { courseId: true } },
      activity: { select: { id: true, title: true } }
    }
  });

  if (!assignments.length) {
    return;
  }

  await Promise.all(
    assignments.map((assignment) =>
      prisma.gradebookItem.upsert({
        where: { groupActivityId: assignment.id },
        update: {},
        create: {
          courseId: assignment.group.courseId,
          groupId: assignment.groupId,
          groupActivityId: assignment.id,
          activityId: assignment.activityId,
          titleSnapshot: assignment.activity.title
        }
      })
    )
  );
}

export async function getCourseGradebookCsv(user: CurrentUser, courseId: string, filters: CourseGradebookFilters = {}) {
  const gradebook = await getCourseGradebook(user, courseId, filters);
  const headers = [
    "Group",
    "Activity",
    "Participant",
    "Email",
    "External ID",
    "Status",
    "Score",
    "Max Score",
    "Pass",
    "Attempts",
    "Late Attempts",
    "Needs Grading"
  ];
  const lines = [
    headers,
    ...gradebook.rows.map((row) => [
      row.groupTitle,
      row.activityTitle,
      row.participantName,
      row.participantEmail,
      row.externalId ?? "",
      row.status,
      row.score ?? "",
      row.maxScore,
      row.isPass === null ? "" : row.isPass ? "pass" : "fail",
      row.attemptCount,
      row.lateAttemptCount,
      row.needsGradingCount
    ])
  ];
  return lines.map((line) => line.map(csvCell).join(",")).join("\n");
}

export async function setGradebookItemRelease(
  user: CurrentUser,
  courseId: string,
  gradebookItemId: string,
  input: SetGradebookItemReleaseInput
) {
  await canManageCourseOrThrow(user, courseId);
  const now = input.now ?? new Date();
  const item = await prisma.gradebookItem.findFirst({
    where: { id: gradebookItemId, courseId },
    select: {
      id: true,
      gradesReleased: true,
      courseId: true,
      groupId: true,
      activityId: true,
      titleSnapshot: true,
      group: {
        select: {
          participants: {
            where: { role: "student" },
            select: { id: true }
          }
        }
      }
    }
  });

  if (!item) {
    throw notFound("Gradebook item");
  }

  if (item.gradesReleased === input.released) {
    return item;
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.gradebookItem.update({
      where: { id: gradebookItemId },
      data: { gradesReleased: input.released }
    });

    await Promise.all(
      item.group.participants.map((participant) =>
        tx.gradeEvent.create({
          data: {
            gradebookItemId: item.id,
            participantId: participant.id,
            actorUserId: user.id,
            eventType: input.released ? "released" : "hidden",
            previousValue: { gradesReleased: item.gradesReleased } as JsonInput,
            nextValue: { gradesReleased: input.released } as JsonInput,
            metadata: {
              courseId: item.courseId,
              groupId: item.groupId,
              activityId: item.activityId,
              titleSnapshot: item.titleSnapshot
            } as JsonInput,
            createdAt: now
          }
        })
      )
    );

    return updated;
  });
}

export async function getStudentReleasedGrades(user: CurrentUser, courseId: string, groupId: string) {
  await assertCanViewGroupForGradebook(user, courseId, groupId);
  const participant = await prisma.courseGroupParticipant.findFirst({
    where: { groupId, userId: user.id, role: "student" }
  });

  if (!participant) {
    throw forbidden();
  }

  const items = await prisma.gradebookItem.findMany({
    where: {
      courseId,
      groupId,
      gradesReleased: true
    },
    include: {
      activity: {
        select: {
          id: true,
          title: true,
          activityType: { select: { key: true, name: true } }
        }
      },
      groupActivity: {
        select: {
          availableFrom: true,
          availableUntil: true
        }
      },
      grades: {
        where: { participantId: participant.id },
        include: { selectedAttempt: true }
      },
      attempts: {
        where: { participantId: participant.id },
        orderBy: [{ attemptNumber: "asc" }]
      }
    },
    orderBy: [{ titleSnapshot: "asc" }]
  });

  return {
    rows: items.map((item) => {
      const grade = item.grades[0] ?? null;
      const status = getGradebookRowStatus(grade, item.attempts);

      return {
        gradebookItemId: item.id,
        activityId: item.activity.id,
        activityTitle: item.titleSnapshot || item.activity.title,
        activityTypeName: item.activity.activityType.name,
        status,
        score: grade?.normalizedScore ?? null,
        maxScore: grade?.normalizedMaxScore ?? item.pointsPossible,
        isPass: grade?.isPass ?? null,
        latePenaltyApplied: grade?.latePenaltyApplied ?? false,
        latePenaltyPercent: grade?.latePenaltyPercent ?? null,
        selectedAttemptNumber: grade?.selectedAttempt?.attemptNumber ?? null,
        attemptCount: item.attempts.length,
        submittedAttemptCount: item.attempts.filter((attempt) => attempt.lifecycle === "submitted" || attempt.lifecycle === "graded").length,
        availableFrom: item.groupActivity.availableFrom?.toISOString() ?? null,
        availableUntil: item.groupActivity.availableUntil?.toISOString() ?? null,
        gradedAt: grade?.gradedAt.toISOString() ?? null
      };
    })
  };
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

async function canManageCourseOrThrow(user: CurrentUser, courseId: string) {
  if (await canManageCourse(user, courseId)) {
    return;
  }
  throw forbidden();
}

async function assertCanViewGroupForGradebook(user: CurrentUser, courseId: string, groupId: string) {
  await assertCanViewCourse(user, courseId);
  const group = await prisma.courseGroup.findFirst({ where: { id: groupId, courseId } });
  if (!group) {
    throw notFound("Course group");
  }

  if (isAdmin(user) || (await canManageCourse(user, courseId))) {
    return group;
  }

  const participant = await prisma.courseGroupParticipant.findFirst({
    where: { groupId, userId: user.id }
  });

  if (!participant) {
    throw forbidden();
  }

  const now = new Date();
  if (
    group.status !== "published" ||
    (group.availableFrom && group.availableFrom > now) ||
    (group.availableUntil && group.availableUntil < now)
  ) {
    throw new AppError(403, "GROUP_NOT_AVAILABLE", "This group is not currently available.");
  }

  return group;
}

function getGradebookRowStatus(
  grade: { normalizedScore: number; selectedAttempt?: { isLate: boolean } | null } | null,
  attempts: Array<{ lifecycle: "started" | "submitted" | "graded"; isLate: boolean }>
): CourseGradebookStatusFilter {
  if (attempts.some((attempt) => attempt.lifecycle === "submitted")) {
    return "needs_grading";
  }
  if (!grade) {
    return "missing";
  }
  if (grade.selectedAttempt?.isLate || attempts.some((attempt) => attempt.lifecycle === "graded" && attempt.isLate)) {
    return "late";
  }
  return "graded";
}

function formatParticipantName(participant: { firstName: string; lastName: string; email: string }) {
  const name = `${participant.firstName} ${participant.lastName}`.trim();
  return name || participant.email;
}

function csvCell(value: string | number | null | undefined) {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
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
