CREATE TABLE IF NOT EXISTS "ContentMaterialVector" (
 id TEXT PRIMARY KEY, "modelKey" TEXT NOT NULL, dimensions INTEGER NOT NULL, "values" BYTEA NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS "ContentMaterialIndex" (
 id TEXT PRIMARY KEY, "courseId" TEXT NOT NULL REFERENCES "Course"(id) ON DELETE CASCADE,
 "resourceId" TEXT REFERENCES "CourseContentResource"(id) ON DELETE SET NULL, "sourceId" TEXT NOT NULL,
 "connectionId" TEXT REFERENCES "AiAgentConnection"(id) ON DELETE SET NULL,
 "modelKey" TEXT NOT NULL, "sourceRevision" TEXT NOT NULL, "contentFingerprint" TEXT NOT NULL, documents JSONB NOT NULL,
 "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "ContentMaterialIndex_sourceId_modelKey_contentFingerprint_key" ON "ContentMaterialIndex"("sourceId", "modelKey", "contentFingerprint");
CREATE INDEX IF NOT EXISTS "ContentMaterialIndex_courseId_sourceId_checkedAt_idx" ON "ContentMaterialIndex"("courseId", "sourceId", "checkedAt");
CREATE TABLE IF NOT EXISTS "ContentMaterialIndexBuild" (
 "resourceId" TEXT PRIMARY KEY REFERENCES "CourseContentResource"(id) ON DELETE CASCADE, token TEXT NOT NULL,
 "expiresAt" TIMESTAMP(3) NOT NULL
);
