import { z } from "zod";
import type { ServerContentTypePlugin } from "@cognelo/content-type-sdk/server";
import { normalizeGithubRepoUrl } from "./shared";

const githubRepoPayloadSchema = z.object({
  title: z.string().trim().min(1).max(180).optional(),
  url: z.string().trim().url().optional()
});

function parseGithubRepoPayload(payload: unknown) {
  const input = githubRepoPayloadSchema.parse(payload);
  const url = input.url ? normalizeGithubRepoUrl(input.url) : null;
  return {
    title: input.title ?? "GitHub repository",
    url
  };
}

function readUrl(metadata: Record<string, unknown> | undefined) {
  const url = metadata?.url;
  return typeof url === "string" ? url : null;
}

export const githubRepoContentServerPlugin: ServerContentTypePlugin = {
  key: "github-repo-content",
  handlers: {
    async create(input) {
      const parsed = parseGithubRepoPayload(input.payload);
      return {
        title: parsed.title,
        metadata: parsed.url ? { url: parsed.url } : { setupStatus: "draft" }
      };
    },
    async update(input) {
      const currentUrl = readUrl(input.resource.metadata);
      const parsed = githubRepoPayloadSchema.partial().parse(input.payload);
      const nextUrl = parsed.url ? normalizeGithubRepoUrl(parsed.url) : currentUrl;
      return {
        ...(parsed.title !== undefined ? { title: parsed.title } : {}),
        metadata: {
          ...(input.resource.metadata ?? {}),
          ...(nextUrl ? { url: nextUrl } : {})
        }
      };
    },
    async resolveOpenAction(input) {
      const url = readUrl(input.resource.metadata);
      return url ? { kind: "external_url", href: url } : { kind: "none" };
    },
    async getEmbeddingSource(input) {
      const url = readUrl(input.resource.metadata);
      return url ? { kind: "external_url", url, sourceId: input.resource.id } : { kind: "none", sourceId: input.resource.id };
    }
  }
};
