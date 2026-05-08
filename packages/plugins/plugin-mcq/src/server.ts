import { mcqGenerateRoute } from "./routes";

export const mcqServerPlugin = {
  key: "mcq",
  routes: [mcqGenerateRoute]
} as const;
