ALTER TABLE "PluginCodingExerciseReferenceSolution"
ADD COLUMN "privateConfig" JSONB NOT NULL DEFAULT '{}'::jsonb;
