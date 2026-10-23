import { canShowStudentActivityGrade } from "@cognelo/core";
import { randomUUID } from "node:crypto";
import type { PluginRouteDefinition } from "@cognelo/activity-sdk/server";
import {
  AppError,
  assignmentUsesAutomaticAiFeedback,
  assertCanViewCourseGradebook,
  assertCanManageCourseOrViewGradebook,
  assertCanManageActivityBank,
  assertCanManageCourse,
  clearActivityResponseDraft,
  getCourseAssessmentFeedbackPolicy,
  getActivityAttemptAvailability,
  recordActivityAttemptGradingResult,
  startActivityAttempt,
  submitActivityAttempt
} from "@cognelo/core";
import {
  codingExerciseRunInputSchema,
  codingExerciseSubmitInputSchema,
  listCodingExerciseAttemptHistory,
  listCodingExerciseReviewExecutionAttempts,
  listRecentCodingExerciseExecutions,
  runCodingExercise,
  submitCodingExercise
} from "./executions";
import {
  codingExercisePromptGenerationInputSchema,
  codingExerciseRubricGenerationInputSchema,
  codingExerciseSolutionGenerationInputSchema,
  codingExerciseTestsGenerationInputSchema,
  generateCodingExercisePrompt,
  generateCodingExerciseRubric,
  generateCodingExerciseSolution,
  generateCodingExerciseTests
} from "./generation";
import {
  listBankCodingExerciseHiddenTests,
  listCodingExerciseHiddenTests,
  replaceBankCodingExerciseHiddenTests,
  replaceCodingExerciseHiddenTests
} from "./hidden-tests";
import { prisma, type Prisma } from "@cognelo/db";
import { prisma as codingExercisePrisma } from "./db-client";
import { codingExerciseRubricGuidanceInputSchema, parseCodingExercisePrivateConfig } from "./coding-exercises";
import { evaluateCodingExerciseAttemptWithAi } from "./ai-feedback";

function requireCourseId(courseId: string | undefined) {
  if (!courseId) {
    throw new AppError(400, "COURSE_CONTEXT_REQUIRED", "This plugin route requires a course context.");
  }
  return courseId;
}

function requireActivityBankId(activityBankId: string | undefined) {
  if (!activityBankId) {
    throw new AppError(400, "ACTIVITY_BANK_CONTEXT_REQUIRED", "This plugin route requires an activity bank context.");
  }
  return activityBankId;
}

type SubjectContext = {
  title: string;
  description: string;
  teachingLanguage: "en" | "fr" | "zh" | "ar";
};

function normalizeTeachingLanguage(value: string): SubjectContext["teachingLanguage"] {
  return value === "fr" || value === "zh" || value === "ar" ? value : "en";
}

export const codingExerciseReviewAllRoute: PluginRouteDefinition = {
  path: "coding-exercises/review-all",
  activityTypeKeys: ["coding-exercise"],
  courseAuthorization: { GET: "view_gradebook" },
  methods: {
    GET: async ({ context, request }) => {
      const courseId = requireCourseId(context.courseId);
      const capabilities = await assertCanViewCourseGradebook(context.user, courseId);
      const searchParams = new URL(request.url).searchParams;
      const participantId = searchParams.get("participantId");
      const executionId = searchParams.get("attemptId");
      const participants = await prisma.courseGroupParticipant.findMany({
        where: {
          ...(participantId ? { id: participantId } : {}),
          group: {
            courseId,
            ...(capabilities.gradingGroupIds !== null ? { id: { in: capabilities.gradingGroupIds } } : {})
          },
          role: "student",
          userId: { not: null }
        },
        select: { id: true, userId: true }
      });
      const allExecutions = await listCodingExerciseReviewExecutionAttempts({
        activityId: context.activity.id,
        userIds: participants.flatMap((participant) => participant.userId ? [participant.userId] : []),
        executionId
      });
      const executions = executionId ? allExecutions.filter((execution) => execution.id === executionId) : allExecutions;
      const evaluations = executions.length ? await codingExercisePrisma.pluginCodingExerciseAiEvaluation.findMany({
        where: {
          activityId: context.activity.id,
          executionId: { in: executions.map((execution) => execution.id) },
          status: "completed"
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        select: { executionId: true, criterionScores: true, id: true, version: true, feedbackHash: true, sanitizedFeedback: true }
      }) : [];
      const rubricByExecutionId = new Map<string, Array<{ criterionId: string; scorePercent: number }>>();
      for (const evaluation of evaluations) {
        if (!rubricByExecutionId.has(evaluation.executionId)) {
          rubricByExecutionId.set(evaluation.executionId, reviewRubricScores(evaluation.criterionScores));
        }
      }
      const feedbackByExecutionId = new Map<string, ReturnType<typeof toAttemptAiFeedback>>();
      for (const evaluation of evaluations) {
        if (!feedbackByExecutionId.has(evaluation.executionId)) {
          feedbackByExecutionId.set(evaluation.executionId, toAttemptAiFeedback(evaluation));
        }
      }
      const byUserId = new Map<string, typeof executions>();
      for (const execution of executions) {
        byUserId.set(execution.userId, [...(byUserId.get(execution.userId) ?? []), execution]);
      }
      return {
        submissions: participants.flatMap((participant) => {
          const attempts = participant.userId ? byUserId.get(participant.userId) ?? [] : [];
          return attempts.length ? [{
            participantId: participant.id,
            execution: attempts[0],
            attempts: attempts.map((execution) => ({
              ...execution,
              aiFeedback: feedbackByExecutionId.get(execution.id) ?? null
            })),
            rubricEvaluations: attempts.flatMap((execution) => {
              const criteria = rubricByExecutionId.get(execution.id);
              return criteria?.length ? [{ executionId: execution.id, criteria }] : [];
            })
          }] : [];
        })
      };
    }
  }
};

function reviewRubricScores(value: unknown) {
  if (!Array.isArray(value)) return [];
  const scores = new Map<string, { criterionId: string; scorePercent: number }>();
  for (const item of value) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const candidate = item as Record<string, unknown>;
    const criterionId = typeof candidate.criterionId === "string" ? candidate.criterionId.trim() : "";
    const scorePercent = candidate.scorePercent;
    if (criterionId && typeof scorePercent === "number" && Number.isFinite(scorePercent) && scorePercent >= 0 && scorePercent <= 100 && !scores.has(criterionId)) {
      scores.set(criterionId, { criterionId, scorePercent: Math.round(scorePercent * 100) / 100 });
    }
  }
  return [...scores.values()];
}

async function resolveSubjectContext(activityBankId: string | undefined, courseId: string | undefined): Promise<SubjectContext> {
  if (activityBankId) {
    const bank = await prisma.activityBank.findUnique({
      where: { id: activityBankId },
      include: { subject: true }
    });
    if (!bank) {
      throw new AppError(404, "ACTIVITY_BANK_NOT_FOUND", "Activity bank was not found.");
    }
    return {
      title: bank.subject.title,
      description: bank.subject.description,
      teachingLanguage: normalizeTeachingLanguage(bank.subject.teachingLanguage)
    };
  }

  if (courseId) {
    const course = await prisma.course.findUnique({
      where: { id: courseId },
      include: { subject: true }
    });
    if (!course) {
      throw new AppError(404, "COURSE_NOT_FOUND", "Course was not found.");
    }
    return {
      title: course.subject.title,
      description: course.subject.description,
      teachingLanguage: normalizeTeachingLanguage(course.subject.teachingLanguage)
    };
  }

  throw new AppError(400, "SUBJECT_CONTEXT_REQUIRED", "Subject context is required for coding exercise generation.");
}

async function assertCanManageGenerationContext(context: { user: Parameters<typeof assertCanManageCourse>[0]; activityBankId?: string; courseId?: string }) {
  if (context.activityBankId) {
    await assertCanManageActivityBank(context.user, context.activityBankId);
    return;
  }
  if (context.courseId) {
    await assertCanManageCourse(context.user, context.courseId);
    return;
  }
  throw new AppError(400, "ACTIVITY_CONTEXT_REQUIRED", "Coding exercise generation requires a course or activity bank context.");
}

export const codingExerciseRunRoute: PluginRouteDefinition = {
  path: "coding-exercises/run",
  activityTypeKeys: ["coding-exercise"],
  methods: {
    GET: async ({ context }) => {
      const executions = await listRecentCodingExerciseExecutions({
        activityId: context.activity.id,
        userId: context.user.id
      });

      return { executions: await studentExecutions(context, executions) };
    },
    POST: async ({ context, readJson }) => {
      const input = codingExerciseRunInputSchema.parse(await readJson());
      const execution = await runCodingExercise({
        activityId: context.activity.id,
        userId: context.user.id,
        activityConfig: context.activity.config,
        input
      });

      return { execution };
    }
  }
};

export const codingExerciseSubmitRoute: PluginRouteDefinition = {
  path: "coding-exercises/submit",
  activityTypeKeys: ["coding-exercise"],
  allowExpiredTimedAttemptMethods: ["POST"],
  methods: {
    GET: async ({ context }) => {
      const executions = await listRecentCodingExerciseExecutions({
        activityId: context.activity.id,
        userId: context.user.id
      });

      return { executions: await studentExecutions(context, executions.filter((execution) => execution.kind === "submit")) };
    },
    POST: async ({ context, readJson }) => {
      const input = codingExerciseSubmitInputSchema.parse(await readJson());
      const existingHistory = await listActiveCodingExerciseHistory({
        activityId: context.activity.id,
        userId: context.user.id
      });
      const availability = await getCodingExerciseAttemptAvailability({
        context,
        submissionCount: existingHistory.attempts.length
      });
      if (!availability.canStart) {
        throw new AppError(
          409,
          availability.reason ?? "ATTEMPT_UNAVAILABLE",
          "No coding exercise submission attempt is currently available."
        );
      }
      const execution = await submitCodingExercise({
        activityId: context.activity.id,
        userId: context.user.id,
        activityConfig: context.activity.config,
        input
      });
      const aiFeedbackSetup = await getEffectiveCodingExerciseAiFeedbackSetup(context);
      await codingExercisePrisma.pluginCodingExerciseExecution.update({
        where: { id: execution.id },
        data: { aiFeedbackConfigSnapshot: aiFeedbackSetup.config }
      });
      let aiFeedback: Awaited<ReturnType<typeof evaluateCodingExerciseAttemptWithAi>> | null = null;
      let aiFeedbackError: string | null = null;
      const assessmentMode = isSummativeGroupActivity(context) ? "summative" : "formative";
      let submittedCoreAttemptId: string | null = null;
      if (context.courseId && context.groupId) {
        const metadata = {
          mode: assessmentMode,
          executionId: execution.id,
          submittedSourceCode: input.sourceCode
        } as Prisma.InputJsonValue;
        const coreAttempt = await startActivityAttempt(context.user, {
          courseId: context.courseId,
          groupId: context.groupId,
          activityId: context.activity.id,
          pluginKey: "coding-exercises",
          pluginVersion: "0.1.0",
          pluginAttemptRef: execution.id,
          assessmentMode,
          metadata
        });
        const submittedAttempt = await submitActivityAttempt(context.user, {
          attemptId: coreAttempt.id,
          pluginAttemptRef: execution.id,
          metadata
        });
        submittedCoreAttemptId = submittedAttempt.id;
      }
      if (assessmentMode === "summative" && submittedCoreAttemptId) {
        const earnedWeight = numberValue(execution.resultSummary.earnedWeight);
        const totalWeight = numberValue(execution.resultSummary.totalWeight);
        if (earnedWeight === null || totalWeight === null || totalWeight < 0) {
          throw new AppError(409, "CODING_EXERCISE_RESULT_INVALID", "The coding exercise did not return a valid weighted result.");
        }
        if (totalWeight > 0 && (!aiFeedbackSetup.effective || !aiFeedbackSetup.config.gradingEnabled)) {
          await recordActivityAttemptGradingResult(context.user, {
            attemptId: submittedCoreAttemptId,
            rawScore: earnedWeight,
            rawMaxScore: totalWeight,
            source: "auto",
            isPass: execution.status === "completed",
            rawResult: {
              executionId: execution.id,
              analyticsPayload: execution.resultSummary
            } as Prisma.InputJsonValue,
            normalizedResult: {
              kind: "coding-exercise",
              executionId: execution.id,
              aiFeedbackPending: aiFeedbackSetup.effective
            } as Prisma.InputJsonValue
          });
        }
      } else if (
        assessmentMode === "formative" &&
        context.courseId &&
        context.groupId &&
        assignmentUsesAutomaticAiFeedback(context.activity.assignment?.metadata) &&
        aiFeedbackSetup.effective
      ) {
        try {
          aiFeedback = await evaluateCodingExerciseAttemptWithAi({
            user: context.user,
            courseId: context.courseId,
            groupId: context.groupId,
            activityId: context.activity.id,
            coreAttemptId: submittedCoreAttemptId,
            executionId: execution.id,
            activity: context.activity,
            assessmentMode: "formative",
            triggerKind: "formative_submission"
          });
        } catch (error) {
          aiFeedbackError = error instanceof Error ? error.message : "AI feedback could not be generated.";
        }
      }
      if (context.courseId && context.groupId) {
        await clearActivityResponseDraft(context.user, context.courseId, context.groupId, context.activity.id).catch(() => undefined);
      }

      return {
        execution: (await studentExecutions(context, [execution]))[0],
        aiFeedback,
        aiFeedbackError,
        availability: await getCodingExerciseAttemptAvailability({
          context,
          submissionCount: existingHistory.attempts.length + 1
        })
      };
    }
  }
};

async function getEffectiveCodingExerciseAiFeedbackSetup(context: {
  courseId?: string;
  user: Parameters<typeof getCourseAssessmentFeedbackPolicy>[0];
  activity: { id: string };
}) {
  const reference = await codingExercisePrisma.pluginCodingExerciseReferenceSolution.findUnique({
    where: { activityId: context.activity.id },
    select: { privateConfig: true }
  });
  const config = parseCodingExercisePrivateConfig(reference?.privateConfig).aiFeedback;
  if (!context.courseId || !config.enabled) {
    return { effective: false, config };
  }
  const policy = await getCourseAssessmentFeedbackPolicy(context.user, context.courseId);
  return { effective: policy.enabled, config };
}

export const codingExerciseHistoryRoute: PluginRouteDefinition = {
  path: "coding-exercises/history",
  activityTypeKeys: ["coding-exercise"],
  methods: {
    GET: async ({ context }) => {
      const history = await listActiveCodingExerciseHistory({
        activityId: context.activity.id,
        userId: context.user.id
      });
      const showGrade = await canShowStudentActivityGrade(context);
      const showAiFeedback = assignmentUsesAutomaticAiFeedback(context.activity.assignment?.metadata);
      const feedbackByExecutionId = showAiFeedback
        ? await listLatestFormativeAiFeedbackByExecutionId(
            context.activity.id,
            history.attempts.map((attempt) => attempt.submission.id)
          )
        : new Map<string, ReturnType<typeof toAttemptAiFeedback>>();
      return {
        currentRuns: history.currentRuns,
        attempts: history.attempts.map((attempt) => ({
          ...attempt,
          submission: showGrade ? attempt.submission : hideSubmissionGrade(attempt.submission),
          aiFeedback: feedbackByExecutionId.get(attempt.submission.id) ?? null
        })),
        availability: await getCodingExerciseAttemptAvailability({
          context,
          submissionCount: history.attempts.length
        })
      };
    }
  }
};

async function listActiveCodingExerciseHistory(input: { activityId: string; userId: string }) {
  const [history, deletedAttempts] = await Promise.all([
    listCodingExerciseAttemptHistory(input),
    prisma.activityAttempt.findMany({
      where: { ...input, pluginKey: "coding-exercises", lifecycle: "deleted", pluginAttemptRef: { not: null } },
      select: { pluginAttemptRef: true }
    })
  ]);
  const deletedRefs = new Set(deletedAttempts.map((attempt) => attempt.pluginAttemptRef));
  return { ...history, attempts: history.attempts.filter((attempt) => !deletedRefs.has(attempt.submission.id)) };
}

async function listLatestFormativeAiFeedbackByExecutionId(activityId: string, executionIds: string[]) {
  const byExecutionId = new Map<string, ReturnType<typeof toAttemptAiFeedback>>();
  if (!executionIds.length) return byExecutionId;
  const evaluations = await codingExercisePrisma.pluginCodingExerciseAiEvaluation.findMany({
    where: {
      activityId,
      executionId: { in: executionIds },
      assessmentMode: "formative",
      triggerKind: "formative_submission",
      status: "completed"
    },
    orderBy: [{ version: "desc" }, { createdAt: "desc" }, { id: "desc" }],
    select: { executionId: true, id: true, version: true, feedbackHash: true, sanitizedFeedback: true }
  });
  for (const evaluation of evaluations) {
    if (!byExecutionId.has(evaluation.executionId)) {
      byExecutionId.set(evaluation.executionId, toAttemptAiFeedback(evaluation));
    }
  }
  return byExecutionId;
}

function toAttemptAiFeedback(evaluation: {
  id: string;
  version: number;
  feedbackHash: string | null;
  sanitizedFeedback: unknown;
}) {
  return {
    feedbackRef: evaluation.id,
    feedbackVersion: evaluation.version,
    feedbackHash: evaluation.feedbackHash ?? "",
    feedback: evaluation.sanitizedFeedback && typeof evaluation.sanitizedFeedback === "object" && !Array.isArray(evaluation.sanitizedFeedback)
      ? evaluation.sanitizedFeedback as Record<string, unknown>
      : {}
  };
}

function isSummativeGroupActivity(context: {
  courseId?: string;
  groupId?: string;
  activity: { assignment?: { metadata?: Record<string, unknown> } };
}): context is typeof context & { courseId: string; groupId: string } {
  return Boolean(
    context.courseId &&
      context.groupId &&
      context.activity.assignment?.metadata?.assessmentMode === "summative"
  );
}

async function getCodingExerciseAttemptAvailability(params: {
  context: {
    courseId?: string;
    groupId?: string;
    activity: { id: string; assignment?: { metadata?: Record<string, unknown> } };
    user: Parameters<typeof getActivityAttemptAvailability>[0];
  };
  submissionCount: number;
}) {
  if (!isSummativeGroupActivity(params.context)) {
    return {
      attemptLimitMode: "unlimited",
      gradesReleased: false,
      maxAttempts: null,
      usedAttempts: null,
      attemptsRemaining: null,
      canStart: true,
      reason: null
    };
  }

  const availability = await getActivityAttemptAvailability(params.context.user, {
    courseId: params.context.courseId,
    groupId: params.context.groupId,
    activityId: params.context.activity.id
  });
  return availability;
}

function numberValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export const codingExerciseHiddenTestsRoute: PluginRouteDefinition = {
  path: "coding-exercises/hidden-tests",
  activityTypeKeys: ["coding-exercise"],
  courseAuthorization: { GET: "view_gradebook" },
  methods: {
    GET: async ({ context }) => {
      if (context.activityBankId) {
        await assertCanManageActivityBank(context.user, context.activityBankId);
        return listBankCodingExerciseHiddenTests({
          bankActivityId: context.activity.id
        });
      }

      const courseId = requireCourseId(context.courseId);
      await assertCanManageCourseOrViewGradebook(context.user, courseId);
      const result = await listCodingExerciseHiddenTests({
        activityId: context.activity.id
      });

      return result;
    },
    PUT: async ({ context, readJson }) => {
      if (context.activityBankId) {
        return replaceBankCodingExerciseHiddenTests({
          activityBankId: requireActivityBankId(context.activityBankId),
          bankActivityId: context.activity.id,
          activityConfig: context.activity.config,
          user: context.user,
          input: await readJson()
        });
      }

      const courseId = requireCourseId(context.courseId);
      const result = await replaceCodingExerciseHiddenTests({
        activityId: context.activity.id,
        courseId,
        activityConfig: context.activity.config,
        user: context.user,
        input: await readJson()
      });

      return result;
    }
  }
};

export const codingExerciseGeneratePromptRoute: PluginRouteDefinition = {
  path: "coding-exercises/generate-prompt",
  activityTypeKeys: ["coding-exercise"],
  methods: {
    POST: async ({ context, readJson }) => {
      const input = codingExercisePromptGenerationInputSchema.parse(await readJson());
      await assertCanManageGenerationContext(context);
      const subject = await resolveSubjectContext(context.activityBankId, context.courseId);

      return generateCodingExercisePrompt({
        user: context.user,
        description: input.description,
        language: input.language,
        locale: input.locale,
        subject,
        knowledge: input.knowledge
      });
    }
  }
};

export const codingExerciseGenerateSolutionRoute: PluginRouteDefinition = {
  path: "coding-exercises/generate-solution",
  activityTypeKeys: ["coding-exercise"],
  methods: {
    POST: async ({ context, readJson }) => {
      const input = codingExerciseSolutionGenerationInputSchema.parse(await readJson());
      await assertCanManageGenerationContext(context);
      const subject = await resolveSubjectContext(context.activityBankId, context.courseId);

      return generateCodingExerciseSolution({
        user: context.user,
        description: input.description,
        prompt: input.prompt,
        language: input.language,
        locale: input.locale,
        subject,
        knowledge: input.knowledge
      });
    }
  }
};

export const codingExerciseGenerateTestsRoute: PluginRouteDefinition = {
  path: "coding-exercises/generate-tests",
  activityTypeKeys: ["coding-exercise"],
  methods: {
    POST: async ({ context, readJson }) => {
      const input = codingExerciseTestsGenerationInputSchema.parse(await readJson());
      await assertCanManageGenerationContext(context);
      const subject = await resolveSubjectContext(context.activityBankId, context.courseId);

      return generateCodingExerciseTests({
        user: context.user,
        description: input.description,
        prompt: input.prompt,
        language: input.language,
        locale: input.locale,
        subject,
        referenceSolution: input.referenceSolution,
        templateSource: input.templateSource,
        templateVisibleLineNumbers: input.templateVisibleLineNumbers,
        visibleTestCount: input.visibleTestCount,
        hiddenTestCount: input.hiddenTestCount,
        existingTests: input.existingTests,
        knowledge: input.knowledge
      });
    }
  }
};

export const codingExerciseRubricGuidanceRoute: PluginRouteDefinition = {
  path: "coding-exercises/rubric-guidance",
  activityTypeKeys: ["coding-exercise"],
  methods: {
    PUT: async ({ context, readJson }) => {
      await assertCanManageGenerationContext(context);
      const { guidance } = codingExerciseRubricGuidanceInputSchema.parse(await readJson());
      const preference = JSON.stringify({ rubricGenerationGuidance: guidance });
      // Merge just this authoring preference; never save a draft solution, tests,
      // rubric, or grading instructions as a side effect of generation.
      if (context.activityBankId) {
        await codingExercisePrisma.$executeRaw`INSERT INTO "PluginBankCodingExerciseReferenceSolution"
          ("id", "bankActivityId", "sourceCode", "privateConfig", "validationSummary", "createdAt", "updatedAt")
          VALUES (${randomUUID()}, ${context.activity.id}, '', ${preference}::jsonb, '{}'::jsonb, NOW(), NOW())
          ON CONFLICT ("bankActivityId") DO UPDATE SET
            "privateConfig" = "PluginBankCodingExerciseReferenceSolution"."privateConfig" || EXCLUDED."privateConfig",
            "updatedAt" = NOW()`;
      } else {
        await codingExercisePrisma.$executeRaw`INSERT INTO "PluginCodingExerciseReferenceSolution"
          ("id", "activityId", "sourceCode", "privateConfig", "validationSummary", "createdAt", "updatedAt")
          VALUES (${randomUUID()}, ${context.activity.id}, '', ${preference}::jsonb, '{}'::jsonb, NOW(), NOW())
          ON CONFLICT ("activityId") DO UPDATE SET
            "privateConfig" = "PluginCodingExerciseReferenceSolution"."privateConfig" || EXCLUDED."privateConfig",
            "updatedAt" = NOW()`;
      }
      return { guidance };
    }
  }
};

export const codingExerciseGenerateRubricRoute: PluginRouteDefinition = {
  path: "coding-exercises/generate-rubric",
  activityTypeKeys: ["coding-exercise"],
  methods: {
    POST: async ({ context, readJson }) => {
      const input = codingExerciseRubricGenerationInputSchema.parse(await readJson());
      await assertCanManageGenerationContext(context);
      const subject = await resolveSubjectContext(context.activityBankId, context.courseId);

      return generateCodingExerciseRubric({
        guidance: input.guidance,
        user: context.user,
        title: input.title,
        description: input.description,
        prompt: input.prompt,
        referenceSolution: input.referenceSolution,
        language: input.language,
        locale: subject.teachingLanguage,
        subject,
        knowledge: input.knowledge
      });
    }
  }
};

async function studentExecutions(context: Parameters<typeof canShowStudentActivityGrade>[0], executions: Awaited<ReturnType<typeof listRecentCodingExerciseExecutions>>) {
  const visible = await canShowStudentActivityGrade(context);
  return executions.map((execution) => execution.kind === "submit" && !visible ? hideSubmissionGrade(execution) : execution);
}
function hideSubmissionGrade<T extends { status: string; resultSummary: unknown }>(execution: T): T {
  return { ...execution, status: "completed", resultSummary: { gradingWithheld: true },
    judge0Token: null, stdout: null, stderr: null, compileOutput: null, message: null,
    judge0StatusId: null, judge0StatusLabel: null, timeSeconds: null, memoryKb: null };
}
