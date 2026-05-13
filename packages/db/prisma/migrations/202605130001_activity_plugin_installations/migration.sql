CREATE TABLE "ActivityPluginInstallation" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "packageName" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "version" TEXT NOT NULL DEFAULT '0.1.0',
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "isEnabled" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ActivityPluginInstallation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ActivityPluginInstallation_key_key" ON "ActivityPluginInstallation"("key");
CREATE INDEX "ActivityPluginInstallation_isEnabled_idx" ON "ActivityPluginInstallation"("isEnabled");
