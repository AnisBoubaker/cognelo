import {
  NonRetryableBackgroundJobError,
  enqueueBackgroundJob,
  isBackgroundJobHandlerRegistered,
  registerBackgroundJobHandler,
  type BackgroundJobRecord
} from "@cognelo/core";
import type { CurrentUser } from "@cognelo/contracts";
import { analyzeCodingHomeworkSubmission } from "./analysis";
import { generateCodingHomeworkChallengeQuestions, generateCodingHomeworkChallengeQuestionsForStudentSubmission } from "./generation";

export const codingHomeworkProcessingQueue = "coding-homework-grader";
export const codingHomeworkSubmissionProcessingHandlerKey = "coding-homework-grader.process-submission";

type CodingHomeworkProcessingScope = {
  activityId: string;
  courseId: string;
  groupId: string;
  user: CurrentUser;
};

type CodingHomeworkSubmissionProcessingPayload = CodingHomeworkProcessingScope & {
  locale?: "en" | "fr" | "zh" | "ar";
  mode?: "student" | "teacher";
  submissionId: string;
};

let unregisterCodingHomeworkProcessingHandler: (() => void) | null = null;

export function registerCodingHomeworkBackgroundJobs() {
  if (unregisterCodingHomeworkProcessingHandler) {
    return unregisterCodingHomeworkProcessingHandler;
  }
  if (isBackgroundJobHandlerRegistered(codingHomeworkSubmissionProcessingHandlerKey)) {
    unregisterCodingHomeworkProcessingHandler = () => undefined;
    return unregisterCodingHomeworkProcessingHandler;
  }

  unregisterCodingHomeworkProcessingHandler = registerBackgroundJobHandler(
    codingHomeworkSubmissionProcessingHandlerKey,
    async ({ job }) => processCodingHomeworkSubmissionJob(job)
  );
  return unregisterCodingHomeworkProcessingHandler;
}

export async function enqueueCodingHomeworkSubmissionProcessing(
  scope: CodingHomeworkProcessingScope,
  input: { locale?: "en" | "fr" | "zh" | "ar"; mode?: "student" | "teacher"; submissionId: string }
) {
  return enqueueBackgroundJob({
    handlerKey: codingHomeworkSubmissionProcessingHandlerKey,
    idempotencyKey: `submission:${input.submissionId}`,
    maxAttempts: 3,
    metadata: {
      activityId: scope.activityId,
      courseId: scope.courseId,
      groupId: scope.groupId,
      pluginKey: "coding-homework-grader",
      userId: scope.user.id
    },
    payload: {
      activityId: scope.activityId,
      courseId: scope.courseId,
      groupId: scope.groupId,
      locale: input.locale ?? "en",
      mode: input.mode ?? "student",
      submissionId: input.submissionId,
      user: scope.user
    },
    queue: codingHomeworkProcessingQueue
  });
}

async function processCodingHomeworkSubmissionJob(job: BackgroundJobRecord) {
  const payload = normalizeProcessingPayload(job.payload);
  const analysis = await analyzeCodingHomeworkSubmission(payload, { submissionId: payload.submissionId });
  const generation =
    payload.mode === "teacher"
      ? await generateCodingHomeworkChallengeQuestions(payload, {
          locale: payload.locale,
          submissionId: analysis.submission.id
        })
      : await generateCodingHomeworkChallengeQuestionsForStudentSubmission(payload, {
          locale: payload.locale,
          submissionId: analysis.submission.id
        });

  return {
    analysisStatus: analysis.analysis.status,
    generatedQuestionCount: generation.questions.length,
    submissionId: generation.submission.id,
    submissionStatus: generation.submission.status
  };
}

function normalizeProcessingPayload(payload: Record<string, unknown>): CodingHomeworkSubmissionProcessingPayload {
  const submissionId = typeof payload.submissionId === "string" ? payload.submissionId.trim() : "";
  const courseId = typeof payload.courseId === "string" ? payload.courseId.trim() : "";
  const groupId = typeof payload.groupId === "string" ? payload.groupId.trim() : "";
  const activityId = typeof payload.activityId === "string" ? payload.activityId.trim() : "";
  const user = normalizeUser(payload.user);
  if (!submissionId || !courseId || !groupId || !activityId || !user) {
    throw new NonRetryableBackgroundJobError("Coding homework submission processing job payload is invalid.", "CODING_HOMEWORK_JOB_PAYLOAD_INVALID");
  }
  return {
    activityId,
    courseId,
    groupId,
    locale: payload.locale === "fr" || payload.locale === "zh" || payload.locale === "ar" ? payload.locale : "en",
    mode: payload.mode === "teacher" ? "teacher" : "student",
    submissionId,
    user
  };
}

function normalizeUser(value: unknown): CurrentUser | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const record = value as Record<string, unknown>;
  const id = typeof record.id === "string" ? record.id : "";
  const email = typeof record.email === "string" ? record.email : "";
  const roles = Array.isArray(record.roles) ? record.roles.filter((role): role is CurrentUser["roles"][number] => typeof role === "string") : [];
  if (!id || !email || !roles.length) {
    return null;
  }
  return {
    email,
    firstName: typeof record.firstName === "string" ? record.firstName : null,
    id,
    lastName: typeof record.lastName === "string" ? record.lastName : null,
    name: typeof record.name === "string" ? record.name : null,
    roles
  };
}
