import { ActivityAssignmentOverrideValuesSchema, type ActivityAssignmentExceptionInput, type GradebookItemSettingsInput } from "@cognelo/contracts";
import { prisma, type Prisma } from "@cognelo/db";
import { AppError } from "./errors";

type ExceptionRow = { groupActivityId: string; teamId: string | null; participantId: string | null; priority: number; settings: unknown };
export type AssignmentExceptionOverrides = {
  availableFrom?: string | null;
  availableUntil?: string | null;
  timeLimitMinutes?: number | null;
  isVisible?: boolean;
  requireSafeExamBrowser?: boolean;
  gradeChallengesEnabled?: boolean;
  gradebookSettings?: GradebookItemSettingsInput;
};

const gradeFields = {
  pointsPossible: ["pointsPossible"],
  grading: ["gradingMode", "passThresholdPoints", "passThresholdOutOf"],
  attempts: ["attemptLimitMode", "maxAttempts"],
  gradeStrategy: ["gradeStrategy", "dropLowestAttempt"]
} as const;

// Priority zero is highest. Merge lower-priority teams first, then the student's own exception.
export function resolveAssignmentExceptions(rows: readonly ExceptionRow[]): AssignmentExceptionOverrides {
  const result: AssignmentExceptionOverrides = {};
  const ordered = [...rows].sort((a, b) => Number(Boolean(a.participantId)) - Number(Boolean(b.participantId)) || b.priority - a.priority);
  for (const row of ordered) {
    const parsed = ActivityAssignmentOverrideValuesSchema.safeParse(row.settings);
    if (!parsed.success) throw new AppError(500, "ASSIGNMENT_EXCEPTION_INVALID", "The saved activity exception is invalid.");
    const value = parsed.data;
    for (const field of value.overrideFields) {
      if (field === "availableFrom" || field === "availableUntil") result[field] = value[field] ?? null;
      else if (field === "timeLimit") result.timeLimitMinutes = value.timeLimitMinutes ?? null;
      else if (field === "visibility") result.isVisible = value.contentPlacement?.isVisible ?? true;
      else if (field === "requireSafeExamBrowser") result.requireSafeExamBrowser = value.requireSafeExamBrowser === true;
      else if (field === "gradeChallenges") result.gradeChallengesEnabled = value.gradeChallengesEnabled === true;
      else {
        const selected = Object.fromEntries(gradeFields[field].filter((key) => value.gradebookSettings?.[key] !== undefined).map((key) => [key, value.gradebookSettings![key]]));
        result.gradebookSettings = { ...result.gradebookSettings, ...selected };
      }
    }
  }
  return result;
}

export async function assignmentExceptionsForUser(assignmentIds: string[], userId: string) {
  if (!assignmentIds.length) return new Map<string, AssignmentExceptionOverrides>();
  const rows = await prisma.activityAssignmentException.findMany({
    where: { groupActivityId: { in: assignmentIds }, OR: [
      { participant: { userId, role: "student" } },
      { team: { members: { some: { participant: { userId, role: "student" } } } } }
    ] }, orderBy: [{ priority: "asc" }, { id: "asc" }]
  });
  return new Map(assignmentIds.map((id) => [id, resolveAssignmentExceptions(rows.filter((row) => row.groupActivityId === id))]));
}

export async function loadAssignmentExceptions(assignmentIds: string[], db: Pick<typeof prisma, "activityAssignmentException"> = prisma) {
  if (!assignmentIds.length) return [];
  return db.activityAssignmentException.findMany({
    where: { groupActivityId: { in: assignmentIds } },
    include: { team: { select: { members: { where: { participant: { role: "student" } }, select: { participantId: true } } } } },
    orderBy: [{ priority: "asc" }, { id: "asc" }]
  });
}

export function exceptionsForParticipant(rows: Awaited<ReturnType<typeof loadAssignmentExceptions>>, assignmentId: string, participantId: string) {
  return resolveAssignmentExceptions(rows.filter((row) => row.groupActivityId === assignmentId && (
    row.participantId === participantId || row.team?.members.some((member) => member.participantId === participantId)
  )));
}

export function applyAssignmentExceptions<T extends { metadata: Prisma.JsonValue; availableFrom?: Date | null; availableUntil?: Date | null }>(assignment: T, overrides: AssignmentExceptionOverrides): T {
  const metadata = assignment.metadata && typeof assignment.metadata === "object" && !Array.isArray(assignment.metadata) ? assignment.metadata : {};
  return {
    ...assignment,
    ...(overrides.availableFrom !== undefined ? { availableFrom: overrides.availableFrom ? new Date(overrides.availableFrom) : null } : {}),
    ...(overrides.availableUntil !== undefined ? { availableUntil: overrides.availableUntil ? new Date(overrides.availableUntil) : null } : {}),
    metadata: {
      ...metadata,
      ...(overrides.timeLimitMinutes !== undefined ? { timeLimitMinutes: overrides.timeLimitMinutes } : {}),
      ...(metadata.assessmentMode === "summative" && overrides.requireSafeExamBrowser !== undefined ? { requireSafeExamBrowser: overrides.requireSafeExamBrowser } : {}),
      ...(metadata.assessmentMode === "summative" && overrides.gradeChallengesEnabled !== undefined ? { gradeChallengesEnabled: overrides.gradeChallengesEnabled } : {})
    }
  };
}

export function applyGradebookExceptions<T>(item: T, overrides: AssignmentExceptionOverrides): T {
  return { ...item, ...overrides.gradebookSettings };
}

export async function saveAssignmentExceptions(tx: Prisma.TransactionClient, input: {
  courseId: string; actorUserId: string; groupId: string; assignmentId: string;
  exceptions: ActivityAssignmentExceptionInput[];
}) {
  const teamIds = input.exceptions.flatMap((value) => value.teamId ? [value.teamId] : []);
  const participantIds = input.exceptions.flatMap((value) => value.participantId ? [value.participantId] : []);
  const [teams, participants] = await Promise.all([
    tx.studentTeam.findMany({ where: { id: { in: teamIds }, grouping: { groupId: input.groupId } }, select: { id: true } }),
    tx.courseGroupParticipant.findMany({ where: { id: { in: participantIds }, groupId: input.groupId, role: "student" }, select: { id: true } })
  ]);
  if (teams.length !== teamIds.length || participants.length !== participantIds.length) {
    throw new AppError(400, "ASSIGNMENT_EXCEPTION_TARGET_INVALID", "Exception targets must be teams or students in this section.");
  }
  const previous = await tx.activityAssignmentException.findMany({ where: { groupActivityId: input.assignmentId }, orderBy: [{ priority: "asc" }] });
  await tx.activityAssignmentException.deleteMany({ where: { groupActivityId: input.assignmentId } });
  await tx.activityAssignmentException.createMany({ data: input.exceptions.map(({ teamId, participantId, ...settings }, priority) => ({
    groupActivityId: input.assignmentId, teamId: teamId ?? null, participantId: participantId ?? null, priority, settings: settings as Prisma.InputJsonValue
  })) });
  await tx.courseAuditEvent.create({ data: {
    courseId: input.courseId, actorUserId: input.actorUserId, eventType: "activity_assignment_exceptions_updated",
    targetType: "course_group_activity", targetId: input.assignmentId,
    previousValue: previous.map(({ teamId, participantId, priority, settings }) => ({ teamId, participantId, priority, settings })),
    nextValue: input.exceptions as Prisma.InputJsonValue
  } });
}
