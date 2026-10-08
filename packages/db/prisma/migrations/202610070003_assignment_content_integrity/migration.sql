-- Every group activity assignment must have a matching activity placement so
-- learners can reach work that appears in the gradebook. Repair historical
-- assignments first, preferring the matching shared activity's folder and
-- visibility when one exists.
INSERT INTO "CourseContentItem" (
  "id",
  "courseId",
  "groupId",
  "parentId",
  "kind",
  "titleSnapshot",
  "position",
  "isVisible",
  "activityId",
  "courseGroupActivityId",
  "metadata",
  "createdAt",
  "updatedAt"
)
SELECT
  'assignment-placement-' || "assignment"."id",
  "group"."courseId",
  "assignment"."groupId",
  "sharedPlacement"."parentId",
  'activity',
  "activity"."title",
  COALESCE("sharedPlacement"."position", "assignment"."position"),
  COALESCE("sharedPlacement"."isVisible", true),
  "assignment"."activityId",
  "assignment"."id",
  jsonb_build_object('system', 'assignment-content-integrity-repair'),
  now(),
  now()
FROM "CourseGroupActivity" AS "assignment"
JOIN "CourseGroup" AS "group" ON "group"."id" = "assignment"."groupId"
JOIN "Activity" AS "activity" ON "activity"."id" = "assignment"."activityId"
LEFT JOIN LATERAL (
  SELECT
    "item"."parentId",
    "item"."position",
    "item"."isVisible"
  FROM "CourseContentItem" AS "item"
  WHERE "item"."courseId" = "group"."courseId"
    AND "item"."groupId" IS NULL
    AND "item"."activityId" = "assignment"."activityId"
    AND "item"."kind" = 'activity'
  ORDER BY "item"."createdAt" ASC, "item"."id" ASC
  LIMIT 1
) AS "sharedPlacement" ON true
WHERE NOT EXISTS (
  SELECT 1
  FROM "CourseContentItem" AS "existingPlacement"
  WHERE "existingPlacement"."courseGroupActivityId" = "assignment"."id"
    AND "existingPlacement"."courseId" = "group"."courseId"
    AND "existingPlacement"."groupId" = "assignment"."groupId"
    AND "existingPlacement"."activityId" = "assignment"."activityId"
    AND "existingPlacement"."kind" = 'activity'
);

-- Raw or legacy assignment writers receive a safe root placement immediately.
-- The core service updates this row to the requested folder before its
-- transaction commits.
CREATE OR REPLACE FUNCTION "cognelo_materialize_assignment_content_item"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  assignment_course_id text;
  assignment_activity_title text;
BEGIN
  SELECT "group"."courseId", "activity"."title"
  INTO assignment_course_id, assignment_activity_title
  FROM "CourseGroup" AS "group"
  JOIN "Activity" AS "activity" ON "activity"."id" = NEW."activityId"
  WHERE "group"."id" = NEW."groupId";

  INSERT INTO "CourseContentItem" (
    "id",
    "courseId",
    "groupId",
    "parentId",
    "kind",
    "titleSnapshot",
    "position",
    "isVisible",
    "activityId",
    "courseGroupActivityId",
    "metadata",
    "createdAt",
    "updatedAt"
  ) VALUES (
    'assignment-placement-' || NEW."id",
    assignment_course_id,
    NEW."groupId",
    NULL,
    'activity',
    assignment_activity_title,
    NEW."position",
    true,
    NEW."activityId",
    NEW."id",
    jsonb_build_object('system', 'assignment-content-integrity'),
    now(),
    now()
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS "CourseGroupActivity_materialize_content_item" ON "CourseGroupActivity";
CREATE TRIGGER "CourseGroupActivity_materialize_content_item"
AFTER INSERT ON "CourseGroupActivity"
FOR EACH ROW
EXECUTE FUNCTION "cognelo_materialize_assignment_content_item"();

CREATE OR REPLACE FUNCTION "cognelo_require_assignment_content_item"(assignment_id text)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "CourseGroupActivity" WHERE "id" = assignment_id
  ) AND NOT EXISTS (
    SELECT 1
    FROM "CourseGroupActivity" AS "assignment"
    JOIN "CourseGroup" AS "group" ON "group"."id" = "assignment"."groupId"
    JOIN "CourseContentItem" AS "item"
      ON "item"."courseGroupActivityId" = "assignment"."id"
      AND "item"."courseId" = "group"."courseId"
      AND "item"."groupId" = "assignment"."groupId"
      AND "item"."activityId" = "assignment"."activityId"
      AND "item"."kind" = 'activity'
    WHERE "assignment"."id" = assignment_id
  ) THEN
    RAISE EXCEPTION 'Course group activity % must retain an activity content item', assignment_id
      USING ERRCODE = '23514';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION "cognelo_check_group_activity_content_item"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM "cognelo_require_assignment_content_item"(NEW."id");
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS "CourseGroupActivity_assignment_content_item_guard" ON "CourseGroupActivity";
CREATE CONSTRAINT TRIGGER "CourseGroupActivity_assignment_content_item_guard"
AFTER INSERT OR UPDATE OF "groupId", "activityId" ON "CourseGroupActivity"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION "cognelo_check_group_activity_content_item"();

CREATE OR REPLACE FUNCTION "cognelo_check_content_item_assignment"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD."courseGroupActivityId" IS NOT NULL THEN
      PERFORM "cognelo_require_assignment_content_item"(OLD."courseGroupActivityId");
    END IF;
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE'
    AND OLD."courseGroupActivityId" IS NOT NULL
    AND OLD."courseGroupActivityId" IS DISTINCT FROM NEW."courseGroupActivityId"
  THEN
    PERFORM "cognelo_require_assignment_content_item"(OLD."courseGroupActivityId");
  END IF;

  IF NEW."courseGroupActivityId" IS NOT NULL THEN
    PERFORM "cognelo_require_assignment_content_item"(NEW."courseGroupActivityId");
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS "CourseContentItem_assignment_content_item_guard" ON "CourseContentItem";
CREATE CONSTRAINT TRIGGER "CourseContentItem_assignment_content_item_guard"
AFTER INSERT OR UPDATE OR DELETE ON "CourseContentItem"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION "cognelo_check_content_item_assignment"();
