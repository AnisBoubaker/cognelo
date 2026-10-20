import { z } from "zod";
import type { ContentResourcePresentation } from "@cognelo/content-type-sdk";

export const textPayloadSchema = z.object({
  title: z.string().trim().min(1).max(180).optional(),
  body: z.string().max(20000).optional(),
  format: z.literal("markdown").optional(),
  displayMode: z.enum(["inline", "page", "modal"]).optional(),
  openInNewTab: z.boolean().optional()
});

export function readTextContent(metadata?: Record<string, unknown>): { body: string; displayMode: "inline" | "page" | "modal"; openInNewTab: boolean } {
  return {
    body: typeof metadata?.body === "string" ? metadata.body : "",
    displayMode: metadata?.displayMode === "page" || metadata?.displayMode === "modal" ? metadata.displayMode : "inline" as const,
    openInNewTab: metadata?.openInNewTab === true
  };
}

export function getTextContentPresentation(metadata?: Record<string, unknown>): ContentResourcePresentation {
  const { displayMode, openInNewTab } = readTextContent(metadata);
  return { href: null, displayMode, target: displayMode === "page" && openInNewTab ? "_blank" : "_self" };
}
