ALTER TABLE "User" ADD COLUMN "metadata" JSONB NOT NULL DEFAULT '{}';

UPDATE "User"
SET "metadata" = jsonb_set(
  "User"."metadata",
  '{aiPreferences,questionAuthoringAiAgentConnectionId}',
  to_jsonb(("Course"."metadata" #>> '{aiSettings,questionAuthoringAiAgentConnectionId}')::text),
  true
)
FROM "Course"
INNER JOIN "CourseMembership"
  ON "CourseMembership"."courseId" = "Course"."id"
  AND "CourseMembership"."role" IN ('owner', 'teacher')
WHERE
  "CourseMembership"."userId" = "User"."id"
  AND "Course"."metadata" #>> '{aiSettings,questionAuthoringAiAgentConnectionId}' IS NOT NULL
  AND "User"."metadata" #>> '{aiPreferences,questionAuthoringAiAgentConnectionId}' IS NULL;

UPDATE "Course"
SET "metadata" = jsonb_set(
  "Course"."metadata",
  '{aiSettings}',
  (
    COALESCE("Course"."metadata"->'aiSettings', '{}'::jsonb)
    - 'questionAuthoringAiAgentConnectionId'
  ),
  true
)
WHERE "Course"."metadata" ? 'aiSettings';
