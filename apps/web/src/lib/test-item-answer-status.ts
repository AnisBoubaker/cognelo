import { hasCodingExerciseAnswer } from "@cognelo/plugin-coding-exercises";
import { hasMcqAnswer } from "@cognelo/plugin-mcq";
import { hasParsonsAnswer } from "@cognelo/plugin-parsons";
import { hasWebDesignExerciseAnswer } from "@cognelo/plugin-web-design-coding-exercises";
import type { CourseTestRuntimeItem } from "./api";

// Composition belongs beside the renderer registry. The Test shell never parses
// plugin state or evaluates a student's response against a correct answer.
const answerChecks: Record<string, (config: Record<string, unknown>, state: Record<string, unknown> | null) => boolean> = {
  mcq: hasMcqAnswer,
  "parsons-problem": hasParsonsAnswer,
  "coding-exercise": hasCodingExerciseAnswer,
  "web-design-coding-exercise": hasWebDesignExerciseAnswer
};

export function isTestItemAnswered(item: CourseTestRuntimeItem, state: Record<string, unknown> | null) {
  return answerChecks[item.activity.activityType.key]?.(item.activity.config ?? {}, state) ?? false;
}
