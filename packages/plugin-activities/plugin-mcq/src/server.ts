import { AppError } from "@cognelo/core";
import { prisma } from "@cognelo/db";
import type { ServerActivityPlugin } from "@cognelo/activity-sdk/server";
import { buildMcqGradingResultFromConfig } from "./grading";
import { z } from "zod";
import { mcqFormativeFeedbackRoute, mcqGenerateRoute, mcqGradebookAttemptsRoute, mcqSubmissionRoute, submittedAnswersFromMetadata } from "./routes";
import { evaluateMcqWithAi, reviseMcqAiFeedback } from "./ai-feedback";

export const mcqServerPlugin: ServerActivityPlugin = {
  key: "mcq",
  routes: [mcqGenerateRoute, mcqSubmissionRoute, mcqFormativeFeedbackRoute, mcqGradebookAttemptsRoute],
  aiFeedback: {
    evaluateAttempt: async ({ user, courseId, groupId, activityId, coreAttemptId, activity, triggerKind, testItemAttempt }) => {
      const attempt = testItemAttempt ? null : await prisma.activityAttempt.findUnique({ where: { id: coreAttemptId }, select: { metadata: true } });
      if (!attempt && !testItemAttempt) throw new AppError(404, "MCQ_ATTEMPT_NOT_FOUND", "The MCQ attempt was not found.");
      return evaluateMcqWithAi({
        user,
        courseId,
        groupId,
        activityId,
        coreAttemptId,
        activity,
        answers: testItemAttempt ? submittedAnswersFromMetadata({ submittedAnswers: testItemAttempt.state.answers }) : submittedAnswersFromMetadata(attempt?.metadata),
        assessmentMode: "summative",
        triggerKind
      });
    },
    teacherReview: {
      createFeedbackDraft: () => ({
        kind: "assessment_feedback",
        summary: "",
        questionFeedback: []
      }),
      getSubmission: async ({ coreAttemptId, activity }) => {
        const attempt = await prisma.activityAttempt.findUnique({ where: { id: coreAttemptId }, select: { metadata: true, submittedAt: true } });
        if (!attempt) throw new AppError(404, "MCQ_ATTEMPT_NOT_FOUND", "The MCQ attempt was not found.");
        return {
          kind: "mcq",
          answers: submittedAnswersFromMetadata(attempt.metadata),
          source: typeof activity.config?.source === "string" ? activity.config.source : "",
          defaultCodeLanguage: typeof activity.config?.defaultCodeLanguage === "string" ? activity.config.defaultCodeLanguage : "none",
          submittedAt: attempt.submittedAt?.toISOString() ?? null
        };
      },
      reviseFeedback: ({ currentFeedback, feedback }) => reviseMcqAiFeedback(currentFeedback, feedback)
    }
  },
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
  },
  hooks: {
    onCourseActivityDeleted: async ({ activityId, activityTypeKey }) => {
      if (activityTypeKey === "mcq") await prisma.pluginMcqAiEvaluation.deleteMany({ where: { activityId } });
    }
  }
} as const;
