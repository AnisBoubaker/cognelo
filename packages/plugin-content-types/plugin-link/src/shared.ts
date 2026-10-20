import { z } from "zod";
import type { ContentResourcePresentation } from "@cognelo/content-type-sdk";

export const linkUrlSchema = z.string().trim().min(1).max(4000).url().refine((value) => {
  try {
    const url = new URL(value);
    return (url.protocol === "http:" || url.protocol === "https:") && !url.username && !url.password;
  } catch {
    return false;
  }
}, "Use an HTTP or HTTPS URL without embedded credentials.").transform((value) => new URL(value).href);

export const linkPayloadSchema = z.object({
  title: z.string().trim().min(1).max(180).optional(),
  url: linkUrlSchema.optional(),
  description: z.string().trim().max(2000).optional(),
  openInNewTab: z.boolean().optional()
});

export function readLinkMetadata(metadata?: Record<string, unknown>) {
  const url = linkUrlSchema.safeParse(metadata?.url);
  return {
    url: url.success ? url.data : "",
    description: typeof metadata?.description === "string" ? metadata.description : "",
    openInNewTab: metadata?.openInNewTab !== false
  };
}

export function getLinkContentPresentation(metadata?: Record<string, unknown>): ContentResourcePresentation {
  const link = readLinkMetadata(metadata);
  return { href: link.url || null, target: link.openInNewTab ? "_blank" : "_self", description: link.description };
}
