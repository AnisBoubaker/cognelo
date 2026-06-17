import type { PluginRouteDefinition, PluginRouteContext } from "@cognelo/activity-sdk/server";
import { AppError, assertCanManageActivityBank, assertCanManageCourse } from "@cognelo/core";
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
import {
  generateCodingHomeworkChallengeQuestions,
  generateCodingHomeworkChallengeQuestionsForStudentSubmission,
  toStudentChallengeGenerationResult
} from "./generation";
import { prisma } from "./db-client";
import { runCodingHomeworkPreflight } from "./preflight";
import { searchCodingHomeworkReferenceContent } from "./reference-search";
import { getCodingHomeworkStudentAssignment, getLatestCodingHomeworkSubmission, runCodingHomeworkSubmission } from "./submission";

function requireCourseId(courseId: string | undefined) {
  if (!courseId) {
    throw new AppError(400, "COURSE_CONTEXT_REQUIRED", "This plugin route requires a course context.");
  }
  return courseId;
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
      const analysis = await analyzeCodingHomeworkSubmission(scope, { submissionId: submissionResult.submission.id });
      const challenge = toStudentChallengeGenerationResult(
        await generateCodingHomeworkChallengeQuestionsForStudentSubmission(scope, {
          ...(input && typeof input === "object" && !Array.isArray(input) ? input : {}),
          submissionId: analysis.submission.id
        })
      );
      return {
        ...submissionResult,
        analysis,
        challenge,
        questions: challenge.questions,
        submission: challenge.submission
      };
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
