-- Retain removed Test children and their attempts/revisions as academic history.
ALTER TABLE "TestItem" ADD COLUMN IF NOT EXISTS "removedAt" TIMESTAMP(3);
