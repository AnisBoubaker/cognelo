import { describe, expect, it, vi } from "vitest";
import { linkContentPlugin } from "./index";
import { linkContentServerPlugin } from "./server";
import { getLinkContentPresentation, linkUrlSchema } from "./shared";

const user = { id: "teacher", email: "teacher@example.test", name: null, firstName: null, lastName: null, roles: ["teacher" as const] };
const handlers = linkContentServerPlugin.handlers!;
const resource = { id: "link-1", courseId: "course-1", contentTypeKey: "link", pluginKey: "link-content", title: "Guide", metadata: { url: "https://example.org/guide?a=1#part", description: "Read chapter one.", openInNewTab: false } };

describe("Link content", () => {
  it("declares plugin-owned settings, presentation, and private summary storage", () => {
    expect(linkContentPlugin.contentTypes[0]).toMatchObject({ key: "link", icon: "link", settingsRendererKey: "link-content-settings", presentationRendererKey: "link-content-presentation" });
    expect(linkContentPlugin.db.tables).toEqual(["PluginLinkContentSettings"]);
  });

  it("creates an unconfigured shell with new-tab navigation enabled", async () => {
    const created = await handlers.create!({ user, courseId: "course-1", contentTypeKey: "link", payload: { title: "New link" } });
    expect(created).toEqual({ title: "New link", metadata: { url: "", description: "", openInNewTab: true, setupStatus: "draft" } });
    await expect(handlers.resolveOpenAction!({ user, resource: { ...resource, metadata: created.metadata } })).resolves.toEqual({ kind: "none" });
    expect(getLinkContentPresentation(created.metadata).href).toBeNull();
  });

  it("validates and normalizes configured URLs without removing queries or fragments", async () => {
    const created = await handlers.create!({ user, courseId: "course-1", contentTypeKey: "link", payload: { title: " Guide ", url: " https://EXAMPLE.org/guide?a=1#part ", description: " Read this. " } });
    expect(created).toEqual({ title: "Guide", metadata: { url: resource.metadata.url, description: "Read this.", openInNewTab: true } });
    expect(linkUrlSchema.parse("http://localhost:3000/read")).toBe("http://localhost:3000/read");
  });

  it.each(["javascript:alert(1)", "data:text/html,<h1>bad</h1>", "ftp://example.org/file", "//example.org", "/page", "https://user:secret@example.org", "https://user@example.org", "", "not a url"])("rejects invalid or unsafe URL %s", async (url) => {
    await expect(handlers.update!({ user, resource, payload: { url } })).rejects.toThrow();
    expect(getLinkContentPresentation({ url }).href).toBeNull();
  });

  it("preserves omitted fields and an explicit same-tab choice, and supports clearing descriptions", async () => {
    const changed = await handlers.update!({ user, resource, payload: { title: "Renamed", description: "" } });
    expect(changed).toEqual({ title: "Renamed", metadata: { ...resource.metadata, description: "" } });
    expect(resource.title).toBe("Guide");
    await expect(handlers.update!({ user, resource, payload: { openInNewTab: true } })).resolves.toMatchObject({ metadata: { openInNewTab: true } });
    await expect(handlers.update!({ user, resource, payload: { description: "x".repeat(2001) } })).rejects.toThrow();
  });

  it("uses the same validated destination and target in browser presentation and server open actions", async () => {
    expect(getLinkContentPresentation(resource.metadata)).toEqual({ href: resource.metadata.url, target: "_self", description: resource.metadata.description });
    await expect(handlers.resolveOpenAction!({ user, resource })).resolves.toEqual({ kind: "external_url", href: resource.metadata.url, target: "_self" });
    expect(getLinkContentPresentation({ ...resource.metadata, openInNewTab: undefined }).target).toBe("_blank");
  });

  it("duplicates source fields independently and omits derived indexes", async () => {
    const copy = await handlers.duplicate!({ user, resource: { ...resource, metadata: { ...resource.metadata, embeddingIndex: { stale: true } } }, title: "Guide copy" });
    expect(copy).toMatchObject({ title: "Guide copy", metadata: resource.metadata });
    expect(copy.afterPersist).toBeTypeOf("function");
    const execute = vi.fn().mockResolvedValue(1);
    await copy.afterPersist!({ resource: { ...resource, id: "copy-1" }, transaction: { execute, query: vi.fn() } });
    expect(execute.mock.calls[0]?.slice(1)).toEqual(["copy-1", resource.id]);
    expect(copy.metadata).not.toBe(resource.metadata);
    await expect(handlers.getEmbeddingSource!({ resource })).resolves.toEqual({ kind: "external_url", url: resource.metadata.url, sourceId: resource.id });
    await expect(handlers.getEmbeddingDocuments!({ resource })).resolves.toMatchObject({ sourceId: resource.id, documents: [{ kind: "external_reference", text: `Guide\nRead chapter one.\n${resource.metadata.url}` }] });
  });

  it("keeps internal fields out of public metadata and saves them through the private hook", async () => {
    const result = await handlers.update!({ user, resource, payload: { internalSummary: "Private teaching notes", summaryMaxWords: 75, summaryFollowSameDomainLinks: true } });
    expect(result.metadata).toEqual(resource.metadata);
    expect(JSON.stringify(result.metadata)).not.toContain("Private teaching notes");
    const execute = vi.fn().mockResolvedValue(1);
    await result.afterPersist!({ resource, transaction: { execute, query: vi.fn() } });
    expect(execute.mock.calls[0]?.slice(1)).toEqual([resource.id, "Private teaching notes", 75, true, "Private teaching notes", 75, true]);
    await expect(handlers.update!({ user, resource, payload: { summaryMaxWords: 2001 } })).rejects.toThrow();
    const disabled = await handlers.update!({ user, resource, payload: { summaryFollowSameDomainLinks: false } });
    await disabled.afterPersist!({ resource, transaction: { execute, query: vi.fn() } });
    expect(execute.mock.calls[1]?.slice(1)).toEqual([resource.id, "", 100, false, null, null, false]);
  });
});
