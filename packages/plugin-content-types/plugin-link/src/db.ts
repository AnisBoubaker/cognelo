export const linkContentDatabaseModule = {
  namespace: "plugin_link_content",
  tables: ["PluginLinkContentSettings"],
  migrations: [{
    id: "202610200001_link_internal_summary",
    statements: [
      `CREATE TABLE IF NOT EXISTS "PluginLinkContentSettings" (
        "resourceId" TEXT PRIMARY KEY REFERENCES "CourseContentResource"("id") ON DELETE CASCADE,
        "internalSummary" TEXT NOT NULL DEFAULT '',
        "maxWords" INTEGER NOT NULL DEFAULT 100 CHECK ("maxWords" BETWEEN 1 AND 2000),
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`
    ]
  }],
  notes: ["Private teacher summaries and generation word limits; never included in public content metadata."]
} as const;
