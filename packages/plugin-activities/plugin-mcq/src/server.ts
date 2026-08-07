import { AppError } from "@cognelo/core";
import { prisma } from "@cognelo/db";
import type { ServerActivityPlugin } from "@cognelo/activity-sdk/server";
import { buildMcqGradingResultFromConfig } from "./grading";
import { z } from "zod";
import { mcqGenerateRoute, mcqGradebookAttemptsRoute, mcqSubmissionRoute, submittedAnswersFromMetadata } from "./routes";

export const mcqServerPlugin: ServerActivityPlugin = {
  key: "mcq",
  routes: [mcqGenerateRoute, mcqSubmissionRoute, mcqGradebookAttemptsRoute],
  grading: {
    gradeAttempt: async ({ activity, coreAttemptId }) => {
      const attempt = await prisma.activityAttempt.findUnique({
        where: { id: coreAttemptId },
        select: { metadata: true }
      });
      if (!attempt) {
        throw new AppError(404, "MCQ_ATTEMPT_NOT_FOUND", "The MCQ attempt was not found.");
      }
      const answers = submittedAnswersFromMetadata(attempt.metadata);
      return buildMcqGradingResultFromConfig(activity.config, answers);
    }
  },
  compositeExecution: {
    activityTypeKeys: ["mcq"],
    submit: async ({ activity, payload }) => {
      const input = z.object({
        answers: z.record(z.array(z.string().min(1).max(120)).default([])).default({})
      }).parse(payload);
      return {
        state: { answers: input.answers },
        gradingResult: buildMcqGradingResultFromConfig(activity.config, input.answers)
      };
    }
  }
} as const;
