import type { ServerActivityPlugin } from "@cognelo/activity-sdk/server";
import { webDesignExerciseRunRoute, webDesignExerciseSubmitRoute, webDesignExerciseTestsRoute } from "./routes";

export const webDesignCodingExercisesServerPlugin: ServerActivityPlugin = {
  key: "web-design-coding-exercises",
  routes: [webDesignExerciseTestsRoute, webDesignExerciseRunRoute, webDesignExerciseSubmitRoute]
};
