import type { PluginRouteDefinition } from "@cognelo/activity-sdk/server";
import {
  AppError,
  assertCanManageCourse,
  clearActivityResponseDraft,
  recordActivityAttemptGradingResult,
  startActivityAttempt,
  submitActivityAttempt
} from "@cognelo/core";
import {
  listRecentWebDesignExerciseSubmissions,
  listWebDesignExerciseReviewSubmissionAttempts,
  runWebDesignExercise,
  submitWebDesignExercise,
  webDesignExerciseRunInputSchema
} from "./executions";
import {
  getBankWebDesignExpectedResult,
  getWebDesignExpectedResult,
  listBankWebDesignExerciseTests,
  listWebDesignExerciseTests,
  replaceBankWebDesignExerciseTests,
  replaceWebDesignExerciseTests
} from "./tests";
import { prisma, type Prisma } from "@cognelo/db";

export const webDesignExerciseTestsRoute: PluginRouteDefinition = {
  path: "web-design-coding-exercises/tests",
  activityTypeKeys: ["web-design-coding-exercise"],
  methods: {
    GET: async ({ context }) => {
      if (context.activityBankId) {
        return listBankWebDesignExerciseTests({
          bankActivityId: context.activity.id
        });
      }
      if (!context.courseId) {
        throw new AppError(400, "COURSE_CONTEXT_REQUIRED", "This plugin route requires a course or activity bank context.");
      }
      await assertCanManageCourse(context.user, context.courseId);
      return listWebDesignExerciseTests({
        activityId: context.activity.id
      });
    },
    PUT: async ({ context, readJson }) => {
      if (context.activityBankId) {
        return replaceBankWebDesignExerciseTests({
          activityBankId: context.activityBankId,
          bankActivityId: context.activity.id,
          activityConfig: context.activity.config,
          user: context.user,
          input: await readJson()
        });
      }
      if (!context.courseId) {
        throw new AppError(400, "COURSE_CONTEXT_REQUIRED", "This plugin route requires a course or activity bank context.");
      }
      return replaceWebDesignExerciseTests({
        activityId: context.activity.id,
        activityConfig: context.activity.config,
        courseId: context.courseId,
        user: context.user,
        input: await readJson()
      });
    }
  }
};

export const webDesignExerciseExpectedResultRoute: PluginRouteDefinition = {
  path: "web-design-coding-exercises/expected-result",
  activityTypeKeys: ["web-design-coding-exercise"],
  methods: {
    GET: async ({ context }) => {
      if (context.activityBankId) {
        return getBankWebDesignExpectedResult({
          bankActivityId: context.activity.id,
          activityConfig: context.activity.config
        });
      }
      return getWebDesignExpectedResult({
        activityId: context.activity.id,
        activityConfig: context.activity.config
      });
    }
  }
};

export const webDesignExerciseRunRoute: PluginRouteDefinition = {
  path: "web-design-coding-exercises/run",
  activityTypeKeys: ["web-design-coding-exercise"],
  methods: {
    GET: async ({ context }) => {
      const submissions = await listRecentWebDesignExerciseSubmissions({
        activityId: context.activity.id,
        userId: context.user.id,
        kind: "run"
      });

      return { submissions };
    },
    POST: async ({ context, readJson }) => {
      const input = webDesignExerciseRunInputSchema.parse(await readJson());
      const submission = await runWebDesignExercise({
        activityId: context.activity.id,
        userId: context.user.id,
        input
      });

      return { submission };
    }
  }
};

export const webDesignExerciseSubmitRoute: PluginRouteDefinition = {
  path: "web-design-coding-exercises/submit",
  activityTypeKeys: ["web-design-coding-exercise"],
  methods: {
    GET: async ({ context }) => {
      const submissions = await listRecentWebDesignExerciseSubmissions({
        activityId: context.activity.id,
        userId: context.user.id,
        kind: "submit"
      });

      return { submissions };
    },
    POST: async ({ context, readJson }) => {
      const input = webDesignExerciseRunInputSchema.parse(await readJson());
      const submission = await submitWebDesignExercise({
        activityId: context.activity.id,
        userId: context.user.id,
        input
      });
      if (context.courseId && context.groupId) {
        const assessmentMode = context.activity.assignment?.metadata?.assessmentMode === "summative" ? "summative" : "formative";
        const metadata = {
          mode: assessmentMode,
          submissionId: submission.id,
          submittedFiles: input.files
        } as Prisma.InputJsonValue;
        const coreAttempt = await startActivityAttempt(context.user, {
          courseId: context.courseId,
          groupId: context.groupId,
          activityId: context.activity.id,
          pluginKey: "web-design-coding-exercises",
          pluginVersion: "0.1.0",
          pluginAttemptRef: submission.id,
          assessmentMode,
          metadata
        });
        const submittedAttempt = await submitActivityAttempt(context.user, {
          attemptId: coreAttempt.id,
          pluginAttemptRef: submission.id,
          metadata
        });
        if (assessmentMode === "summative") {
          if (submission.score === null || submission.maxScore === null || submission.maxScore <= 0) {
            throw new AppError(409, "WEB_DESIGN_RESULT_INVALID", "The web design exercise did not return a valid score.");
          }
          await recordActivityAttemptGradingResult(context.user, {
            attemptId: submittedAttempt.id,
            rawScore: submission.score,
            rawMaxScore: submission.maxScore,
            source: "auto",
            rawResult: {
              ...submission.resultSummary,
              tests: submission.testResults
            } as Prisma.InputJsonValue,
            normalizedResult: {
              kind: "web-design-coding-exercise",
              submissionId: submission.id
            } as Prisma.InputJsonValue
          });
        }
        await clearActivityResponseDraft(context.user, context.courseId, context.groupId, context.activity.id).catch(() => undefined);
      }

      return { submission };
    }
  }
};

export const webDesignExerciseReviewAllRoute: PluginRouteDefinition = {
  path: "web-design-coding-exercises/review-all",
  activityTypeKeys: ["web-design-coding-exercise"],
  methods: {
    GET: async ({ context }) => {
      if (!context.courseId) throw new AppError(400, "COURSE_CONTEXT_REQUIRED", "This plugin route requires a course context.");
      await assertCanManageCourse(context.user, context.courseId);
      const participants = await prisma.courseGroupParticipant.findMany({
        where: { group: { courseId: context.courseId }, role: "student", userId: { not: null } },
        select: { id: true, userId: true }
      });
      const submissions = await listWebDesignExerciseReviewSubmissionAttempts({ activityId: context.activity.id, userIds: participants.flatMap((participant) => participant.userId ? [participant.userId] : []) });
      const byUserId = new Map<string, typeof submissions>();
      for (const submission of submissions) {
        byUserId.set(submission.userId, [...(byUserId.get(submission.userId) ?? []), submission]);
      }
      return {
        submissions: participants.flatMap((participant) => {
          const attempts = participant.userId ? byUserId.get(participant.userId) ?? [] : [];
          return attempts.length ? [{ participantId: participant.id, submission: attempts[0], attempts }] : [];
        })
      };
    }
  }
};
