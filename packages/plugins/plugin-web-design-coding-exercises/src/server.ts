import type { ServerActivityPlugin } from "@cognelo/activity-sdk/server";
import { webDesignExerciseExpectedResultRoute, webDesignExerciseRunRoute, webDesignExerciseSubmitRoute, webDesignExerciseTestsRoute } from "./routes";
import { copyBankWebDesignExerciseTestsToCourseActivity } from "./tests";

export const webDesignCodingExercisesServerPlugin: ServerActivityPlugin = {
  key: "web-design-coding-exercises",
  routes: [webDesignExerciseTestsRoute, webDesignExerciseExpectedResultRoute, webDesignExerciseRunRoute, webDesignExerciseSubmitRoute],
  hooks: {
    onCourseActivityCreatedFromBankVersion: async ({ activity, bankActivityId }) => {
      if (activity.activityType.key !== "web-design-coding-exercise") {
        return;
      }

      await copyBankWebDesignExerciseTestsToCourseActivity({
        bankActivityId,
        activityId: activity.id
      });
    }
  }
};
