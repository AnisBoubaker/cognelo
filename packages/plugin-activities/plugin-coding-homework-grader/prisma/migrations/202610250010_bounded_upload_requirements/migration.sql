UPDATE "PluginCodingHomeworkSubmissionRequirementSet" SET requirements = jsonb_set(
  jsonb_set(requirements, '{maxArchiveBytes}', to_jsonb(LEAST(COALESCE((requirements->>'maxArchiveBytes')::bigint, 26214400), 26214400))),
  '{maxFileCount}', to_jsonb(LEAST(COALESCE((requirements->>'maxFileCount')::int, 200), 1000))), "updatedAt" = NOW()
WHERE (requirements->>'maxArchiveBytes')::bigint > 26214400 OR (requirements->>'maxFileCount')::int > 1000;

UPDATE "PluginBankCodingHomeworkSubmissionRequirementSet" SET requirements = jsonb_set(
  jsonb_set(requirements, '{maxArchiveBytes}', to_jsonb(LEAST(COALESCE((requirements->>'maxArchiveBytes')::bigint, 26214400), 26214400))),
  '{maxFileCount}', to_jsonb(LEAST(COALESCE((requirements->>'maxFileCount')::int, 200), 1000))), "updatedAt" = NOW()
WHERE (requirements->>'maxArchiveBytes')::bigint > 26214400 OR (requirements->>'maxFileCount')::int > 1000;
