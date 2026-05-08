ALTER TABLE "User" ADD COLUMN "firstName" TEXT;
ALTER TABLE "User" ADD COLUMN "lastName" TEXT;

UPDATE "User"
SET
  "firstName" = NULLIF(split_part(trim(COALESCE("name", '')), ' ', 1), ''),
  "lastName" = NULLIF(
    trim(
      CASE
        WHEN position(' ' in trim(COALESCE("name", ''))) = 0 THEN ''
        ELSE substring(trim(COALESCE("name", '')) from position(' ' in trim(COALESCE("name", ''))) + 1)
      END
    ),
    ''
  )
WHERE "name" IS NOT NULL;
