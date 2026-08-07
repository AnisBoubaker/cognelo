export * from "./attempt-types";
import type { ServerActivityPlugin } from "@cognelo/activity-sdk/server";
import { AppError } from "@cognelo/core";

import { prisma } from "./db-client";
import { buildParsonsGradingResult } from "./grading";
import { parseParsonsConfig } from "./parsons";
import { createInitialParsonsAttemptState, parsonsAttemptStateSchema } from "./attempt-types";
import { parsonsAttemptRoute, parsonsGenerateRoute, parsonsGradebookAttemptsRoute, parsonsStudentSubmissionsRoute } from "./routes";
import { evaluateParsonsAttemptStateForConfig } from "./attempts";

export const parsonsServerPlugin: ServerActivityPlugin = {
  key: "parsons",
  routes: [parsonsAttemptRoute, parsonsGenerateRoute, parsonsGradebookAttemptsRoute, parsonsStudentSubmissionsRoute],
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
        state: { ...state, lastEvaluation: evaluation },
        gradingResult: buildParsonsGradingResult(evaluation)
      };
    }
  }
};

export * from "./attempt-types";
export * from "./attempts";
