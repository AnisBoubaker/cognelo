export * from "./attempt-types";
import type { ServerActivityPlugin } from "@cognelo/activity-sdk/server";

import { parsonsAttemptRoute, parsonsGenerateRoute } from "./routes";

export const parsonsServerPlugin: ServerActivityPlugin = {
  key: "parsons",
  routes: [parsonsAttemptRoute, parsonsGenerateRoute]
};

export * from "./attempt-types";
export * from "./attempts";
