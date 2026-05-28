import { describe, expect, it, vi } from "vitest";
import { createServerContentTypeRegistry, getServerContentTypePlugin, type ContentEmbeddingSource, type ServerContentTypePlugin } from "./server";

const handler = vi.fn();

const fakeServerPlugin: ServerContentTypePlugin = {
  key: "fake-content",
  routes: [
    {
      path: "preview",
      contentTypeKeys: ["fake-document"],
      methods: {
        GET: handler
      }
    },
    {
      path: "/shared/action/",
      methods: {
        POST: handler
      }
    }
  ]
};

describe("server content type SDK registry", () => {
  it("registers concrete server content type plugins", () => {
    expect(getServerContentTypePlugin("github-repo-content")).toBeTruthy();
    expect(getServerContentTypePlugin("file-content")).toBeTruthy();
    expect(getServerContentTypePlugin("text-content")).toBeTruthy();
  });

  it("resolves content type plugin routes by normalized path and content type key", () => {
    const registry = createServerContentTypeRegistry([fakeServerPlugin]);

    expect(registry.resolveContentTypePluginRoute("fake-content", "fake-document", ["preview"])?.methods.GET).toBe(handler);
    expect(registry.resolveContentTypePluginRoute("fake-content", "other-document", ["preview"])).toBeNull();
    expect(registry.resolveContentTypePluginRoute("other-content", "fake-document", ["preview"])).toBeNull();
    expect(registry.resolveContentTypePluginRoute("fake-content", "other-document", ["shared", "action"])?.methods.POST).toBe(handler);
  });

  it("lists registered server plugins and routes", () => {
    const registry = createServerContentTypeRegistry([fakeServerPlugin]);

    expect(registry.getServerContentTypePlugin("fake-content")).toBe(fakeServerPlugin);
    expect(registry.listServerContentTypePlugins()).toEqual([fakeServerPlugin]);
    expect(registry.listContentTypePluginRoutes()).toEqual([
      {
        pluginKey: "fake-content",
        path: "preview",
        contentTypeKeys: ["fake-document"]
      },
      {
        pluginKey: "fake-content",
        path: "shared/action",
        contentTypeKeys: []
      }
    ]);
  });

  it("rejects duplicate server plugin keys", () => {
    expect(() => createServerContentTypeRegistry([fakeServerPlugin, { ...fakeServerPlugin }])).toThrow(/already registered/i);
  });

  it("exposes only generic embedding source descriptor shapes", () => {
    const descriptors: ContentEmbeddingSource[] = [
      { kind: "text", text: "Hello", sourceId: "text-1" },
      { kind: "file", fileRef: "stored.pdf", mimeType: "application/pdf", sourceId: "file-1" },
      { kind: "external_url", url: "https://example.com", sourceId: "url-1" },
      { kind: "none", sourceId: "empty-1" }
    ];

    expect(descriptors.map((descriptor) => descriptor.kind)).toEqual(["text", "file", "external_url", "none"]);
  });
});
