import { z } from "zod";
import { prisma, type Prisma } from "@cognelo/db";
import type { CurrentUser } from "@cognelo/contracts";
import { assertCanManageCourse } from "./authorization";
import { recordAiFeedbackResearchEvent } from "./ai-feedback";
import { AppError, forbidden, notFound } from "./errors";
import { overrideGradebookGrade } from "./gradebook";

const createChallengeSchema = z.object({
  feedbackRef: z.string().min(1).max(200),
  feedbackVersion: z.number().int().min(1),
  explanation: z.string().trim().min(20).max(8000)
});

const resolveChallengeSchema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("upheld"),
    teacherResponse: z.string().trim().min(1).max(8000)
  }),
  z.object({
    status: z.literal("adjusted"),
    teacherResponse: z.string().trim().min(1).max(8000),
    score: z.number().min(0),
    maxScore: z.number().positive().optional()
  })
]);

export async function createGradeChallenge(user: CurrentUser, courseId: string, attemptId: string, input: unknown) {
  const data = createChallengeSchema.parse(input);
  const attempt = await prisma.activityAttempt.findFirst({
    where: { id: attemptId, courseId },
    include: {
      participant: true,
      gradebookItem: true,
      activity: { include: { activityType: true } }
    }
  });
  if (!attempt) {
    throw notFound("Activity attempt");
  }
  if (attempt.participant.userId !== user.id) {
    throw forbidden();
  }
  if (!attempt.gradebookItem.gradesReleased) {
    throw new AppError(409, "GRADE_NOT_RELEASED", "Feedback can only be challenged after the grade is released.");
  }
  const grade = await prisma.grade.findUnique({
    where: {
      gradebookItemId_participantId: {
        gradebookItemId: attempt.gradebookItemId,
        participantId: attempt.participantId
      }
    }
  });
  if (!grade) {
    throw new AppError(409, "GRADE_NOT_AVAILABLE", "No released grade is available for this attempt.");
  }
  const feedback = readFeedbackReferences(grade.normalizedResult).find(
    (candidate) => candidate.feedbackRef === data.feedbackRef && candidate.feedbackVersion === data.feedbackVersion
  );
  if (!feedback) {
    throw new AppError(409, "AI_FEEDBACK_VERSION_MISMATCH", "The challenged feedback is not the released feedback for this grade.");
  }

  const challengedActivityId = feedback.activityId ?? attempt.activityId;
  const challengedPluginKey = feedback.pluginKey ?? attempt.pluginKey;

  const challenge = await prisma.gradeChallenge.create({
    data: {
      courseId,
      groupId: attempt.groupId,
      activityId: challengedActivityId,
      groupActivityId: attempt.groupActivityId,
      gradebookItemId: attempt.gradebookItemId,
      participantId: attempt.participantId,
      userId: attempt.userId,
      attemptId: attempt.id,
      gradeId: grade.id,
      pluginKey: challengedPluginKey,
      feedbackRef: data.feedbackRef,
      feedbackVersion: data.feedbackVersion,
      feedbackHash: feedback.feedbackHash,
      releasedGradeSnapshot: gradeSnapshot(grade) as Prisma.InputJsonValue,
      explanation: data.explanation,
      metadata: {
        activityTypeKey: challengedPluginKey,
        rootActivityId: attempt.activityId,
        rootActivityTypeKey: attempt.activity.activityType.key,
        ...(feedback.testItemId ? { testItemId: feedback.testItemId } : {})
      }
    }
  }).catch((error: unknown) => {
    if (isUniqueConstraintError(error)) {
      throw new AppError(409, "GRADE_CHALLENGE_ALREADY_EXISTS", "This feedback version has already been challenged.");
    }
    throw error;
  });

  await recordAiFeedbackResearchEvent({
    eventType: "challenge_opened",
    courseId,
    groupId: attempt.groupId,
    activityId: challengedActivityId,
    groupActivityId: attempt.groupActivityId,
    gradebookItemId: attempt.gradebookItemId,
    participantId: attempt.participantId,
    userId: attempt.userId,
    attemptId: attempt.id,
    actorUserId: user.id,
    pluginKey: challengedPluginKey,
    feedbackRef: data.feedbackRef,
    feedbackVersion: data.feedbackVersion,
    feedbackHash: feedback.feedbackHash,
    assessmentMode: "summative",
    triggerKind: "student_challenge",
    outcome: "open",
    metadata: {
      challengeId: challenge.id,
      rootActivityId: attempt.activityId,
      ...(feedback.testItemId ? { testItemId: feedback.testItemId } : {})
    }
  });
  return challenge;
}

export async function listCourseGradeChallenges(user: CurrentUser, courseId: string, status?: string | null) {
  await assertCanManageCourse(user, courseId);
  const challenges = await prisma.gradeChallenge.findMany({
    where: {
      courseId,
      ...(status && ["open", "upheld", "adjusted"].includes(status) ? { status } : {})
    },
    orderBy: [{ status: "asc" }, { createdAt: "asc" }]
  });
  const [participants, activities, groups] = await Promise.all([
    prisma.courseGroupParticipant.findMany({
      where: { id: { in: challenges.map((challenge) => challenge.participantId) } },
      include: { user: { select: { name: true, email: true } } }
    }),
    prisma.activity.findMany({
      where: { id: { in: challenges.map((challenge) => challenge.activityId) } },
      select: { id: true, title: true }
    }),
    prisma.courseGroup.findMany({
      where: { id: { in: challenges.map((challenge) => challenge.groupId) } },
      select: { id: true, title: true }
    })
  ]);
  const participantById = new Map(participants.map((participant) => [participant.id, participant]));
  const activityById = new Map(activities.map((activity) => [activity.id, activity]));
  const groupById = new Map(groups.map((group) => [group.id, group]));
  return challenges.map((challenge) => {
    const participant = participantById.get(challenge.participantId);
    return {
      ...challenge,
      participantName: participant?.user?.name ?? participant?.user?.email ?? "Student",
      participantEmail: participant?.user?.email ?? "",
      activityTitle: activityById.get(challenge.activityId)?.title ?? "Activity",
      groupTitle: groupById.get(challenge.groupId)?.title ?? "Group"
    };
  });
}

export async function listAttemptGradeChallenges(user: CurrentUser, courseId: string, attemptId: string) {
  const attempt = await prisma.activityAttempt.findFirst({
    where: { id: attemptId, courseId },
    select: { participant: { select: { userId: true } } }
  });
  if (!attempt) {
    throw notFound("Activity attempt");
  }
  if (attempt.participant.userId !== user.id) {
    throw forbidden();
  }
  return prisma.gradeChallenge.findMany({
    where: { courseId, attemptId },
    orderBy: [{ createdAt: "desc" }]
  });
}

export async function resolveGradeChallenge(user: CurrentUser, courseId: string, challengeId: string, input: unknown) {
  await assertCanManageCourse(user, courseId);
  const data = resolveChallengeSchema.parse(input);
  const challenge = await prisma.gradeChallenge.findFirst({ where: { id: challengeId, courseId } });
  if (!challenge) {
    throw notFound("Grade challenge");
  }
  if (challenge.status !== "open") {
    throw new AppError(409, "GRADE_CHALLENGE_ALREADY_RESOLVED", "This grade challenge has already been resolved.");
  }

  let resultingGradeSnapshot: Prisma.InputJsonValue | undefined;
  if (data.status === "adjusted") {
    const grade = await overrideGradebookGrade(user, courseId, {
      gradebookItemId: challenge.gradebookItemId,
      participantId: challenge.participantId,
      score: data.score,
      maxScore: data.maxScore,
      reason: data.teacherResponse,
      metadata: {
        gradeChallengeId: challenge.id,
        feedbackRef: challenge.feedbackRef,
        feedbackVersion: challenge.feedbackVersion
      }
    });
    resultingGradeSnapshot = gradeSnapshot(grade) as Prisma.InputJsonValue;
  }

  const resolved = await prisma.gradeChallenge.update({
    where: { id: challenge.id },
    data: {
      status: data.status,
      teacherResponse: data.teacherResponse,
      resolvedByUserId: user.id,
      resolvedAt: new Date(),
      resultingGradeSnapshot
    }
  });

  await recordAiFeedbackResearchEvent({
    eventType: data.status === "adjusted" ? "challenge_adjusted" : "challenge_upheld",
    courseId,
    groupId: challenge.groupId,
    activityId: challenge.activityId,
    groupActivityId: challenge.groupActivityId,
    gradebookItemId: challenge.gradebookItemId,
    participantId: challenge.participantId,
    userId: challenge.userId,
    attemptId: challenge.attemptId,
    actorUserId: user.id,
    pluginKey: challenge.pluginKey,
    feedbackRef: challenge.feedbackRef,
    feedbackVersion: challenge.feedbackVersion,
    feedbackHash: challenge.feedbackHash,
    assessmentMode: "summative",
    triggerKind: "teacher_challenge_resolution",
    outcome: data.status,
    metadata: { challengeId: challenge.id, gradeAdjusted: data.status === "adjusted" }
  });
  return resolved;
}

function readFeedbackReferences(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  const root = value as Record<string, unknown>;
  const candidate = root.studentFeedback && typeof root.studentFeedback === "object" && !Array.isArray(root.studentFeedback)
    ? root.studentFeedback as Record<string, unknown>
    : root;
  const details = candidate.details && typeof candidate.details === "object" && !Array.isArray(candidate.details)
    ? candidate.details as Record<string, unknown>
    : null;
  const directCandidate = typeof candidate.feedbackRef === "string" ? candidate : details ?? candidate;
  const direct = typeof directCandidate.feedbackRef === "string" && typeof directCandidate.feedbackVersion === "number" && directCandidate.challengeAllowed === true
    ? {
        feedbackRef: directCandidate.feedbackRef,
        feedbackVersion: directCandidate.feedbackVersion,
        feedbackHash: typeof directCandidate.feedbackHash === "string" ? directCandidate.feedbackHash : null,
        activityId: null,
        pluginKey: null,
        testItemId: null
      }
    : null;
  if (direct) return [direct];
  const items = Array.isArray(details?.items) ? details.items : [];
  return items.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const itemRecord = item as Record<string, unknown>;
    const feedback = itemRecord.feedback;
    if (!feedback || typeof feedback !== "object" || Array.isArray(feedback)) return [];
    const aiFeedback = (feedback as Record<string, unknown>).aiFeedback;
    if (!aiFeedback || typeof aiFeedback !== "object" || Array.isArray(aiFeedback)) return [];
    const nested = aiFeedback as Record<string, unknown>;
    if (typeof nested.feedbackRef === "string" && typeof nested.feedbackVersion === "number" && nested.challengeAllowed === true) {
      return [{
        feedbackRef: nested.feedbackRef,
        feedbackVersion: nested.feedbackVersion,
        feedbackHash: typeof nested.feedbackHash === "string" ? nested.feedbackHash : null,
        activityId: typeof itemRecord.activityId === "string" ? itemRecord.activityId : null,
        pluginKey: typeof itemRecord.activityTypeKey === "string" ? itemRecord.activityTypeKey : null,
        testItemId: typeof itemRecord.testItemId === "string" ? itemRecord.testItemId : null
      }];
    }
    return [];
  });
}

function gradeSnapshot(grade: { id: string; rawScore: number; rawMaxScore: number; normalizedScore: number; normalizedMaxScore: number; source: string; gradedAt: Date }) {
  return {
    id: grade.id,
    rawScore: grade.rawScore,
    rawMaxScore: grade.rawMaxScore,
    normalizedScore: grade.normalizedScore,
    normalizedMaxScore: grade.normalizedMaxScore,
    source: grade.source,
    gradedAt: grade.gradedAt.toISOString()
  };
}

function isUniqueConstraintError(error: unknown) {
  return Boolean(error && typeof error === "object" && "code" in error && (error as { code?: unknown }).code === "P2002");
}
