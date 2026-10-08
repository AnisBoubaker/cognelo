DO $$
BEGIN
  CREATE TYPE "CourseMembershipSource" AS ENUM ('explicit', 'section_derived');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "CourseMembership"
  ADD COLUMN IF NOT EXISTS "source" "CourseMembershipSource" NOT NULL DEFAULT 'explicit';

-- Staff memberships historically created by section enrollment were indistinguishable
-- from explicit course-wide assignments. The product had no course-staff UI, so a
-- matching teacher/TA participant is the best durable evidence of a derived row.
UPDATE "CourseMembership" AS membership
SET "source" = 'section_derived'
WHERE membership."role" IN ('teacher', 'ta')
  AND EXISTS (
    SELECT 1
    FROM "CourseGroupParticipant" AS participant
    INNER JOIN "CourseGroup" AS section ON section."id" = participant."groupId"
    WHERE section."courseId" = membership."courseId"
      AND participant."userId" = membership."userId"
      AND participant."role"::text = membership."role"::text
  );

CREATE INDEX IF NOT EXISTS "CourseMembership_courseId_source_idx"
  ON "CourseMembership"("courseId", "source");
