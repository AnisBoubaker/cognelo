import type { ServerActivityPlugin } from "@cognelo/activity-sdk/server";
import {
  codingExerciseGeneratePromptRoute,
  codingExerciseGenerateSolutionRoute,
  codingExerciseGenerateTestsRoute,
  codingExerciseHiddenTestsRoute,
  codingExerciseRunRoute,
  codingExerciseSubmitRoute
} from "./routes";
import { copyBankCodingExerciseDataToCourseActivity, deleteBankCodingExerciseData, deleteCourseCodingExerciseData } from "./hidden-tests";

export const codingExercisesServerPlugin: ServerActivityPlugin = {
  key: "coding-exercises",
  routes: [
    codingExerciseRunRoute,
    codingExerciseSubmitRoute,
    codingExerciseHiddenTestsRoute,
    codingExerciseGeneratePromptRoute,
    codingExerciseGenerateSolutionRoute,
    codingExerciseGenerateTestsRoute
  ],
  hooks: {
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
    onCourseActivityDeleted: async ({ activityTypeKey, activityId }) => {
      if (activityTypeKey === "coding-exercise") {
        await deleteCourseCodingExerciseData({ activityId });
      }
    }
  }
};
