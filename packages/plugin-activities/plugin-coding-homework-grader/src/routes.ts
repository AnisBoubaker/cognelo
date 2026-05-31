import type { PluginRouteDefinition, PluginRouteContext } from "@cognelo/activity-sdk/server";
import { AppError, assertCanManageActivityBank, assertCanManageCourse } from "@cognelo/core";
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
      return saveCodingHomeworkChallengeAnswers(resolveStudentSubmissionScope(context), await readJson(), { finalize: true });
    }
  }
};
