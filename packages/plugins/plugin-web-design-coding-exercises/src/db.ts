export const webDesignCodingExercisesDatabaseModule = {
  namespace: "plugin_web_design_coding_exercises",
  tables: [
    "PluginWebDesignExerciseReferenceBundle",
    "PluginWebDesignExerciseTest",
    "PluginWebDesignExerciseSubmission",
    "PluginWebDesignExerciseTestResult"
  ],
  notes: [
    "Student-visible starter files live in shared activity config.",
    "Private teacher solution/reference file bundles, Playwright tests, student submissions, and per-test results live in plugin-owned tables so hidden grading internals are never exposed in the student browser payload."
  ]
} as const;
