export const codingExercisesDatabaseModule = {
  namespace: "plugin_coding_exercises",
  tables: [
    "PluginCodingExerciseHiddenTest",
    "PluginCodingExerciseReferenceSolution",
    "PluginCodingExerciseExecution",
    "PluginBankCodingExerciseHiddenTest",
    "PluginBankCodingExerciseReferenceSolution"
  ],
  notes: [
    "Only student-visible authoring fields live in the shared activity config.",
    "Hidden tests, teacher-only reference solutions, private execution templates/support code, and execution history live in plugin-owned tables so they never need to be exposed in the browser payload.",
    "Activity-bank coding exercises own parallel private tables; these records are copied into course-owned plugin tables when a bank version is assigned."
  ]
} as const;
