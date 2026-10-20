import { prisma } from "@cognelo/db";
import type { ContentTypePersistHandler } from "@cognelo/content-type-sdk/server";

export type LinkInternalSettings = { internalSummary: string; maxWords: number };

export async function readInternalSettings(resourceId: string): Promise<LinkInternalSettings> {
  const rows = await prisma.$queryRaw<LinkInternalSettings[]>`
    SELECT "internalSummary", "maxWords" FROM "PluginLinkContentSettings" WHERE "resourceId" = ${resourceId}
  `;
  return rows[0] ?? { internalSummary: "", maxWords: 100 };
}

export function persistInternalSettings(input: { internalSummary?: string; maxWords?: number }): ContentTypePersistHandler | undefined {
  if (input.internalSummary === undefined && input.maxWords === undefined) return undefined;
  return async ({ resource, transaction }) => {
    await transaction.execute`
      INSERT INTO "PluginLinkContentSettings" ("resourceId", "internalSummary", "maxWords")
      VALUES (${resource.id}, ${input.internalSummary ?? ""}, ${input.maxWords ?? 100})
      ON CONFLICT ("resourceId") DO UPDATE SET
        "internalSummary" = COALESCE(${input.internalSummary ?? null}, "PluginLinkContentSettings"."internalSummary"),
        "maxWords" = COALESCE(${input.maxWords ?? null}, "PluginLinkContentSettings"."maxWords"),
        "updatedAt" = CURRENT_TIMESTAMP
    `;
  };
}

export function duplicateInternalSettings(sourceResourceId: string): ContentTypePersistHandler {
  return async ({ resource, transaction }) => {
    await transaction.execute`
      INSERT INTO "PluginLinkContentSettings" ("resourceId", "internalSummary", "maxWords")
      SELECT ${resource.id}, "internalSummary", "maxWords" FROM "PluginLinkContentSettings"
      WHERE "resourceId" = ${sourceResourceId}
    `;
  };
}
