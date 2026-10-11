import { registerServerActivityPlugins } from "@cognelo/activity-sdk/server";
import { codingExercisesServerPlugin } from "@cognelo/plugin-coding-exercises/server";
import { codingHomeworkGraderServerPlugin } from "@cognelo/plugin-coding-homework-grader/server";
import { mcqServerPlugin } from "@cognelo/plugin-mcq/server";
import { parsonsServerPlugin } from "@cognelo/plugin-parsons/server";
import { placeholderServerPlugin } from "@cognelo/plugin-placeholder/server";
import { webDesignCodingExercisesServerPlugin } from "@cognelo/plugin-web-design-coding-exercises/server";
import "./activity";

export const installedServerActivityPlugins = [
  placeholderServerPlugin,
  codingHomeworkGraderServerPlugin,
  parsonsServerPlugin,
  mcqServerPlugin,
  codingExercisesServerPlugin,
  webDesignCodingExercisesServerPlugin
] as const;

registerServerActivityPlugins(installedServerActivityPlugins);
