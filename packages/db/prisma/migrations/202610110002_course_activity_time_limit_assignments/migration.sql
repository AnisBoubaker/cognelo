-- Materialized group assignments are the runtime source of truth. Copy the
-- newly snapshotted Test default into existing assignments that predate the
-- course-activity timing policy. Never overwrite an explicit assignment value.
UPDATE "CourseGroupActivity" AS assignment
SET "metadata" = COALESCE(assignment."metadata", '{}'::jsonb)
  || jsonb_build_object(
    'timeLimitMinutes',
    activity."metadata" -> 'allGroupsAssignment' -> 'timeLimitMinutes'
  )
FROM "Activity" AS activity
WHERE assignment."activityId" = activity."id"
  AND NOT (COALESCE(assignment."metadata", '{}'::jsonb) ? 'timeLimitMinutes')
  AND COALESCE(activity."metadata" -> 'allGroupsAssignment', '{}'::jsonb) ? 'timeLimitMinutes'
  AND EXISTS (
    SELECT 1
    FROM "Test" AS test
    WHERE test."activityId" = activity."id"
  );
