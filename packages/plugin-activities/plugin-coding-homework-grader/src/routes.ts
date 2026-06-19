import type { PluginRouteDefinition, PluginRouteContext } from "@cognelo/activity-sdk/server";
import { AppError, assertCanManageActivityBank, assertCanManageCourse, getBackgroundJob } from "@cognelo/core";
import { prisma as corePrisma } from "@cognelo/db";
import { analyzeCodingHomeworkSubmission } from "./analysis";
import { saveCodingHomeworkChallengeAnswers } from "./challenge-answers";
import {
  getCodingHomeworkAuthoring,
  importCodingHomeworkRequirements,
  saveCodingHomeworkAuthoring,
  uploadCodingHomeworkAssignmentPdf
} from "./authoring";
import { buildCodingHomeworkDocumentationPreview, createCodingHomeworkDocumentationSnapshot } from "./documentation";
import { extractCodingHomeworkDocumentationSnapshot } from "./extraction";
import { generateCodingHomeworkChallengeQuestions } from "./generation";
import { prisma } from "./db-client";
import { enqueueCodingHomeworkSubmissionProcessing } from "./background-processing";
import { runCodingHomeworkPreflight } from "./preflight";
import { searchCodingHomeworkReferenceContent } from "./reference-search";
import { getCodingHomeworkStudentAssignment, getLatestCodingHomeworkSubmission, runCodingHomeworkSubmission } from "./submission";

function requireCourseId(courseId: string | undefined) {
  if (!courseId) {
    throw new AppError(400, "COURSE_CONTEXT_REQUIRED", "This plugin route requires a course context.");
  }
  return courseId;
}

function normalizeReprocessInput(input: unknown) {
  const record = input && typeof input === "object" && !Array.isArray(input) ? (input as Record<string, unknown>) : {};
  const submissionId = typeof record.submissionId === "string" ? record.submissionId.trim() : "";
  if (!submissionId) {
    throw new AppError(400, "CODING_HOMEWORK_SUBMISSION_REQUIRED", "A submission id is required.");
  }
  const locale = normalizeLocale(record.locale);
  return { locale, submissionId };
}

async function resolveOwner(context: PluginRouteContext) {
  if (context.activityBankId) {
    await assertCanManageActivityBank(context.user, context.activityBankId);
    return {
      ownerKind: "bank_activity" as const,
      ownerId: context.activity.id
    };
  }

  const courseId = requireCourseId(context.courseId);
  await assertCanManageCourse(context.user, courseId);
  return {
    ownerKind: "course_activity" as const,
    ownerId: context.activity.id
  };
}

async function resolveCourseSnapshotScope(context: PluginRouteContext) {
  if (context.activityBankId) {
    throw new AppError(400, "COURSE_CONTEXT_REQUIRED", "Documentation snapshots require a course activity.");
  }

  const courseId = requireCourseId(context.courseId);
  await assertCanManageCourse(context.user, courseId);
  return {
    user: context.user,
    courseId,
    groupId: context.groupId ?? null,
    activityId: context.activity.id,
    courseGroupActivityId: context.activity.assignment?.id ?? null
  };
}

function resolveStudentSubmissionScope(context: PluginRouteContext) {
  const courseId = requireCourseId(context.courseId);
  if (!context.groupId) {
    throw new AppError(400, "GROUP_CONTEXT_REQUIRED", "Student submissions require an assigned group activity context.");
  }
  return {
    user: context.user,
    courseId,
    groupId: context.groupId,
    activityId: context.activity.id
  };
}

async function resolveTeacherSubmissionScope(context: PluginRouteContext) {
  const courseId = requireCourseId(context.courseId);
  if (!context.groupId) {
    throw new AppError(400, "GROUP_CONTEXT_REQUIRED", "Submission processing requires an assigned group activity context.");
  }
  await assertCanManageCourse(context.user, courseId);
  return {
    user: context.user,
    courseId,
    groupId: context.groupId,
    activityId: context.activity.id
  };
}

export const codingHomeworkAuthoringRoute: PluginRouteDefinition = {
  path: "coding-homework-grader/authoring",
  activityTypeKeys: ["coding-homework-grader"],
  methods: {
    GET: async ({ context }) => {
      return getCodingHomeworkAuthoring(await resolveOwner(context));
    },
    PUT: async ({ context, readJson }) => {
      return saveCodingHomeworkAuthoring(await resolveOwner(context), await readJson());
    }
  }
};

export const codingHomeworkAssignmentPdfRoute: PluginRouteDefinition = {
  path: "coding-homework-grader/assignment-pdf",
  activityTypeKeys: ["coding-homework-grader"],
  methods: {
    POST: async ({ context, readJson }) => {
      return uploadCodingHomeworkAssignmentPdf(await resolveOwner(context), await readJson());
    }
  }
};

export const codingHomeworkRequirementsUploadRoute: PluginRouteDefinition = {
  path: "coding-homework-grader/requirements-upload",
  activityTypeKeys: ["coding-homework-grader"],
  methods: {
    POST: async ({ context, readJson }) => {
      return importCodingHomeworkRequirements(await resolveOwner(context), await readJson());
    }
  }
};

export const codingHomeworkDocumentationPreviewRoute: PluginRouteDefinition = {
  path: "coding-homework-grader/documentation-preview",
  activityTypeKeys: ["coding-homework-grader"],
  methods: {
    GET: async ({ context }) => {
      return buildCodingHomeworkDocumentationPreview(await resolveCourseSnapshotScope(context));
    }
  }
};

export const codingHomeworkDocumentationSnapshotRoute: PluginRouteDefinition = {
  path: "coding-homework-grader/documentation-snapshot",
  activityTypeKeys: ["coding-homework-grader"],
  methods: {
    POST: async ({ context }) => {
      return createCodingHomeworkDocumentationSnapshot(await resolveCourseSnapshotScope(context));
    }
  }
};

export const codingHomeworkDocumentationExtractionRoute: PluginRouteDefinition = {
  path: "coding-homework-grader/documentation-extraction",
  activityTypeKeys: ["coding-homework-grader"],
  methods: {
    POST: async ({ context, readJson }) => {
      return extractCodingHomeworkDocumentationSnapshot(await resolveCourseSnapshotScope(context), (await readJson()) as { snapshotId?: string | null });
    }
  }
};

export const codingHomeworkReferenceSearchRoute: PluginRouteDefinition = {
  path: "coding-homework-grader/reference-search",
  activityTypeKeys: ["coding-homework-grader"],
  methods: {
    POST: async ({ context, readJson }) => {
      return searchCodingHomeworkReferenceContent(await resolveCourseSnapshotScope(context), await readJson());
    }
  }
};

export const codingHomeworkPreflightRoute: PluginRouteDefinition = {
  path: "coding-homework-grader/preflight",
  activityTypeKeys: ["coding-homework-grader"],
  methods: {
    POST: async ({ context, readJson }) => {
      const courseId = requireCourseId(context.courseId);
      return runCodingHomeworkPreflight(
        {
          user: context.user,
          courseId,
          groupId: context.groupId ?? null,
          activityId: context.activity.id
        },
        await readJson()
      );
    }
  }
};

export const codingHomeworkStudentAssignmentRoute: PluginRouteDefinition = {
  path: "coding-homework-grader/assignment",
  activityTypeKeys: ["coding-homework-grader"],
  methods: {
    GET: async ({ context }) => {
      return getCodingHomeworkStudentAssignment(resolveStudentSubmissionScope(context));
    }
  }
};

export const codingHomeworkSubmissionRoute: PluginRouteDefinition = {
  path: "coding-homework-grader/submission",
  activityTypeKeys: ["coding-homework-grader"],
  methods: {
    GET: async ({ context }) => {
      return getLatestCodingHomeworkSubmission(resolveStudentSubmissionScope(context));
    },
    POST: async ({ context, readJson }) => {
      const scope = resolveStudentSubmissionScope(context);
      const input = await readJson();
      const submissionResult = await runCodingHomeworkSubmission(scope, input);
      if (!submissionResult.summary.isValid) {
        return submissionResult;
      }
      if (
        submissionResult.idempotent &&
        submissionResult.questions?.length &&
        ["challenge_ready", "ready_for_grading", "graded"].includes(submissionResult.submission.status)
      ) {
        return submissionResult;
      }
      const job = await enqueueCodingHomeworkSubmissionProcessing(scope, {
        locale: input && typeof input === "object" && !Array.isArray(input) ? normalizeLocale((input as Record<string, unknown>).locale) : "en",
        mode: "student",
        submissionId: submissionResult.submission.id
      });
      return {
        ...submissionResult,
        processingJob: toProcessingJobRecord(job)
      };
    }
  }
};

export const codingHomeworkReprocessRoute: PluginRouteDefinition = {
  path: "coding-homework-grader/reprocess",
  activityTypeKeys: ["coding-homework-grader"],
  methods: {
    POST: async ({ context, readJson }) => {
      const scope = await resolveTeacherSubmissionScope(context);
      const input = normalizeReprocessInput(await readJson());
      const submission = await prisma.pluginCodingHomeworkSubmission.findFirst({
        where: {
          id: input.submissionId,
          activityId: scope.activityId,
          groupId: scope.groupId,
          kind: "final"
        }
      });
      if (!submission) {
        throw new AppError(404, "CODING_HOMEWORK_SUBMISSION_NOT_FOUND", "The requested submission was not found.");
      }
      if (submission.status === "ready_for_grading" || submission.status === "graded") {
        throw new AppError(409, "CODING_HOMEWORK_SUBMISSION_LOCKED", "Completed coding homework submissions cannot be reprocessed.");
      }
      if (submission.status === "invalid_structure") {
        throw new AppError(400, "CODING_HOMEWORK_SUBMISSION_INVALID_STRUCTURE", "Fix the submission structure before reprocessing.");
      }

      const job = await enqueueCodingHomeworkSubmissionProcessing(scope, {
        locale: input.locale,
        mode: "teacher",
        submissionId: submission.id
      });
      return {
        processingJob: toProcessingJobRecord(job),
        submission
      };
    }
  }
};

export const codingHomeworkProcessingJobRoute: PluginRouteDefinition = {
  path: "coding-homework-grader/processing-job",
  activityTypeKeys: ["coding-homework-grader"],
  methods: {
    GET: async ({ context, request }) => {
      resolveStudentSubmissionScope(context);
      const jobId = new URL(request.url).searchParams.get("jobId")?.trim();
      if (!jobId) {
        throw new AppError(400, "BACKGROUND_JOB_REQUIRED", "A background job id is required.");
      }
      const job = await getBackgroundJob(jobId);
      if (
        !job ||
        job.metadata.pluginKey !== "coding-homework-grader" ||
        job.metadata.activityId !== context.activity.id ||
        job.metadata.groupId !== context.groupId ||
        job.metadata.userId !== context.user.id
      ) {
        throw new AppError(404, "BACKGROUND_JOB_NOT_FOUND", "The processing job was not found.");
      }
      return { processingJob: toProcessingJobRecord(job) };
    }
  }
};

export const codingHomeworkSubmissionAnalysisRoute: PluginRouteDefinition = {
  path: "coding-homework-grader/submission-analysis",
  activityTypeKeys: ["coding-homework-grader"],
  methods: {
    POST: async ({ context, readJson }) => {
      return analyzeCodingHomeworkSubmission(resolveStudentSubmissionScope(context), await readJson());
    }
  }
};

function normalizeLocale(value: unknown): "en" | "fr" | "zh" | "ar" {
  return value === "fr" || value === "zh" || value === "ar" ? value : "en";
}

function toProcessingJobRecord(job: Awaited<ReturnType<typeof getBackgroundJob>>) {
  if (!job) {
    return null;
  }
  return {
    attempts: job.attempts,
    completedAt: job.completedAt?.toISOString() ?? null,
    createdAt: job.createdAt.toISOString(),
    error: job.error,
    failedAt: job.failedAt?.toISOString() ?? null,
    handlerKey: job.handlerKey,
    id: job.id,
    queue: job.queue,
    result: job.result,
    status: job.status,
    updatedAt: job.updatedAt.toISOString()
  };
}

export const codingHomeworkChallengeGenerationRoute: PluginRouteDefinition = {
  path: "coding-homework-grader/challenge-generation",
  activityTypeKeys: ["coding-homework-grader"],
  methods: {
    POST: async ({ context, readJson }) => {
      return generateCodingHomeworkChallengeQuestions(await resolveTeacherSubmissionScope(context), await readJson());
    }
  }
};

export const codingHomeworkChallengeAnswersRoute: PluginRouteDefinition = {
  path: "coding-homework-grader/challenge-answers",
  activityTypeKeys: ["coding-homework-grader"],
  methods: {
    PUT: async ({ context, readJson }) => {
      return saveCodingHomeworkChallengeAnswers(resolveStudentSubmissionScope(context), await readJson(), { finalize: false });
    },
    POST: async ({ context, readJson }) => {
      return saveCodingHomeworkChallengeAnswers(resolveStudentSubmissionScope(context), await readJson(), {
        finalize: true,
        gradebook: {
          assessmentMode: typeof context.activity.assignment?.metadata?.assessmentMode === "string"
            ? context.activity.assignment.metadata.assessmentMode
            : null,
          pluginVersion: "0.1.0"
        }
      });
    }
  }
};

export const codingHomeworkGradebookAttemptsRoute: PluginRouteDefinition = {
  path: "coding-homework-grader/gradebook-attempts",
  activityTypeKeys: ["coding-homework-grader"],
  methods: {
    GET: async ({ context, request }) => {
      const courseId = requireCourseId(context.courseId);
      if (!context.groupId) {
        throw new AppError(400, "GROUP_CONTEXT_REQUIRED", "Gradebook attempts require a group activity context.");
      }
      await assertCanManageCourse(context.user, courseId);

      const participantId = new URL(request.url).searchParams.get("participantId");
      if (!participantId) {
        throw new AppError(400, "PARTICIPANT_REQUIRED", "A participant is required.");
      }

      const participant = await corePrisma.courseGroupParticipant.findFirst({
        where: {
          id: participantId,
          groupId: context.groupId,
          role: "student"
        },
        select: {
          id: true,
          userId: true,
          firstName: true,
          lastName: true,
          email: true
        }
      });
      if (!participant) {
        throw new AppError(404, "PARTICIPANT_NOT_FOUND", "The participant was not found.");
      }
      if (!participant.userId) {
        return { participant, attempts: [] };
      }

      const includeAttempts = new URL(request.url).searchParams.get("includeAttempts") === "true";
      const submissions = await listCodingHomeworkGradebookSubmissions({
        activityId: context.activity.id,
        groupId: context.groupId,
        includeAttempts,
        userId: participant.userId
      });

      const coreAttemptIds = submissions.map((submission) => submission.coreAttemptId).filter((id): id is string => Boolean(id));
      const coreAttempts = coreAttemptIds.length
        ? await corePrisma.activityAttempt.findMany({
            where: {
              id: { in: coreAttemptIds },
              courseId,
              groupId: context.groupId,
              activityId: context.activity.id,
              participantId,
              pluginKey: "coding-homework-grader",
              lifecycle: { not: "deleted" }
            },
            select: {
              id: true,
              attemptNumber: true,
              lifecycle: true,
              submittedAt: true,
              gradedAt: true
            }
          })
        : [];
      const coreAttemptById = new Map(coreAttempts.map((attempt) => [attempt.id, attempt]));

      return {
        participant,
        attempts: submissions.map((submission) => toGradebookSubmissionRecord(submission, coreAttemptById.get(submission.coreAttemptId ?? "")))
      };
    }
  }
};

async function listCodingHomeworkGradebookSubmissions(input: {
  activityId: string;
  groupId: string;
  includeAttempts: boolean;
  userId: string;
}) {
  return prisma.pluginCodingHomeworkSubmission.findMany({
    where: {
      activityId: input.activityId,
      groupId: input.groupId,
      kind: "final",
      userId: input.userId,
      ...(input.includeAttempts
        ? {}
        : {
            coreAttemptId: { not: null },
            status: { in: ["ready_for_grading", "graded"] }
          })
    },
    orderBy: { createdAt: "desc" },
    include: {
      files: { orderBy: { path: "asc" } },
      functions: {
        include: { file: true },
        orderBy: [{ selectedForQuestion: "desc" }, { functionName: "asc" }]
      },
      questions: { orderBy: { orderIndex: "asc" } },
      reviews: { orderBy: { createdAt: "desc" } }
    }
  });
}

function toGradebookSubmissionRecord(
  submission: Awaited<ReturnType<typeof listCodingHomeworkGradebookSubmissions>>[number],
  coreAttempt?: { attemptNumber: number; lifecycle: string; submittedAt: Date | string | null; gradedAt: Date | string | null }
) {
  return {
    id: submission.id,
    attemptNumber: coreAttempt?.attemptNumber ?? null,
    coreAttemptId: submission.coreAttemptId,
    createdAt: submission.createdAt.toISOString(),
    gradedAt: toIsoString(coreAttempt?.gradedAt ?? null),
    lifecycle: coreAttempt?.lifecycle ?? (submission.coreAttemptId ? "submitted" : "plugin_only"),
    metadata: normalizeObject(submission.metadata),
    status: submission.status,
    submittedAt: toIsoString(coreAttempt?.submittedAt ?? submission.updatedAt),
    files: submission.files.map((file) => ({
      id: file.id,
      path: file.path,
      languageKey: file.languageKey,
      sizeBytes: Number(file.sizeBytes),
      sha256: file.sha256,
      metadata: normalizeObject(file.metadata)
    })),
    functions: submission.functions.map((fn) => ({
      id: fn.id,
      fileId: fn.fileId,
      filePath: fn.file.path,
      functionCode: fn.functionCode,
      functionName: fn.functionName,
      nearestExamples: normalizeArray(fn.nearestExamples),
      divergenceScore: fn.divergenceScore,
      selectedForQuestion: fn.selectedForQuestion
    })),
    questions: submission.questions.map((question) => ({
      id: question.id,
      answerSubmittedAt: toIsoString(question.answerSubmittedAt),
      generationModel: question.generationModel,
      metadata: normalizeObject(question.metadata),
      nearestExamples: normalizeArray(question.nearestExamples),
      orderIndex: question.orderIndex,
      questionText: question.questionText,
      studentAnswer: question.studentAnswer,
      submissionFunctionId: question.submissionFunctionId
    })),
    reviews: submission.reviews.map((review) => ({
      id: review.id,
      createdAt: review.createdAt.toISOString(),
      feedback: review.feedback,
      maxScore: review.maxScore,
      metadata: normalizeObject(review.metadata),
      reviewerUserId: review.reviewerUserId,
      rubric: normalizeObject(review.rubric),
      score: review.score,
      updatedAt: review.updatedAt.toISOString()
    }))
  };
}

function normalizeObject(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function normalizeArray(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function toIsoString(value: Date | string | null) {
  if (!value) {
    return null;
  }
  return typeof value === "string" ? value : value.toISOString();
}
