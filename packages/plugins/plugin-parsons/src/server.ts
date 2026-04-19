export * from "./attempt-types";
import type { ServerActivityPlugin } from "@cognelo/activity-sdk/server";

import { parsonsAttemptRoute } from "./routes";

export const parsonsServerPlugin: ServerActivityPlugin = {
  key: "parsons",
  routes: [parsonsAttemptRoute]
};

export * from "./attempt-types";
export * from "./attempts";
