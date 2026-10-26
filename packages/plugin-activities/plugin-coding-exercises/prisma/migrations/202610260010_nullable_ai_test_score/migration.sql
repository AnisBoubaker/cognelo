-- Rubric-only grading has no deterministic test score; retain that absence.
ALTER TABLE "PluginCodingExerciseAiEvaluation"
  ALTER COLUMN "deterministicScore" DROP NOT NULL;
