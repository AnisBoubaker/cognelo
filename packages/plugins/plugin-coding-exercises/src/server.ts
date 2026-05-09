import type { ServerActivityPlugin } from "@cognelo/activity-sdk/server";
import {
  codingExerciseGenerateAssetsRoute,
  codingExerciseGeneratePromptRoute,
  codingExerciseHiddenTestsRoute,
  codingExerciseRunRoute,
  codingExerciseSubmitRoute
} from "./routes";
import { copyBankCodingExerciseDataToCourseActivity } from "./hidden-tests";

export const codingExercisesServerPlugin: ServerActivityPlugin = {
  key: "coding-exercises",
  routes: [
    codingExerciseRunRoute,
    codingExerciseSubmitRoute,
    codingExerciseHiddenTestsRoute,
    codingExerciseGeneratePromptRoute,
    codingExerciseGenerateAssetsRoute
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
    }
  }
};
