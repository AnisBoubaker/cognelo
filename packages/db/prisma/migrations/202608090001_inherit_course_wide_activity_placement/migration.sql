-- All-groups assignments created before the course placement became the default
-- were materialized at the group root. Restore those legacy assignment rows to
-- the folder and sibling position of their matching course-level activity.
UPDATE "CourseContentItem" AS "groupItem"
SET
  "parentId" = "courseItem"."parentId",
  "position" = "courseItem"."position"
FROM "CourseContentItem" AS "courseItem",
     "CourseGroupActivity" AS "groupActivity"
WHERE "groupItem"."courseGroupActivityId" = "groupActivity"."id"
  AND "groupActivity"."metadata"->>'assignmentScope' = 'course_all_groups'
  AND "groupItem"."groupId" IS NOT NULL
  AND "groupItem"."parentId" IS NULL
  AND "courseItem"."groupId" IS NULL
  AND "courseItem"."parentId" IS NOT NULL
  AND "courseItem"."courseId" = "groupItem"."courseId"
  AND "courseItem"."activityId" = "groupItem"."activityId"
  AND "courseItem"."kind" = 'activity';
