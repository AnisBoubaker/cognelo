import { registerActivityPlugins } from "@cognelo/activity-sdk";
import { codingExercisesPlugin } from "@cognelo/plugin-coding-exercises";
import { codingHomeworkGraderPlugin } from "@cognelo/plugin-coding-homework-grader";
import { mcqPlugin } from "@cognelo/plugin-mcq";
import { parsonsPlugin } from "@cognelo/plugin-parsons";
import { placeholderPlugin } from "@cognelo/plugin-placeholder";
import { webDesignCodingExercisesPlugin } from "@cognelo/plugin-web-design-coding-exercises";

export const installedActivityPlugins = [
  placeholderPlugin,
  codingHomeworkGraderPlugin,
  parsonsPlugin,
  mcqPlugin,
  codingExercisesPlugin,
  webDesignCodingExercisesPlugin
] as const;

registerActivityPlugins(installedActivityPlugins);
