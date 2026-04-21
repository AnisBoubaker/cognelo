CREATE TYPE "CourseGroupParticipantRole" AS ENUM ('teacher', 'ta', 'student');

ALTER TABLE "CourseGroupParticipant"
ADD COLUMN "role" "CourseGroupParticipantRole" NOT NULL DEFAULT 'student';

INSERT INTO "CourseGroupParticipant" (
    "id",
    "groupId",
    "userId",
    "role",
    "firstName",
    "lastName",
    "email",
    "createdAt",
    "updatedAt"
)
SELECT
    'group_creator_participant_' || g."id",
    g."id",
    u."id",
    'teacher'::"CourseGroupParticipantRole",
    split_part(COALESCE(u."name", ''), ' ', 1),
    CASE
        WHEN position(' ' in COALESCE(u."name", '')) > 0 THEN substr(u."name", position(' ' in u."name") + 1)
        ELSE ''
    END,
    u."email",
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "CourseGroup" g
JOIN "User" u ON u."id" = g."createdById"
LEFT JOIN "CourseGroupParticipant" p
  ON p."groupId" = g."id" AND p."userId" = u."id"
WHERE p."id" IS NULL;

UPDATE "CourseGroupParticipant" p
SET "role" = 'teacher'
FROM "CourseGroup" g
WHERE p."groupId" = g."id" AND p."userId" = g."createdById";
