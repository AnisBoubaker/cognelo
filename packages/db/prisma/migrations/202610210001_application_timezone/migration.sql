CREATE TABLE "ApplicationSettings" (
  "id" TEXT NOT NULL DEFAULT 'instance',
  "timeZone" TEXT NOT NULL DEFAULT 'UTC',
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedById" TEXT,
  CONSTRAINT "ApplicationSettings_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ApplicationSettings_singleton_check" CHECK ("id" = 'instance'),
  CONSTRAINT "ApplicationSettings_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "ApplicationSettings" ("id", "timeZone") VALUES ('instance', 'UTC');
