import type { ServerContentTypePlugin } from "@cognelo/content-type-sdk/server";
import { getLinkContentPresentation, linkPayloadSchema, readLinkMetadata } from "./shared";

export const linkContentServerPlugin: ServerContentTypePlugin = {
  key: "link-content",
  handlers: {
    async create({ payload }) {
      const { title, ...fields } = linkPayloadSchema.parse(payload);
      const metadata = { url: "", description: "", openInNewTab: true, ...fields };
      return { title: title ?? "Link", metadata: { ...metadata, ...(!metadata.url ? { setupStatus: "draft" } : {}) } };
    },
    async update({ resource, payload }) {
      const { title, ...fields } = linkPayloadSchema.parse(payload);
      const metadata = { ...readLinkMetadata(resource.metadata), ...fields };
      return { ...(title !== undefined ? { title } : {}), metadata: { ...metadata, ...(!metadata.url ? { setupStatus: "draft" } : {}) } };
    },
    async duplicate({ resource, title }) {
      const metadata = readLinkMetadata(resource.metadata);
      return { title, metadata: { ...metadata, ...(!metadata.url ? { setupStatus: "draft" } : {}) } };
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
