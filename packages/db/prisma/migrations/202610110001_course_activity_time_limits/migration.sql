-- Snapshot each existing course Test's authored time limit into the independent
-- course-assignment policy. Later Test edits must not change that copied value.
UPDATE "Activity" AS activity
SET "metadata" = jsonb_set(
  COALESCE(activity."metadata", '{}'::jsonb),
  '{allGroupsAssignment}',
  COALESCE(activity."metadata" -> 'allGroupsAssignment', '{}'::jsonb)
    || jsonb_build_object(
      'timeLimitMinutes',
      CASE
        WHEN jsonb_typeof(test."settings" -> 'timeLimitMinutes') = 'number'
          THEN test."settings" -> 'timeLimitMinutes'
        ELSE 'null'::jsonb
      END
    ),
  true
)
FROM "Test" AS test
WHERE test."activityId" = activity."id"
  AND NOT (COALESCE(activity."metadata" -> 'allGroupsAssignment', '{}'::jsonb) ? 'timeLimitMinutes');
