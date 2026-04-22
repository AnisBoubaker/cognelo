export const codingExercisesDatabaseModule = {
  namespace: "plugin_coding_exercises",
  tables: ["PluginCodingExerciseHiddenTest", "PluginCodingExerciseReferenceSolution", "PluginCodingExerciseExecution"],
  notes: [
    "Only student-visible authoring fields live in the shared activity config.",
    "Hidden tests, teacher-only reference solutions, and execution history live in plugin-owned tables so they never need to be exposed in the browser payload."
  ]
} as const;
