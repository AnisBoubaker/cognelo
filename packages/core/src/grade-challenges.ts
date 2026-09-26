import { z } from "zod";
import { prisma, type Prisma } from "@cognelo/db";
import type { CurrentUser } from "@cognelo/contracts";
import { assertCanManageCourse } from "./authorization";
import { recordAiFeedbackResearchEvent } from "./ai-feedback";
import { sendSystemEmailToEligibleRecipient } from "./email-delivery";
import { AppError, forbidden, notFound } from "./errors";

const createChallengeSchema = z.object({
  feedbackRef: z.string().min(1).max(200),
  feedbackVersion: z.number().int().min(1),
  explanation: z.string().trim().min(20).max(8000)
});

const resolveChallengeSchema = z.object({
  teacherResponse: z.string().trim().min(1).max(8000),
  notifyStudent: z.boolean().optional().default(false)
});

type ChallengeResolutionDependencies = {
  deliver?: typeof sendSystemEmailToEligibleRecipient;
};

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
  const [participants, activities, groups, gradebookItems] = await Promise.all([
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
    }),
    prisma.gradebookItem.findMany({
      where: { id: { in: challenges.map((challenge) => challenge.gradebookItemId) } },
      select: { id: true, activityId: true }
    })
  ]);
  const participantById = new Map(participants.map((participant) => [participant.id, participant]));
  const activityById = new Map(activities.map((activity) => [activity.id, activity]));
  const groupById = new Map(groups.map((group) => [group.id, group]));
  const gradebookItemById = new Map(gradebookItems.map((item) => [item.id, item]));
  return challenges.map((challenge) => {
    const participant = participantById.get(challenge.participantId);
    return {
      ...challenge,
      participantName: participant?.user?.name ?? participant?.user?.email ?? "Student",
      participantEmail: participant?.user?.email ?? "",
      activityTitle: activityById.get(challenge.activityId)?.title ?? "Activity",
      groupTitle: groupById.get(challenge.groupId)?.title ?? "Group",
      reviewActivityId: gradebookItemById.get(challenge.gradebookItemId)?.activityId ?? challenge.activityId
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

export async function resolveGradeChallenge(
  user: CurrentUser,
  courseId: string,
  challengeId: string,
  input: unknown,
  encryptionKey?: string,
  dependencies: ChallengeResolutionDependencies = {}
) {
  await assertCanManageCourse(user, courseId);
  const data = resolveChallengeSchema.parse(input);
  const challenge = await prisma.gradeChallenge.findFirst({ where: { id: challengeId, courseId } });
  if (!challenge) {
    throw notFound("Grade challenge");
  }
  if (challenge.status !== "open") {
    throw new AppError(409, "GRADE_CHALLENGE_ALREADY_RESOLVED", "This grade challenge has already been resolved.");
  }

  const currentGrade = await prisma.grade.findUnique({
    where: {
      gradebookItemId_participantId: {
        gradebookItemId: challenge.gradebookItemId,
        participantId: challenge.participantId
      }
    }
  });
  if (!currentGrade) {
    throw new AppError(409, "GRADE_NOT_AVAILABLE", "No grade is available for this challenge.");
  }
  const status = gradeChanged(challenge.releasedGradeSnapshot, currentGrade) ? "adjusted" : "upheld";
  const resultingGradeSnapshot = status === "adjusted"
    ? gradeSnapshot(currentGrade) as Prisma.InputJsonValue
    : undefined;

  if (data.notifyStudent) {
    const [participant, activity, course] = await Promise.all([
      prisma.courseGroupParticipant.findFirst({
        where: { id: challenge.participantId, groupId: challenge.groupId },
        select: { email: true }
      }),
      prisma.activity.findUnique({
        where: { id: challenge.activityId },
        select: { title: true }
      }),
      prisma.course.findUnique({
        where: { id: courseId },
        select: { title: true }
      })
    ]);
    if (!participant?.email) {
      throw new AppError(409, "GRADE_CHALLENGE_RECIPIENT_UNAVAILABLE", "The student does not have an email address.");
    }
    const activityTitle = activity?.title ?? "activity";
    const courseTitle = course?.title ?? "course";
    const adjustmentNote = status === "adjusted"
      ? " The grade was updated during the review."
      : " The grade was not changed during the review.";
    const deliver = dependencies.deliver ?? sendSystemEmailToEligibleRecipient;
    await deliver({
      recipientEmail: participant.email,
      subject: `Response to your grade challenge in ${courseTitle}`,
      text: `Your teacher responded to your grade challenge for ${activityTitle}.\n\n${data.teacherResponse}\n\n${adjustmentNote.trim()} Sign in to Cognelo to review the result.`,
      html: `<p>Your teacher responded to your grade challenge for <strong>${escapeHtml(activityTitle)}</strong>.</p><blockquote>${escapeHtml(data.teacherResponse).replaceAll("\n", "<br>")}</blockquote><p>${escapeHtml(adjustmentNote.trim())} Sign in to Cognelo to review the result.</p>`
    }, encryptionKey);
  }

  const resolved = await prisma.gradeChallenge.update({
    where: { id: challenge.id },
    data: {
      status,
      teacherResponse: data.teacherResponse,
      resolvedByUserId: user.id,
      resolvedAt: new Date(),
      resultingGradeSnapshot
    }
  });

  await recordAiFeedbackResearchEvent({
    eventType: status === "adjusted" ? "challenge_adjusted" : "challenge_upheld",
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
    outcome: status,
    metadata: { challengeId: challenge.id, gradeAdjusted: status === "adjusted", studentNotified: data.notifyStudent }
  });
  return { ...resolved, notificationSent: data.notifyStudent };
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

function gradeChanged(releasedSnapshot: unknown, currentGrade: { normalizedScore: number; normalizedMaxScore: number }) {
  if (!releasedSnapshot || typeof releasedSnapshot !== "object" || Array.isArray(releasedSnapshot)) return false;
  const released = releasedSnapshot as Record<string, unknown>;
  return released.normalizedScore !== currentGrade.normalizedScore || released.normalizedMaxScore !== currentGrade.normalizedMaxScore;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function isUniqueConstraintError(error: unknown) {
  return Boolean(error && typeof error === "object" && "code" in error && (error as { code?: unknown }).code === "P2002");
}
