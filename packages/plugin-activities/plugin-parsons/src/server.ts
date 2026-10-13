export * from "./attempt-types";
import type { ServerActivityPlugin } from "@cognelo/activity-sdk/server";
import { AppError } from "@cognelo/core";

import { prisma } from "./db-client";
import { buildParsonsGradingResult } from "./grading";
import { parseParsonsConfig } from "./parsons";
import { createInitialParsonsAttemptState, parsonsAttemptStateSchema } from "./attempt-types";
import { parsonsAttemptRoute, parsonsGenerateRoute, parsonsGradebookAttemptsRoute, parsonsStudentSubmissionsRoute } from "./routes";
import { evaluateParsonsAttemptStateForConfig } from "./attempts";
import { createParsonsBankActivityVariation } from "./variation";

export const parsonsServerPlugin: ServerActivityPlugin = {
  key: "parsons",
  attemptContinuation: {
    activityTypeKeys: ["parsons-problem"],
    reopen: async ({ activityId, userId, pluginAttemptRef, metadata, transaction }) => {
      if (!pluginAttemptRef && metadata.timedOut) return {};
      const [attempt] = await transaction.query<Array<{ latestState: Record<string, unknown>; resultSummary: unknown }>>`
        SELECT "latestState", "resultSummary" FROM "PluginParsonsAttempt"
        WHERE id = ${pluginAttemptRef} AND "activityId" = ${activityId} AND "userId" = ${userId}`;
      if (!attempt) throw new AppError(409, "SUBMISSION_STATE_MISSING", "The submitted arrangement is unavailable.");
      await transaction.execute`UPDATE "PluginParsonsAttempt" SET status = 'abandoned', "completedAt" = NOW(), "updatedAt" = NOW()
        WHERE "activityId" = ${activityId} AND "userId" = ${userId} AND status = 'in_progress' AND id <> ${pluginAttemptRef}`;
      const state = { ...(metadata.submittedState as Record<string, unknown> ?? attempt.latestState), lastEvaluation: null };
      await transaction.execute`UPDATE "PluginParsonsAttempt" SET status = 'in_progress', "completedAt" = NULL,
        "latestState" = ${JSON.stringify(state)}::jsonb, "resultSummary" = '{}'::jsonb, "updatedAt" = NOW()
        WHERE id = ${pluginAttemptRef}`;
      return { audit: attempt };
    }
  },
  routes: [parsonsAttemptRoute, parsonsGenerateRoute, parsonsGradebookAttemptsRoute, parsonsStudentSubmissionsRoute],
  bankVariation: {
    activityTypeKeys: ["parsons-problem"],
    createVariation: createParsonsBankActivityVariation
  },
  hooks: {
    onCourseActivityDeleted: async ({ activityTypeKey, activityId }) => {
      if (activityTypeKey === "parsons-problem") {
        await prisma.pluginParsonsAttempt.deleteMany({ where: { activityId } });
      }
    }
  },
  grading: {
    gradeAttempt: async ({ activityId, pluginAttemptRef, activity }) => {
      if (!pluginAttemptRef) {
        throw new AppError(400, "PARSONS_ATTEMPT_REF_REQUIRED", "Parsons grading requires a plugin attempt reference.");
      }

      const attempt = await prisma.pluginParsonsAttempt.findFirst({
        where: {
          id: pluginAttemptRef,
          activityId
        }
      });
      if (!attempt) {
        throw new AppError(404, "PARSONS_ATTEMPT_NOT_FOUND", "The Parsons attempt was not found.");
      }

      try {
        const evaluation = evaluateParsonsAttemptStateForConfig(attempt.latestState, parseParsonsConfig(activity.config));
        return buildParsonsGradingResult(evaluation);
      } catch {
        throw new AppError(409, "PARSONS_ATTEMPT_NOT_GRADABLE", "The Parsons attempt does not contain a grading result.");
      }
    }
  },
  compositeExecution: {
    activityTypeKeys: ["parsons-problem"],
    submit: async ({ activity, payload }) => {
      const config = parseParsonsConfig(activity.config);
      const parsedState = parsonsAttemptStateSchema.safeParse(payload);
      const state = parsedState.success ? parsedState.data : createInitialParsonsAttemptState(config);
      const evaluation = evaluateParsonsAttemptStateForConfig(state, config);
      return {
        state: { ...state, lastEvaluation: null },
        gradingResult: buildParsonsGradingResult(evaluation)
      };
    }
  },
  studentPreview: {
    activityTypeKeys: ["parsons-problem"],
    actions: {
      evaluate: async ({ activity, payload }) => {
        const config = parseParsonsConfig(activity.config);
        const parsedState = parsonsAttemptStateSchema.safeParse(payload);
        const state = parsedState.success ? parsedState.data : createInitialParsonsAttemptState(config);
        const evaluation = evaluateParsonsAttemptStateForConfig(state, config);
        return { state: { ...state, lastEvaluation: evaluation }, evaluation };
      },
      submit: async ({ activity, payload }) => {
        const config = parseParsonsConfig(activity.config);
        const parsedState = parsonsAttemptStateSchema.safeParse(payload);
        const state = parsedState.success ? parsedState.data : createInitialParsonsAttemptState(config);
        const evaluation = evaluateParsonsAttemptStateForConfig(state, config);
        return { state: { ...state, lastEvaluation: evaluation }, evaluation, gradingResult: buildParsonsGradingResult(evaluation) };
      }
    }
  }
};

export * from "./attempt-types";
export * from "./attempts";
