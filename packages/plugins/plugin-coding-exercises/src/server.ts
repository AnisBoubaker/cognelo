import type { ServerActivityPlugin } from "@cognelo/activity-sdk/server";
import { codingExerciseHiddenTestsRoute, codingExerciseRunRoute, codingExerciseSubmitRoute } from "./routes";

export const codingExercisesServerPlugin: ServerActivityPlugin = {
  key: "coding-exercises",
  routes: [codingExerciseRunRoute, codingExerciseSubmitRoute, codingExerciseHiddenTestsRoute]
};
