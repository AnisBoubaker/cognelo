import type { ServerContentTypePlugin } from "@cognelo/content-type-sdk/server";
import { z } from "zod";
import { AppError, assertCanManageCourse } from "@cognelo/core";
import { getLinkContentPresentation, linkPayloadSchema, readLinkMetadata } from "./shared";
import { duplicateInternalSettings, persistInternalSettings, readInternalSettings } from "./private-settings";
import { generateLinkSummary } from "./summary";

const payloadSchema = linkPayloadSchema.extend({
  internalSummary: z.string().trim().max(20_000).optional(),
  summaryMaxWords: z.number().int().min(1).max(2000).optional()
});

export const linkContentServerPlugin: ServerContentTypePlugin = {
  key: "link-content",
  routes: [{
    path: "summary",
    contentTypeKeys: ["link"],
    methods: {
      async GET({ context }) {
        await assertCanManageCourse(context.user, context.courseId);
        if (!context.resourceId) throw new AppError(404, "NOT_FOUND", "Link not found.");
        return { settings: await readInternalSettings(context.resourceId) };
      },
      async POST({ context, readJson }) {
        return generateLinkSummary(context.user, context.courseId, await readJson());
      }
    }
  }],
  handlers: {
    async create({ payload }) {
      const { title, internalSummary, summaryMaxWords, ...fields } = payloadSchema.parse(payload);
      const metadata = { url: "", description: "", openInNewTab: true, ...fields };
      const afterPersist = persistInternalSettings({ internalSummary, maxWords: summaryMaxWords });
      return { title: title ?? "Link", metadata: { ...metadata, ...(!metadata.url ? { setupStatus: "draft" } : {}) }, ...(afterPersist ? { afterPersist } : {}) };
    },
    async update({ resource, payload }) {
      const { title, internalSummary, summaryMaxWords, ...fields } = payloadSchema.parse(payload);
      const metadata = { ...readLinkMetadata(resource.metadata), ...fields };
      const afterPersist = persistInternalSettings({ internalSummary, maxWords: summaryMaxWords });
      return { ...(title !== undefined ? { title } : {}), metadata: { ...metadata, ...(!metadata.url ? { setupStatus: "draft" } : {}) }, ...(afterPersist ? { afterPersist } : {}) };
    },
    async duplicate({ resource, title }) {
      const metadata = readLinkMetadata(resource.metadata);
      return { title, metadata: { ...metadata, ...(!metadata.url ? { setupStatus: "draft" } : {}) }, afterPersist: duplicateInternalSettings(resource.id) };
    },
    async resolveOpenAction({ resource }) {
      const { href, target } = getLinkContentPresentation(resource.metadata);
      return href ? { kind: "external_url", href, target } : { kind: "none" };
    },
    async getEmbeddingSource({ resource }) {
      const { url } = readLinkMetadata(resource.metadata);
      return url ? { kind: "external_url", url, sourceId: resource.id } : { kind: "none", sourceId: resource.id };
    },
    async getEmbeddingDocuments({ resource }) {
      const { url, description } = readLinkMetadata(resource.metadata);
      return { sourceId: resource.id, documents: url ? [{ id: `${resource.id}:link`, sourceId: resource.id, title: resource.title, text: [resource.title, description, url].filter(Boolean).join("\n"), kind: "external_reference", metadata: { url } }] : [], diagnostics: [] };
    }
  }
};
