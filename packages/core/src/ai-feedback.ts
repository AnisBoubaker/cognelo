import { createHash } from "node:crypto";
import { prisma, type Prisma } from "@cognelo/db";
import type { CurrentUser } from "@cognelo/contracts";
import { assertCanManageCourse } from "./authorization";
import { assertCanViewCourse } from "./authorization";
import { AppError, notFound } from "./errors";

type JsonInput = Prisma.InputJsonValue;
const ATTEMPT_TEACHER_FEEDBACK_KEY = "teacherFeedback";

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
  if (attempt.lifecycle !== "submitted" && attempt.lifecycle !== "graded") {
    throw new AppError(409, "FEEDBACK_SUBMISSION_REQUIRED", "Feedback is available only after the learner submits the activity.");
  }
  const grade = await prisma.grade.findUnique({
    where: {
      gradebookItemId_participantId: {
        gradebookItemId: attempt.gradebookItemId,
        participantId: attempt.participantId
      }
    }
  });
  const selectedGrade = grade?.selectedAttemptId === attempt.id ? grade : null;
  const gradeFeedback = selectedGrade ? readStoredStudentFeedback(selectedGrade.normalizedResult) : {};
  const attemptFeedback = readAttemptTeacherFeedback(attempt.metadata);
  const feedback = isStoredTeacherFeedback(gradeFeedback)
    ? gradeFeedback
    : isStoredTeacherFeedback(attemptFeedback)
      ? attemptFeedback
      : null;
  return {
    attemptId: attempt.id,
    gradeId: selectedGrade?.id ?? null,
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
  if (attempt.lifecycle !== "submitted" && attempt.lifecycle !== "graded") {
    throw new AppError(409, "FEEDBACK_SUBMISSION_REQUIRED", "Feedback is available only after the learner submits the activity.");
  }
  const grade = await prisma.grade.findUnique({
    where: {
      gradebookItemId_participantId: {
        gradebookItemId: attempt.gradebookItemId,
        participantId: attempt.participantId
      }
    }
  });
  const selectedGrade = grade?.selectedAttemptId === attempt.id ? grade : null;
  const normalizedResult = asRecord(selectedGrade?.normalizedResult);
  const gradeFeedback = selectedGrade ? readStoredStudentFeedback(selectedGrade.normalizedResult) : {};
  const attemptFeedback = readAttemptTeacherFeedback(attempt.metadata);
  const currentFeedback = isStoredTeacherFeedback(gradeFeedback)
    ? gradeFeedback
    : isStoredTeacherFeedback(attemptFeedback)
      ? attemptFeedback
      : {};
  const hasCurrentFeedback = isStoredTeacherFeedback(currentFeedback);
  const feedbackRef = hasCurrentFeedback
    ? String(currentFeedback.feedbackRef)
    : `teacher-feedback:${attempt.id}`;
  const feedbackVersion = hasCurrentFeedback
    ? Number(currentFeedback.feedbackVersion)
    : 1;
  if (hasCurrentFeedback) {
    const existingChallenge = await prisma.gradeChallenge.findFirst({
      where: { participantId: attempt.participantId, feedbackRef, feedbackVersion },
      select: { id: true }
    });
    if (existingChallenge) {
      throw new AppError(409, "AI_FEEDBACK_ALREADY_CHALLENGED", "Feedback cannot be edited after a learner has challenged this version.");
    }
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
    "kind",
    "feedbackOrigin",
    "authoredByTeacher",
    "authoredAt",
    "teacherRevision",
    "reviewedByTeacher",
    "reviewedAt"
  ].includes(key)));
  const kind = hasCurrentFeedback && typeof currentFeedback.kind === "string"
    ? currentFeedback.kind
    : typeof revisedFeedback.kind === "string" && revisedFeedback.kind.trim()
      ? revisedFeedback.kind.trim()
      : "assessment_feedback";
  const feedbackOrigin = typeof currentFeedback.feedbackOrigin === "string"
    ? currentFeedback.feedbackOrigin
    : kind === "ai_assessment_feedback"
      ? "generated"
      : "teacher";
  const challengeAllowed = hasCurrentFeedback && currentFeedback.challengeAllowed === true;
  const feedbackForHash = {
    ...revisedContent,
    kind,
    feedbackRef,
    feedbackVersion,
    challengeAllowed
  };
  const previousFeedbackHash = hasCurrentFeedback && typeof currentFeedback.feedbackHash === "string"
    ? currentFeedback.feedbackHash
    : hasCurrentFeedback
      ? hashAiFeedbackValue(currentFeedback)
      : null;
  const feedbackHash = hashAiFeedbackValue(feedbackForHash);
  const nextFeedback = {
    ...revisedContent,
    kind,
    feedbackRef,
    feedbackVersion,
    feedbackHash,
    challengeAllowed,
    feedbackOrigin,
    ...(feedbackOrigin === "teacher" ? {
      authoredByTeacher: true,
      authoredAt: typeof currentFeedback.authoredAt === "string" ? currentFeedback.authoredAt : now.toISOString()
    } : {}),
    teacherRevision,
    reviewedByTeacher: true,
    reviewedAt: now.toISOString()
  };
  const nextNormalizedResult = { ...normalizedResult, studentFeedback: nextFeedback };
  const gradeSnapshot = selectedGrade
    ? {
        attemptId: selectedGrade.selectedAttemptId,
        rawScore: selectedGrade.rawScore,
        rawMaxScore: selectedGrade.rawMaxScore,
        normalizedScore: selectedGrade.normalizedScore,
        normalizedMaxScore: selectedGrade.normalizedMaxScore,
        isPass: selectedGrade.isPass,
        source: selectedGrade.source
      }
    : { attemptId: attempt.id, lifecycle: attempt.lifecycle };

  await prisma.$transaction(async (tx) => {
    await tx.activityAttempt.update({
      where: { id: attempt.id },
      data: {
        metadata: {
          ...asRecord(attempt.metadata),
          [ATTEMPT_TEACHER_FEEDBACK_KEY]: nextFeedback
        } as JsonInput
      }
    });
    if (selectedGrade) {
      await tx.grade.update({
        where: { id: selectedGrade.id },
        data: {
          normalizedResult: nextNormalizedResult as JsonInput,
          metadata: {
            ...asRecord(selectedGrade.metadata),
            aiFeedbackRef: feedbackRef,
            aiFeedbackVersion: feedbackVersion,
            teacherFeedbackRevision: teacherRevision,
            reviewedByUserId: user.id,
            reviewedAt: now.toISOString()
          } as JsonInput
        }
      });
    }
    await tx.gradeEvent.create({
      data: {
        gradeId: selectedGrade?.id ?? null,
        gradebookItemId: attempt.gradebookItemId,
        participantId: attempt.participantId,
        attemptId: attempt.id,
        actorUserId: user.id,
        eventType: "ai_feedback_recorded",
        previousValue: hasCurrentFeedback
          ? { ...gradeSnapshot, studentFeedback: currentFeedback } as JsonInput
          : gradeSnapshot as JsonInput,
        nextValue: { ...gradeSnapshot, studentFeedback: nextFeedback } as JsonInput,
        reason: hasCurrentFeedback ? "Teacher feedback revision" : "Teacher feedback authored",
        metadata: {
          action: hasCurrentFeedback ? "teacher_revision" : "teacher_authored",
          feedbackOrigin,
          feedbackRef,
          feedbackVersion,
          teacherRevision,
          ...(previousFeedbackHash ? { previousFeedbackHash } : {}),
          feedbackHash,
          gradesReleased: attempt.gradebookItem.gradesReleased
        } as JsonInput,
        createdAt: now
      }
    });
    await tx.aiFeedbackResearchEvent.create({
      data: {
        eventType: hasCurrentFeedback ? "feedback_teacher_revised" : "feedback_teacher_authored",
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
        outcome: hasCurrentFeedback ? "revised" : "authored",
        metadata: {
          teacherRevision,
          feedbackOrigin,
          ...(previousFeedbackHash ? { previousFeedbackHash } : {}),
          gradesReleased: attempt.gradebookItem.gradesReleased,
          ...(selectedGrade ? { gradeId: selectedGrade.id } : {})
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

function readAttemptTeacherFeedback(value: unknown) {
  return asRecord(asRecord(value)[ATTEMPT_TEACHER_FEEDBACK_KEY]);
}

function isStoredTeacherFeedback(value: Record<string, unknown>) {
  return typeof value.kind === "string"
    && typeof value.feedbackRef === "string"
    && typeof value.feedbackVersion === "number";
}
