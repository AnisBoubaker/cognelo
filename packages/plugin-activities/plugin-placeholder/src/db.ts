export const placeholderDatabaseModule = {
  namespace: "plugin_placeholder",
  tables: ["PluginPlaceholderDummyRecord", "PluginPlaceholderDummyAudit"],
  migrations: [
    {
      id: "202605130010_baseline",
      statements: [
        `CREATE TABLE IF NOT EXISTS "PluginPlaceholderDummyRecord" (
          "id" TEXT NOT NULL,
          "label" TEXT NOT NULL,
          "payload" JSONB NOT NULL DEFAULT '{}',
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL,
          CONSTRAINT "PluginPlaceholderDummyRecord_pkey" PRIMARY KEY ("id")
        )`,
        `CREATE INDEX IF NOT EXISTS "PluginPlaceholderDummyRecord_createdAt_idx" ON "PluginPlaceholderDummyRecord"("createdAt")`,
        `CREATE TABLE IF NOT EXISTS "PluginPlaceholderDummyAudit" (
          "id" TEXT NOT NULL,
          "action" TEXT NOT NULL,
          "payload" JSONB NOT NULL DEFAULT '{}',
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "PluginPlaceholderDummyAudit_pkey" PRIMARY KEY ("id")
        )`,
        `CREATE INDEX IF NOT EXISTS "PluginPlaceholderDummyAudit_action_idx" ON "PluginPlaceholderDummyAudit"("action")`,
        `CREATE INDEX IF NOT EXISTS "PluginPlaceholderDummyAudit_createdAt_idx" ON "PluginPlaceholderDummyAudit"("createdAt")`
      ]
    }
  ],
  notes: [
    "These dummy tables exist only to exercise plugin activation, deactivation, backup, and restore flows.",
    "Real placeholder activity behavior still relies only on core activity records."
  ]
} as const;
