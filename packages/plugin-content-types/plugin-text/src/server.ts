import { z } from "zod";
import type { ServerContentTypePlugin } from "@cognelo/content-type-sdk/server";

const textPayloadSchema = z.object({
  title: z.string().trim().min(1).max(180).optional(),
  body: z.string().max(20000).optional(),
  format: z.literal("markdown").optional()
});

function bodyFrom(metadata: Record<string, unknown> | undefined) {
  return typeof metadata?.body === "string" ? metadata.body : "";
}

export const textContentServerPlugin: ServerContentTypePlugin = {
  key: "text-content",
  handlers: {
    async create(input) {
      const parsed = textPayloadSchema.parse(input.payload);
      return {
        title: parsed.title ?? "Text note",
        metadata: {
          body: parsed.body ?? "",
          format: "markdown"
        }
      };
    },
    async update(input) {
      const parsed = textPayloadSchema.parse(input.payload);
      return {
        ...(parsed.title ? { title: parsed.title } : {}),
        metadata: {
          ...(input.resource.metadata ?? {}),
          ...(parsed.body !== undefined ? { body: parsed.body } : {}),
          format: "markdown"
        }
      };
    },
    async resolveOpenAction() {
      return { kind: "viewer" };
    },
    async getEmbeddingSource(input) {
      return { kind: "text", text: bodyFrom(input.resource.metadata), sourceId: input.resource.id };
    }
  }
};
