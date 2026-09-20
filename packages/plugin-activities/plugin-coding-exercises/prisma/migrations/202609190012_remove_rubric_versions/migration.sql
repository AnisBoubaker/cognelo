UPDATE "PluginCodingExerciseReferenceSolution"
SET "privateConfig" = jsonb_set("privateConfig", '{aiFeedback}', ("privateConfig"->'aiFeedback') - 'rubricVersion')
WHERE jsonb_typeof("privateConfig"->'aiFeedback') = 'object'
  AND ("privateConfig"->'aiFeedback') ? 'rubricVersion';

UPDATE "PluginBankCodingExerciseReferenceSolution"
SET "privateConfig" = jsonb_set("privateConfig", '{aiFeedback}', ("privateConfig"->'aiFeedback') - 'rubricVersion')
WHERE jsonb_typeof("privateConfig"->'aiFeedback') = 'object'
  AND ("privateConfig"->'aiFeedback') ? 'rubricVersion';

UPDATE "PluginCodingExerciseExecution"
SET "aiFeedbackConfigSnapshot" = "aiFeedbackConfigSnapshot" - 'rubricVersion'
WHERE jsonb_typeof("aiFeedbackConfigSnapshot") = 'object'
  AND "aiFeedbackConfigSnapshot" ? 'rubricVersion';

UPDATE "PluginCodingExerciseAiEvaluation"
SET "rubricSnapshot" = "rubricSnapshot" - 'version',
    "requestPayload" = CASE
      WHEN jsonb_typeof("requestPayload"->'rubric') = 'object'
      THEN jsonb_set("requestPayload", '{rubric}', ("requestPayload"->'rubric') - 'version')
      ELSE "requestPayload"
    END
WHERE "rubricSnapshot" ? 'version'
   OR jsonb_typeof("requestPayload"->'rubric') = 'object';
