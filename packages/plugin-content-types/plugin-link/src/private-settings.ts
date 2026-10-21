import { prisma } from "@cognelo/db";
import type { ContentTypePersistHandler } from "@cognelo/content-type-sdk/server";

export type LinkInternalSettings = { internalSummary: string; maxWords: number; followSameDomainLinks: boolean };

export async function readInternalSettings(resourceId: string): Promise<LinkInternalSettings> {
  const rows = await prisma.$queryRaw<LinkInternalSettings[]>`
    SELECT "internalSummary", "maxWords", "followSameDomainLinks" FROM "PluginLinkContentSettings" WHERE "resourceId" = ${resourceId}
  `;
  return rows[0] ?? { internalSummary: "", maxWords: 100, followSameDomainLinks: false };
}

export function persistInternalSettings(input: { internalSummary?: string; maxWords?: number; followSameDomainLinks?: boolean }): ContentTypePersistHandler | undefined {
  if (input.internalSummary === undefined && input.maxWords === undefined && input.followSameDomainLinks === undefined) return undefined;
  return async ({ resource, transaction }) => {
    await transaction.execute`
      INSERT INTO "PluginLinkContentSettings" ("resourceId", "internalSummary", "maxWords", "followSameDomainLinks")
      VALUES (${resource.id}, ${input.internalSummary ?? ""}, ${input.maxWords ?? 100}, ${input.followSameDomainLinks ?? false})
      ON CONFLICT ("resourceId") DO UPDATE SET
        "internalSummary" = COALESCE(${input.internalSummary ?? null}, "PluginLinkContentSettings"."internalSummary"),
        "maxWords" = COALESCE(${input.maxWords ?? null}, "PluginLinkContentSettings"."maxWords"),
        "followSameDomainLinks" = COALESCE(${input.followSameDomainLinks ?? null}, "PluginLinkContentSettings"."followSameDomainLinks"),
        "updatedAt" = CURRENT_TIMESTAMP
    `;
  };
}

export function duplicateInternalSettings(sourceResourceId: string): ContentTypePersistHandler {
  return async ({ resource, transaction }) => {
    await transaction.execute`
      INSERT INTO "PluginLinkContentSettings" ("resourceId", "internalSummary", "maxWords", "followSameDomainLinks")
      SELECT ${resource.id}, "internalSummary", "maxWords", "followSameDomainLinks" FROM "PluginLinkContentSettings"
      WHERE "resourceId" = ${sourceResourceId}
    `;
  };
}
