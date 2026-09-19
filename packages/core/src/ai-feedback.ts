import { createHash } from "node:crypto";
import { prisma, type Prisma } from "@cognelo/db";
import type { CurrentUser } from "@cognelo/contracts";
import { assertCanManageCourse } from "./authorization";
import { assertCanViewCourse } from "./authorization";
import { AppError, notFound } from "./errors";

type JsonInput = Prisma.InputJsonValue;

export type AiFeedbackResearchEventInput = {
  eventType: string;
  courseId: string;
  groupId?: string | null;
  activityId: string;
  groupActivityId?: string | null;
  gradebookItemId?: string | null;
  participantId?: string | null;
  userId?: string | null;
  attemptId?: string | null;
  actorUserId?: string | null;
  pluginKey: string;
  feedbackRef?: string | null;
  feedbackVersion?: number | null;
  assessmentMode: "formative" | "summative";
  triggerKind: string;
  provider?: string | null;
  model?: string | null;
  rubricVersion?: string | null;
  promptVersion?: string | null;
  schemaVersion?: string | null;
  submissionHash?: string | null;
  feedbackHash?: string | null;
  aiContribution?: number | null;
  outcome?: string | null;
  metadata?: JsonInput;
};

export async function recordAiFeedbackResearchEvent(input: AiFeedbackResearchEventInput) {
  return prisma.aiFeedbackResearchEvent.create({
    data: {
      ...input,
      metadata: input.metadata ?? {}
    }
  });
}

export async function listCourseAiFeedbackResearchEvents(user: CurrentUser, courseId: string) {
  await assertCanManageCourse(user, courseId);
  return prisma.aiFeedbackResearchEvent.findMany({
    where: { courseId },
    orderBy: [{ createdAt: "desc" }]
  });
}

export async function getCourseAssessmentFeedbackPolicy(user: CurrentUser, courseId: string) {
  await assertCanViewCourse(user, courseId);
  const course = await prisma.course.findUnique({ where: { id: courseId }, select: { metadata: true } });
  if (!course) throw notFound("Course");
  const metadata = asRecord(course.metadata);
  const aiSettings = asRecord(metadata.aiSettings);
  return {
    enabled: aiSettings.automaticFeedbackEnabled === true && typeof aiSettings.assessmentFeedbackAiAgentConnectionId === "string",
    automaticFeedbackEnabled: aiSettings.automaticFeedbackEnabled === true,
    assessmentFeedbackAiAgentConnectionId: typeof aiSettings.assessmentFeedbackAiAgentConnectionId === "string"
      ? aiSettings.assessmentFeedbackAiAgentConnectionId
      : null
  };
}

export function hashAiFeedbackValue(value: unknown) {
  return createHash("sha256").update(stableJson(value)).digest("hex");
}

export async function getTeacherAttemptAiFeedbackReview(user: CurrentUser, courseId: string, attemptId: string) {
  await assertCanManageCourse(user, courseId);
  const attempt = await prisma.activityAttempt.findFirst({
    where: { id: attemptId, courseId },
    include: {
      gradebookItem: { select: { id: true, gradesReleased: true } },
      participant: { select: { id: true, firstName: true, lastName: true, email: true } }
    }
  });
  if (!attempt) throw notFound("Activity attempt");
  const grade = await prisma.grade.findUnique({
    where: {
      gradebookItemId_participantId: {
        gradebookItemId: attempt.gradebookItemId,
        participantId: attempt.participantId
      }
    }
  });
  if (!grade || grade.selectedAttemptId !== attempt.id) {
    throw new AppError(409, "GRADE_ATTEMPT_NOT_SELECTED", "Feedback can only be reviewed for the attempt selected for this grade.");
  }
  const feedback = readStoredStudentFeedback(grade.normalizedResult);
  if (!feedback.kind || typeof feedback.feedbackRef !== "string" || typeof feedback.feedbackVersion !== "number") {
    throw new AppError(409, "AI_FEEDBACK_NOT_GENERATED", "Assessment feedback has not been generated for this attempt.");
  }
  return {
    attemptId: attempt.id,
    gradeId: grade.id,
    gradesReleased: attempt.gradebookItem.gradesReleased,
    participant: {
      id: attempt.participant.id,
      name: [attempt.participant.firstName, attempt.participant.lastName].filter(Boolean).join(" ") || attempt.participant.email,
      email: attempt.participant.email
    },
    feedback
  };
}

export async function reviseTeacherAttemptAiFeedback(
  user: CurrentUser,
  courseId: string,
  attemptId: string,
  revisedFeedback: Record<string, unknown>
) {
  await assertCanManageCourse(user, courseId);
  const attempt = await prisma.activityAttempt.findFirst({
    where: { id: attemptId, courseId },
    include: { gradebookItem: { select: { id: true, gradesReleased: true } } }
  });
  if (!attempt) throw notFound("Activity attempt");
  const grade = await prisma.grade.findUnique({
    where: {
      gradebookItemId_participantId: {
        gradebookItemId: attempt.gradebookItemId,
        participantId: attempt.participantId
      }
    }
  });
  if (!grade || grade.selectedAttemptId !== attempt.id) {
    throw new AppError(409, "GRADE_ATTEMPT_NOT_SELECTED", "Feedback can only be revised for the attempt selected for this grade.");
  }
  const normalizedResult = asRecord(grade.normalizedResult);
  const currentFeedback = readStoredStudentFeedback(grade.normalizedResult);
  const feedbackRef = typeof currentFeedback.feedbackRef === "string" ? currentFeedback.feedbackRef : null;
  const feedbackVersion = typeof currentFeedback.feedbackVersion === "number" ? currentFeedback.feedbackVersion : null;
  if (!currentFeedback.kind || !feedbackRef || feedbackVersion === null) {
    throw new AppError(409, "AI_FEEDBACK_NOT_GENERATED", "Assessment feedback has not been generated for this attempt.");
  }
  const existingChallenge = await prisma.gradeChallenge.findFirst({
    where: { participantId: attempt.participantId, feedbackRef, feedbackVersion },
    select: { id: true }
  });
  if (existingChallenge) {
    throw new AppError(409, "AI_FEEDBACK_ALREADY_CHALLENGED", "Feedback cannot be edited after a learner has challenged this version.");
  }

  const now = new Date();
  const teacherRevision = typeof currentFeedback.teacherRevision === "number"
    ? Math.max(0, Math.floor(currentFeedback.teacherRevision)) + 1
    : 1;
  const revisedContent = Object.fromEntries(Object.entries(revisedFeedback).filter(([key]) => ![
    "feedbackRef",
    "feedbackVersion",
    "feedbackHash",
    "challengeAllowed",
    "teacherRevision",
    "reviewedByTeacher",
    "reviewedAt"
  ].includes(key)));
  const feedbackForHash = {
    ...revisedContent,
    feedbackRef,
    feedbackVersion,
    challengeAllowed: currentFeedback.challengeAllowed === true
  };
  const previousFeedbackHash = typeof currentFeedback.feedbackHash === "string"
    ? currentFeedback.feedbackHash
    : hashAiFeedbackValue(currentFeedback);
  const feedbackHash = hashAiFeedbackValue(feedbackForHash);
  const nextFeedback = {
    ...revisedContent,
    kind: currentFeedback.kind,
    feedbackRef,
    feedbackVersion,
    feedbackHash,
    challengeAllowed: currentFeedback.challengeAllowed === true,
    teacherRevision,
    reviewedByTeacher: true,
    reviewedAt: now.toISOString()
  };
  const nextNormalizedResult = { ...normalizedResult, studentFeedback: nextFeedback };
  const gradeSnapshot = {
    attemptId: grade.selectedAttemptId,
    rawScore: grade.rawScore,
    rawMaxScore: grade.rawMaxScore,
    normalizedScore: grade.normalizedScore,
    normalizedMaxScore: grade.normalizedMaxScore,
    isPass: grade.isPass,
    source: grade.source
  };

  await prisma.$transaction(async (tx) => {
    await tx.grade.update({
      where: { id: grade.id },
      data: {
        normalizedResult: nextNormalizedResult as JsonInput,
        metadata: {
          ...asRecord(grade.metadata),
          aiFeedbackRef: feedbackRef,
          aiFeedbackVersion: feedbackVersion,
          teacherFeedbackRevision: teacherRevision,
          reviewedByUserId: user.id,
          reviewedAt: now.toISOString()
        } as JsonInput
      }
    });
    await tx.gradeEvent.create({
      data: {
        gradeId: grade.id,
        gradebookItemId: attempt.gradebookItemId,
        participantId: attempt.participantId,
        attemptId: attempt.id,
        actorUserId: user.id,
        eventType: "ai_feedback_recorded",
        previousValue: { ...gradeSnapshot, studentFeedback: currentFeedback } as JsonInput,
        nextValue: { ...gradeSnapshot, studentFeedback: nextFeedback } as JsonInput,
        reason: "Teacher feedback revision",
        metadata: {
          action: "teacher_revision",
          feedbackRef,
          feedbackVersion,
          teacherRevision,
          previousFeedbackHash,
          feedbackHash,
          gradesReleased: attempt.gradebookItem.gradesReleased
        } as JsonInput,
        createdAt: now
      }
    });
    await tx.aiFeedbackResearchEvent.create({
      data: {
        eventType: "feedback_teacher_revised",
        courseId,
        groupId: attempt.groupId,
        activityId: attempt.activityId,
        groupActivityId: attempt.groupActivityId,
        gradebookItemId: attempt.gradebookItemId,
        participantId: attempt.participantId,
        userId: attempt.userId,
        attemptId: attempt.id,
        actorUserId: user.id,
        pluginKey: attempt.pluginKey,
        feedbackRef,
        feedbackVersion,
        feedbackHash,
        assessmentMode: "summative",
        triggerKind: "teacher_feedback_review",
        outcome: "revised",
        metadata: {
          teacherRevision,
          previousFeedbackHash,
          gradesReleased: attempt.gradebookItem.gradesReleased,
          gradeId: grade.id
        } as JsonInput,
        createdAt: now
      }
    });
  });

  return { feedback: nextFeedback, teacherRevision, feedbackHash };
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableJson).join(",")}]`;
  }
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${stableJson(entry)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function readStoredStudentFeedback(value: unknown) {
  const feedback = asRecord(asRecord(value).studentFeedback);
  if (typeof feedback.feedbackRef === "string" && typeof feedback.feedbackVersion === "number") {
    return feedback;
  }
  const details = asRecord(feedback.details);
  if (typeof details.feedbackRef === "string" && typeof details.feedbackVersion === "number") {
    return {
      ...details,
      kind: feedback.kind,
      ...(typeof feedback.feedbackText === "string" ? { feedbackText: feedback.feedbackText } : {})
    };
  }
  return feedback;
}
