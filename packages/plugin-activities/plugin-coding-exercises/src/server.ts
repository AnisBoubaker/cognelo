import type { ServerActivityPlugin } from "@cognelo/activity-sdk/server";
import {
  codingExerciseGeneratePromptRoute,
  codingExerciseGenerateSolutionRoute,
  codingExerciseGenerateTestsRoute,
  codingExerciseHiddenTestsRoute,
  codingExerciseRunRoute,
  codingExerciseReviewAllRoute,
  codingExerciseSubmitRoute
} from "./routes";
import { copyBankCodingExerciseData, copyBankCodingExerciseDataToCourseActivity, copyCourseCodingExerciseData, deleteBankCodingExerciseData, deleteCourseCodingExerciseData } from "./hidden-tests";
import {
  codingExerciseRunInputSchema,
  codingExerciseSubmitInputSchema,
  runCodingExercise,
  submitCodingExercise
} from "./executions";
import { AppError } from "@cognelo/core";

export const codingExercisesServerPlugin: ServerActivityPlugin = {
  key: "coding-exercises",
  routes: [
    codingExerciseRunRoute,
    codingExerciseReviewAllRoute,
    codingExerciseSubmitRoute,
    codingExerciseHiddenTestsRoute,
    codingExerciseGeneratePromptRoute,
    codingExerciseGenerateSolutionRoute,
    codingExerciseGenerateTestsRoute
  ],
  compositeExecution: {
    activityTypeKeys: ["coding-exercise"],
    actions: {
      run: async ({ activity, payload, user }) => ({
        execution: await runCodingExercise({
          activityId: activity.id,
          userId: user.id,
          activityConfig: activity.config,
          input: codingExerciseRunInputSchema.parse(payload)
        })
      })
    },
    submit: async ({ activity, payload, user }) => {
      const input = codingExerciseSubmitInputSchema.parse(payload);
      const execution = await submitCodingExercise({
        activityId: activity.id,
        userId: user.id,
        activityConfig: activity.config,
        input
      });
      const earnedWeight = numberValue(execution.resultSummary.earnedWeight);
      const totalWeight = numberValue(execution.resultSummary.totalWeight);
      if (earnedWeight === null || totalWeight === null || totalWeight <= 0) {
        throw new AppError(409, "CODING_EXERCISE_RESULT_INVALID", "The coding exercise did not return a valid weighted result.");
      }
      return {
        state: { sourceCode: input.sourceCode, executionId: execution.id },
        gradingResult: {
          rawScore: earnedWeight,
          rawMaxScore: totalWeight,
          analyticsPayload: execution.resultSummary,
          metadata: { kind: "coding-exercise", executionId: execution.id }
        }
      };
    }
  },
  hooks: {
    onCourseActivityDuplicated: async ({ sourceActivityId, activity }) => {
      if (activity.activityType.key === "coding-exercise") {
        await copyCourseCodingExerciseData({ sourceActivityId, activityId: activity.id });
      }
    },
    onCourseActivityCreatedFromBankVersion: async ({ activity, bankActivityId }) => {
      if (activity.activityType.key !== "coding-exercise") {
        return;
      }

      await copyBankCodingExerciseDataToCourseActivity({
        bankActivityId,
        activityId: activity.id
      });
    },
    onBankActivityDeleted: async ({ activityTypeKey, bankActivityId }) => {
      if (activityTypeKey !== "coding-exercise") {
        return;
      }

      await deleteBankCodingExerciseData({ bankActivityId });
    },
    onBankActivityDuplicated: async ({ activityTypeKey, sourceBankActivityId, bankActivityId }) => {
      if (activityTypeKey === "coding-exercise") {
        await copyBankCodingExerciseData({ sourceBankActivityId, bankActivityId });
      }
    },
    onCourseActivityDeleted: async ({ activityTypeKey, activityId }) => {
      if (activityTypeKey === "coding-exercise") {
        await deleteCourseCodingExerciseData({ activityId });
      }
    }
  }
};

function numberValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
