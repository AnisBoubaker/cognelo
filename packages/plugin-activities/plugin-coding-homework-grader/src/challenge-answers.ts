import { prisma as corePrisma, type Prisma as CorePrisma } from "@cognelo/db";
import { z } from "zod";
import { AppError, startActivityAttempt, submitActivityAttempt } from "@cognelo/core";
import type { CurrentUser } from "@cognelo/contracts";
import { Prisma } from "./db-client";
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
  return corePrisma.$transaction(async (tx) => {
  const candidates = await tx.$queryRaw<SubmissionRow[]>`SELECT * FROM "PluginCodingHomeworkSubmission"
    WHERE "activityId" = ${scope.activityId} AND "groupId" = ${scope.groupId} AND "userId" = ${scope.user.id}
      AND kind = 'final' AND (${parsed.submissionId ?? null}::text IS NULL OR id = ${parsed.submissionId ?? null})
      AND NOT (metadata ? 'deletion') ORDER BY "createdAt" DESC LIMIT 1 FOR UPDATE`;
  const row = candidates[0];
  const submission: SubmissionWithQuestions | null = row ? { ...row, questions: await tx.$queryRaw<ChallengeQuestionRow[]>`SELECT * FROM "PluginCodingHomeworkChallengeQuestion" WHERE "submissionId" = ${row.id} ORDER BY "orderIndex"` } : null;
  if (!submission) {
    throw new AppError(404, "CODING_HOMEWORK_SUBMISSION_NOT_FOUND", "The requested submission was not found.");
  }
  if (submission.status === "ready_for_grading" || submission.status === "graded") {
    if (options.finalize && parsed.answers.every((answer) => submission.questions.some((question) => question.id === answer.questionId && question.studentAnswer === answer.answer))) {
      return { questions: submission.questions.map(toStudentChallengeQuestionRecord), submission: toSubmissionRecord(submission) };
    }
    throw new AppError(409, "CODING_HOMEWORK_SUBMISSION_LOCKED", "This submission is complete and cannot be edited.");
  }
  if (submission.status !== "challenge_ready") {
    throw new AppError(400, "CODING_HOMEWORK_CHALLENGES_NOT_READY", "Challenge questions are not ready for this submission.");
  }
  if (!submission.questions.length) {
    throw new AppError(400, "CODING_HOMEWORK_CHALLENGES_NOT_READY", "Challenge questions are not ready for this submission.");
  }

  if (submission.coreAttemptId) {
    const [attempt] = await tx.$queryRaw<Array<{ lifecycle: string }>>`SELECT lifecycle FROM "ActivityAttempt" WHERE id = ${submission.coreAttemptId} FOR UPDATE`;
    if (!attempt || attempt.lifecycle !== "started") throw new AppError(409, "CODING_HOMEWORK_SUBMISSION_LOCKED", "This attempt is complete and cannot be edited.");
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
      await tx.$executeRaw`UPDATE "PluginCodingHomeworkChallengeQuestion" SET "answerSubmittedAt" = ${submittedAt}, "studentAnswer" = ${nextAnswer}, "updatedAt" = NOW() WHERE id = ${question.id}`;
    }
  }

  const coreAttemptId =
    options.finalize && options.gradebook
      ? await createSubmittedCoreAttempt(scope, submission, nextAnswers, submittedAt ?? new Date(), options.gradebook, tx)
      : submission.coreAttemptId;

  const metadata = { ...normalizeObject(submission.metadata), challengeAnswers: { savedAt: new Date().toISOString(), status: options.finalize ? "submitted" : "draft" } };
  const [updatedSubmission] = await tx.$queryRaw<SubmissionRow[]>`UPDATE "PluginCodingHomeworkSubmission"
    SET "coreAttemptId" = ${coreAttemptId}, metadata = ${JSON.stringify(metadata)}::jsonb, "processingError" = NULL,
    status = ${options.finalize ? "ready_for_grading" : "challenge_ready"}::"PluginCodingHomeworkSubmissionStatus", "updatedAt" = NOW()
    WHERE id = ${submission.id} RETURNING *`;

  const refreshedQuestions = submission.questions.map((question) => ({
    ...question,
    answerSubmittedAt: options.finalize ? submittedAt : question.answerSubmittedAt,
    studentAnswer: nextAnswers.get(question.id) ?? question.studentAnswer
  }));

  return {
    questions: refreshedQuestions.map(toStudentChallengeQuestionRecord),
    submission: toSubmissionRecord(updatedSubmission)
  };
  });
}

async function createSubmittedCoreAttempt(
  scope: AnswerScope,
  submission: SubmissionWithQuestions,
  answers: Map<string, string>,
  submittedAt: Date,
  gradebook: ChallengeAnswerGradebookOptions,
  tx: CorePrisma.TransactionClient
) {
  const assessmentMode = gradebook.assessmentMode === "summative" ? "summative" : "formative";
  const submittedAnswers = Object.fromEntries(submission.questions.map((question) => [question.id, answers.get(question.id) ?? ""]));
  const metadata = {
    mode: assessmentMode,
    questionCount: submission.questions.length,
    submittedAnswers,
    submittedAt: submittedAt.toISOString(),
    submissionId: submission.id
  } as Prisma.InputJsonValue;
  const coreAttempt = submission.coreAttemptId ? { id: submission.coreAttemptId } : await startActivityAttempt(scope.user, {
    courseId: scope.courseId,
    groupId: scope.groupId,
    activityId: scope.activityId,
    pluginKey: "coding-homework-grader",
    pluginVersion: gradebook.pluginVersion ?? "0.1.0",
    pluginAttemptRef: submission.id,
    assessmentMode,
    activityConfigFingerprint: gradebook.activityConfigFingerprint ?? null,
    metadata
  }, tx);
  const submittedAttempt = await submitActivityAttempt(scope.user, {
    attemptId: coreAttempt.id,
    pluginAttemptRef: submission.id,
    metadata
  }, tx);
  return submittedAttempt.id;
}

function toSubmissionRecord(row: SubmissionRow) {
  return {
    id: row.id,
    activityId: row.activityId,
    coreAttemptId: row.coreAttemptId,
    createdAt: row.createdAt.toISOString(),
    documentationSnapshotId: null,
    groupId: row.groupId,
    kind: row.kind,
    metadata: {},
    processingError: row.processingError ? "Processing could not be completed. Contact your course staff." : null,
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
