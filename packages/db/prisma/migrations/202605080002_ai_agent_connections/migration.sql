CREATE TYPE "AiAgentProvider" AS ENUM ('ollama', 'openai', 'codex', 'claude');

CREATE TABLE "AiAgentConnection" (
  "id" TEXT NOT NULL,
  "ownerId" TEXT,
  "provider" "AiAgentProvider" NOT NULL,
  "displayName" TEXT NOT NULL,
  "model" TEXT NOT NULL,
  "baseUrl" TEXT,
  "apiKey" TEXT,
  "isEnabled" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "AiAgentConnection_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AiAgentConnection_ownerId_idx" ON "AiAgentConnection"("ownerId");
CREATE INDEX "AiAgentConnection_provider_idx" ON "AiAgentConnection"("provider");
CREATE INDEX "AiAgentConnection_isEnabled_idx" ON "AiAgentConnection"("isEnabled");

ALTER TABLE "AiAgentConnection"
  ADD CONSTRAINT "AiAgentConnection_ownerId_fkey"
  FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
