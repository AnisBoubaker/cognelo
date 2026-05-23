import { AppError } from "@cognelo/core";
import { prisma } from "@cognelo/db";
import type { ServerActivityPlugin } from "@cognelo/activity-sdk/server";
import { buildMcqGradingResultFromConfig } from "./grading";
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
  }
} as const;
