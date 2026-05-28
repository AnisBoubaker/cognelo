import { describe, expect, it } from "vitest";
import {
  createContentTypeRegistry,
  getContentTypeMessages,
  listContentTypeDefinitions,
  listContentTypePluginManifests,
  listContentTypePlugins,
  type ContentTypePlugin
} from "./index";

const fakePlugin: ContentTypePlugin = {
  key: "fake-content",
  packageName: "@cognelo/plugin-content-type-fake",
  name: "Fake content",
  version: "0.1.0",
  db: {
    namespace: "fake_content",
    tables: []
  },
  contentTypes: [
    {
      key: "fake-document",
      label: { default: "Fake document", i18n: { fr: "Document fictif" } },
      description: { default: "A fake document for tests.", i18n: { fr: "Un document fictif pour les tests." } },
      defaultTitle: { default: "Untitled fake document", i18n: { fr: "Document fictif sans titre" } },
      icon: "document",
      createMode: "shell",
      embeddingSource: "text_body",
      rendererKey: "fake-document-viewer",
      settingsRendererKey: "fake-document-settings"
    }
  ]
};

describe("content type SDK registry", () => {
  it("registers concrete content type plugins", () => {
    expect(listContentTypePlugins().map((plugin) => plugin.key)).toEqual(
      expect.arrayContaining(["github-repo-content", "file-content", "text-content"])
    );
    expect(listContentTypeDefinitions().map((definition) => definition.key)).toEqual(expect.arrayContaining(["github-repo", "file", "text"]));
    expect(listContentTypePluginManifests()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          pluginKey: "github-repo-content",
          contentTypeKeys: ["github-repo"]
        }),
        expect.objectContaining({
          pluginKey: "file-content",
          contentTypeKeys: ["file"]
        }),
        expect.objectContaining({
          pluginKey: "text-content",
          contentTypeKeys: ["text"]
        })
      ])
    );
  });

  it("resolves plugin and content type definitions from an injected registry", () => {
    const registry = createContentTypeRegistry([fakePlugin]);

    expect(registry.getContentTypePlugin("fake-content")?.packageName).toBe("@cognelo/plugin-content-type-fake");
    expect(registry.getContentTypePluginForType("fake-document")?.key).toBe("fake-content");
    expect(registry.getContentTypeDefinition("fake-document")?.settingsRendererKey).toBe("fake-document-settings");
    expect(registry.listContentTypeDefinitions()).toHaveLength(1);
    expect(registry.listContentTypePluginManifests()).toEqual([
      {
        pluginKey: "fake-content",
        pluginName: "Fake content",
        packageName: "@cognelo/plugin-content-type-fake",
        version: "0.1.0",
        contentTypeKeys: ["fake-document"],
        db: {
          namespace: "fake_content",
          tables: []
        }
      }
    ]);
  });

  it("returns localized content type messages with stable fallbacks", () => {
    const definition = fakePlugin.contentTypes[0];

    expect(getContentTypeMessages(definition, "fr")).toEqual({
      label: "Document fictif",
      description: "Un document fictif pour les tests.",
      defaultTitle: "Document fictif sans titre"
    });
    expect(getContentTypeMessages(definition, "zh")).toEqual({
      label: "Fake document",
      description: "A fake document for tests.",
      defaultTitle: "Untitled fake document"
    });
    expect(getContentTypeMessages(undefined, "en")).toBeUndefined();
  });

  it("rejects duplicate plugin keys and duplicate content type keys", () => {
    expect(() => createContentTypeRegistry([fakePlugin, { ...fakePlugin }])).toThrow(/plugin already registered/i);

    expect(() =>
      createContentTypeRegistry([
        fakePlugin,
        {
          ...fakePlugin,
          key: "other-content",
          contentTypes: [{ ...fakePlugin.contentTypes[0] }]
        }
      ])
    ).toThrow(/content type already registered/i);
  });
});
