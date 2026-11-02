-- Keep existing credentials/default models and legacy prepared indexes intact.
ALTER TABLE "AiAgentConnection" ADD COLUMN IF NOT EXISTS "models" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "ContentMaterialIndex" ADD COLUMN IF NOT EXISTS "embeddingConfig" JSONB NOT NULL DEFAULT '{}';
