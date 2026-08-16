import type { ServerActivityPlugin } from "@cognelo/activity-sdk/server";
import { webDesignExerciseExpectedResultRoute, webDesignExerciseReviewAllRoute, webDesignExerciseRunRoute, webDesignExerciseSubmitRoute, webDesignExerciseTestsRoute } from "./routes";
import { copyBankWebDesignExerciseData, copyBankWebDesignExerciseTestsToCourseActivity, copyCourseWebDesignExerciseData, copyCourseWebDesignExerciseDataToBankActivity, deleteBankWebDesignExerciseData, deleteCourseWebDesignExerciseData } from "./tests";
import { submitWebDesignExercise, runWebDesignExercise, webDesignExerciseRunInputSchema } from "./executions";
import { AppError } from "@cognelo/core";

export const webDesignCodingExercisesServerPlugin: ServerActivityPlugin = {
  key: "web-design-coding-exercises",
  routes: [webDesignExerciseTestsRoute, webDesignExerciseExpectedResultRoute, webDesignExerciseRunRoute, webDesignExerciseSubmitRoute, webDesignExerciseReviewAllRoute],
  compositeExecution: {
    activityTypeKeys: ["web-design-coding-exercise"],
    actions: {
      run: async ({ activity, payload, user }) => ({
        submission: await runWebDesignExercise({
          activityId: activity.id,
          userId: user.id,
          input: webDesignExerciseRunInputSchema.parse(payload)
        })
      })
    },
    submit: async ({ activity, payload, user }) => {
      const input = webDesignExerciseRunInputSchema.parse(payload);
      const submission = await submitWebDesignExercise({ activityId: activity.id, userId: user.id, input });
      if (submission.score === null || submission.maxScore === null || submission.maxScore <= 0) {
        throw new AppError(409, "WEB_DESIGN_RESULT_INVALID", "The web design exercise did not return a valid score.");
      }
      return {
        state: { files: input.files, submissionId: submission.id },
        gradingResult: {
          rawScore: submission.score,
          rawMaxScore: submission.maxScore,
          analyticsPayload: { ...submission.resultSummary, tests: submission.testResults },
          metadata: { kind: "web-design-coding-exercise", submissionId: submission.id }
        }
      };
    }
  },
  hooks: {
    onCourseActivityPublishedToBank: async ({ activity, bankActivityId }) => {
      if (activity.activityType.key === "web-design-coding-exercise") await copyCourseWebDesignExerciseDataToBankActivity({ activityId: activity.id, bankActivityId });
    },
    onCourseActivityDuplicated: async ({ sourceActivityId, activity }) => {
      if (activity.activityType.key === "web-design-coding-exercise") {
        await copyCourseWebDesignExerciseData({ sourceActivityId, activityId: activity.id });
      }
    },
    onCourseActivityCreatedFromBankVersion: async ({ activity, bankActivityId }) => {
      if (activity.activityType.key !== "web-design-coding-exercise") {
        return;
      }

      await copyBankWebDesignExerciseTestsToCourseActivity({
        bankActivityId,
        activityId: activity.id
      });
    },
    onBankActivityDeleted: async ({ activityTypeKey, bankActivityId }) => {
      if (activityTypeKey !== "web-design-coding-exercise") {
        return;
      }

      await deleteBankWebDesignExerciseData({ bankActivityId });
    },
    onBankActivityDuplicated: async ({ activityTypeKey, sourceBankActivityId, bankActivityId }) => {
      if (activityTypeKey === "web-design-coding-exercise") {
        await copyBankWebDesignExerciseData({ sourceBankActivityId, bankActivityId });
      }
    },
    onCourseActivityDeleted: async ({ activityTypeKey, activityId }) => {
      if (activityTypeKey === "web-design-coding-exercise") {
        await deleteCourseWebDesignExerciseData({ activityId });
      }
    }
  }
};
