export * from "./attempt-types";
import type { ServerActivityPlugin } from "@cognelo/activity-sdk/server";
import { AppError } from "@cognelo/core";

import { prisma } from "./db-client";
import { buildParsonsGradingResult } from "./grading";
import { parsonsAttemptRoute, parsonsGenerateRoute } from "./routes";
import { parsonsAttemptEvaluationSchema } from "./attempt-types";

export const parsonsServerPlugin: ServerActivityPlugin = {
  key: "parsons",
  routes: [parsonsAttemptRoute, parsonsGenerateRoute],
  grading: {
    gradeAttempt: async ({ activityId, pluginAttemptRef }) => {
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

      const summary = normalizeRecord(attempt.resultSummary);
      const parsed = parsonsAttemptEvaluationSchema.safeParse(summary.latestResult);
      if (!parsed.success) {
        throw new AppError(409, "PARSONS_ATTEMPT_NOT_GRADABLE", "The Parsons attempt does not contain a grading result.");
      }

      return buildParsonsGradingResult(parsed.data);
    }
  }
};

export * from "./attempt-types";
export * from "./attempts";

function normalizeRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}
