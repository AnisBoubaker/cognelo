import { z } from "zod";
import { AppError, startActivityAttempt, submitActivityAttempt } from "@cognelo/core";
import type { CurrentUser } from "@cognelo/contracts";
import { Prisma, prisma } from "./db-client";
import { toStudentChallengeQuestionRecord } from "./generation";

type AnswerScope = {
  activityId: string;
  courseId: string;
  groupId: string;
  user: CurrentUser;
};

type SubmissionRow = {
  id: string;
  activityId: string;
  groupId: string;
  userId: string;
  coreAttemptId: string | null;
  documentationSnapshotId: string | null;
  zipAttachmentId: string | null;
  kind: string;
  status: string;
  structureValidationSummary: unknown;
  processingError: string | null;
  metadata: unknown;
  createdAt: Date;
  updatedAt: Date;
};

type ChallengeQuestionRow = {
  id: string;
  submissionId: string;
  submissionFunctionId: string | null;
  orderIndex: number;
  questionText: string;
  studentAnswer: string | null;
  answerSubmittedAt: Date | null;
  generationModel: string;
  generationPromptVersion: string;
  nearestExamples: unknown;
  metadata: unknown;
  createdAt: Date;
  updatedAt: Date;
};

type SubmissionWithQuestions = SubmissionRow & {
  questions: ChallengeQuestionRow[];
};

type ChallengeAnswerGradebookOptions = {
  activityConfigFingerprint?: string | null;
  assessmentMode?: string | null;
  pluginVersion?: string;
};

const challengeAnswersInputSchema = z.object({
  answers: z
    .array(
      z.object({
        answer: z.string().max(12000),
        questionId: z.string().trim().min(1)
      })
    )
    .default([]),
  submissionId: z.string().trim().min(1).nullable().optional()
});

export async function saveCodingHomeworkChallengeAnswers(
  scope: AnswerScope,
  input: unknown,
  options: {
    finalize: boolean;
    gradebook?: ChallengeAnswerGradebookOptions;
  }
) {
  const parsed = challengeAnswersInputSchema.parse(input ?? {});
  const submission = await findStudentChallengeSubmission(scope, parsed.submissionId ?? null);
  if (!submission) {
    throw new AppError(404, "CODING_HOMEWORK_SUBMISSION_NOT_FOUND", "The requested submission was not found.");
  }
  if (submission.status === "ready_for_grading" || submission.status === "graded") {
    throw new AppError(409, "CODING_HOMEWORK_SUBMISSION_LOCKED", "This submission is complete and cannot be edited.");
  }
  if (submission.status !== "challenge_ready") {
    throw new AppError(400, "CODING_HOMEWORK_CHALLENGES_NOT_READY", "Challenge questions are not ready for this submission.");
  }
  if (!submission.questions.length) {
    throw new AppError(400, "CODING_HOMEWORK_CHALLENGES_NOT_READY", "Challenge questions are not ready for this submission.");
  }

  const questionsById = new Map(submission.questions.map((question) => [question.id, question]));
  const incomingAnswers = new Map<string, string>();
  for (const answer of parsed.answers) {
    if (!questionsById.has(answer.questionId)) {
      throw new AppError(400, "CODING_HOMEWORK_QUESTION_NOT_FOUND", "One answer targets a question that is not part of this submission.");
    }
    incomingAnswers.set(answer.questionId, answer.answer);
  }

  const nextAnswers = new Map(submission.questions.map((question) => [question.id, question.studentAnswer ?? ""]));
  for (const [questionId, answer] of incomingAnswers) {
    nextAnswers.set(questionId, answer);
  }

  if (options.finalize) {
    const missingQuestion = submission.questions.find((question) => !nextAnswers.get(question.id)?.trim());
    if (missingQuestion) {
      throw new AppError(400, "CODING_HOMEWORK_CHALLENGE_ANSWERS_INCOMPLETE", "Answer every challenge question before submitting.");
    }
  }

  const submittedAt = options.finalize ? new Date() : null;
  for (const question of submission.questions) {
    const nextAnswer = nextAnswers.get(question.id) ?? "";
    if (incomingAnswers.has(question.id) || options.finalize) {
      await prisma.pluginCodingHomeworkChallengeQuestion.update({
        where: { id: question.id },
        data: {
          answerSubmittedAt: submittedAt,
          studentAnswer: nextAnswer
        }
      });
    }
  }

  const coreAttemptId =
    options.finalize && !submission.coreAttemptId && options.gradebook?.assessmentMode === "summative"
      ? await createSubmittedCoreAttempt(scope, submission, nextAnswers, submittedAt ?? new Date(), options.gradebook)
      : submission.coreAttemptId;

  const updatedSubmission = await prisma.pluginCodingHomeworkSubmission.update({
    where: { id: submission.id },
    data: {
      coreAttemptId,
      metadata: {
        ...normalizeObject(submission.metadata),
        challengeAnswers: {
          savedAt: new Date().toISOString(),
          status: options.finalize ? "submitted" : "draft"
        }
      } as Prisma.InputJsonValue,
      processingError: null,
      status: options.finalize ? "ready_for_grading" : "challenge_ready"
    }
  });

  const refreshedQuestions = submission.questions.map((question) => ({
    ...question,
    answerSubmittedAt: options.finalize ? submittedAt : question.answerSubmittedAt,
    studentAnswer: nextAnswers.get(question.id) ?? question.studentAnswer
  }));

  return {
    questions: refreshedQuestions.map(toStudentChallengeQuestionRecord),
    submission: toSubmissionRecord(updatedSubmission)
  };
}

async function createSubmittedCoreAttempt(
  scope: AnswerScope,
  submission: SubmissionWithQuestions,
  answers: Map<string, string>,
  submittedAt: Date,
  gradebook: ChallengeAnswerGradebookOptions
) {
  const submittedAnswers = Object.fromEntries(submission.questions.map((question) => [question.id, answers.get(question.id) ?? ""]));
  const metadata = {
    mode: "summative",
    questionCount: submission.questions.length,
    submittedAnswers,
    submittedAt: submittedAt.toISOString(),
    submissionId: submission.id
  } as Prisma.InputJsonValue;
  const coreAttempt = await startActivityAttempt(scope.user, {
    courseId: scope.courseId,
    groupId: scope.groupId,
    activityId: scope.activityId,
    pluginKey: "coding-homework-grader",
    pluginVersion: gradebook.pluginVersion ?? "0.1.0",
    pluginAttemptRef: submission.id,
    activityConfigFingerprint: gradebook.activityConfigFingerprint ?? null,
    metadata
  });
  const submittedAttempt = await submitActivityAttempt(scope.user, {
    attemptId: coreAttempt.id,
    pluginAttemptRef: submission.id,
    metadata
  });
  return submittedAttempt.id;
}

async function findStudentChallengeSubmission(scope: AnswerScope, submissionId: string | null): Promise<SubmissionWithQuestions | null> {
  return prisma.pluginCodingHomeworkSubmission.findFirst({
    where: {
      ...(submissionId ? { id: submissionId } : {}),
      activityId: scope.activityId,
      groupId: scope.groupId,
      kind: "final",
      userId: scope.user.id
    },
    orderBy: { createdAt: "desc" },
    include: {
      questions: {
        orderBy: { orderIndex: "asc" }
      }
    }
  });
}

function toSubmissionRecord(row: SubmissionRow) {
  return {
    id: row.id,
    activityId: row.activityId,
    coreAttemptId: row.coreAttemptId,
    createdAt: row.createdAt.toISOString(),
    documentationSnapshotId: row.documentationSnapshotId,
    groupId: row.groupId,
    kind: row.kind,
    metadata: normalizeObject(row.metadata),
    processingError: row.processingError,
    status: row.status,
    structureValidationSummary: normalizeObject(row.structureValidationSummary),
    updatedAt: row.updatedAt.toISOString(),
    userId: row.userId,
    zipAttachmentId: row.zipAttachmentId
  };
}

function normalizeObject(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}
