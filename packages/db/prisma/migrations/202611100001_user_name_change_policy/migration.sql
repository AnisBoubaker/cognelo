-- Preserve existing self-service profile behavior until an administrator disables it.
ALTER TABLE "ApplicationSettings"
  ADD COLUMN IF NOT EXISTS "allowUserNameChanges" BOOLEAN NOT NULL DEFAULT true;
