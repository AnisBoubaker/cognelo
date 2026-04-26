import type { ServerActivityPlugin } from "@cognelo/activity-sdk/server";
import { webDesignExerciseExpectedResultRoute, webDesignExerciseRunRoute, webDesignExerciseSubmitRoute, webDesignExerciseTestsRoute } from "./routes";

export const webDesignCodingExercisesServerPlugin: ServerActivityPlugin = {
  key: "web-design-coding-exercises",
  routes: [webDesignExerciseTestsRoute, webDesignExerciseExpectedResultRoute, webDesignExerciseRunRoute, webDesignExerciseSubmitRoute]
};
