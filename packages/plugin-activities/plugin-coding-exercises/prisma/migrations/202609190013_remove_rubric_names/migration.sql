UPDATE "PluginCodingExerciseReferenceSolution"
SET "privateConfig" = jsonb_set("privateConfig", '{aiFeedback}', ("privateConfig"->'aiFeedback') - 'rubricName')
WHERE jsonb_typeof("privateConfig"->'aiFeedback') = 'object'
  AND ("privateConfig"->'aiFeedback') ? 'rubricName';

UPDATE "PluginBankCodingExerciseReferenceSolution"
SET "privateConfig" = jsonb_set("privateConfig", '{aiFeedback}', ("privateConfig"->'aiFeedback') - 'rubricName')
WHERE jsonb_typeof("privateConfig"->'aiFeedback') = 'object'
  AND ("privateConfig"->'aiFeedback') ? 'rubricName';

UPDATE "PluginCodingExerciseExecution"
SET "aiFeedbackConfigSnapshot" = "aiFeedbackConfigSnapshot" - 'rubricName'
WHERE jsonb_typeof("aiFeedbackConfigSnapshot") = 'object'
  AND "aiFeedbackConfigSnapshot" ? 'rubricName';

UPDATE "PluginCodingExerciseAiEvaluation"
SET "rubricSnapshot" = "rubricSnapshot" - 'name',
    "requestPayload" = CASE
      WHEN jsonb_typeof("requestPayload"->'rubric') = 'object'
      THEN jsonb_set("requestPayload", '{rubric}', ("requestPayload"->'rubric') - 'name')
      ELSE "requestPayload"
    END
WHERE "rubricSnapshot" ? 'name'
   OR (jsonb_typeof("requestPayload"->'rubric') = 'object' AND ("requestPayload"->'rubric') ? 'name');
