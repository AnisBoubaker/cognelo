import { fileContentPlugin } from "@cognelo/plugin-file-content";
import { githubRepoContentPlugin } from "@cognelo/plugin-github-repo";
import { textContentPlugin } from "@cognelo/plugin-text-content";

export type ContentPluginLocale = "en" | "fr" | "zh" | "ar";

export type LocalizedText = {
  default: string;
  i18n?: Partial<Record<ContentPluginLocale, string>>;
};

export type ContentTypeIconName = "file" | "github" | "text" | "link" | "document" | "placeholder";

export type ContentEmbeddingSourceKind = "external_url" | "file_upload" | "text_body" | "none" | "custom";

export type ContentTypeCreateMode = "shell" | "upload" | "custom";

export type ContentTypeDefinition = {
  key: string;
  label: LocalizedText;
  description: LocalizedText;
  defaultTitle: LocalizedText;
  icon: ContentTypeIconName;
  createMode: ContentTypeCreateMode;
  embeddingSource: ContentEmbeddingSourceKind;
  rendererKey?: string;
  settingsRendererKey?: string;
};

export type PluginDatabaseModule = {
  namespace: string;
  tables: readonly string[];
  migrations?: readonly {
    id: string;
    statements: readonly string[];
  }[];
  notes?: readonly string[];
};

export type ContentTypePlugin = {
  key: string;
  packageName: string;
  name: string;
  version?: string;
  db: PluginDatabaseModule;
  contentTypes: readonly ContentTypeDefinition[];
};

export type ContentTypePluginManifest = {
  pluginKey: string;
  pluginName: string;
  packageName: string;
  version?: string;
  contentTypeKeys: string[];
  db: PluginDatabaseModule;
};

export type ContentTypeMessages = {
  label: string;
  description: string;
  defaultTitle: string;
};

const plugins: readonly ContentTypePlugin[] = [githubRepoContentPlugin, fileContentPlugin, textContentPlugin];

export function createContentTypeRegistry(registryPlugins: readonly ContentTypePlugin[]) {
  const pluginKeys = new Set<string>();
  const definitions = new Map<string, ContentTypeDefinition>();

  for (const plugin of registryPlugins) {
    if (pluginKeys.has(plugin.key)) {
      throw new Error(`Content type plugin already registered: ${plugin.key}`);
    }
    pluginKeys.add(plugin.key);

    for (const definition of plugin.contentTypes) {
      if (definitions.has(definition.key)) {
        throw new Error(`Content type already registered: ${definition.key}`);
      }
      definitions.set(definition.key, definition);
    }
  }

  return {
    getContentTypeDefinition(key: string) {
      return definitions.get(key);
    },
    getContentTypePlugin(key: string) {
      return registryPlugins.find((plugin) => plugin.key === key);
    },
    getContentTypePluginForType(contentTypeKey: string) {
      return registryPlugins.find((plugin) => plugin.contentTypes.some((definition) => definition.key === contentTypeKey));
    },
    listContentTypeDefinitions() {
      return Array.from(definitions.values());
    },
    listContentTypePlugins() {
      return [...registryPlugins];
    },
    listContentTypePluginManifests(): ContentTypePluginManifest[] {
      return registryPlugins.map((plugin) => ({
        pluginKey: plugin.key,
        pluginName: plugin.name,
        packageName: plugin.packageName,
        version: plugin.version,
        contentTypeKeys: plugin.contentTypes.map((definition) => definition.key),
        db: plugin.db
      }));
    }
  };
}

const registry = createContentTypeRegistry(plugins);

export function getContentTypeDefinition(key: string) {
  return registry.getContentTypeDefinition(key);
}

export function getContentTypePlugin(key: string) {
  return registry.getContentTypePlugin(key);
}

export function getContentTypePluginForType(contentTypeKey: string) {
  return registry.getContentTypePluginForType(contentTypeKey);
}

export function listContentTypeDefinitions() {
  return registry.listContentTypeDefinitions();
}

export function listContentTypePlugins() {
  return registry.listContentTypePlugins();
}

export function listContentTypePluginManifests() {
  return registry.listContentTypePluginManifests();
}

export function resolveLocalizedText(text: LocalizedText, locale: ContentPluginLocale) {
  return text.i18n?.[locale] ?? text.default;
}

export function getContentTypeMessages(definition: ContentTypeDefinition | undefined, locale: ContentPluginLocale): ContentTypeMessages | undefined {
  if (!definition) {
    return undefined;
  }

  return {
    label: resolveLocalizedText(definition.label, locale),
    description: resolveLocalizedText(definition.description, locale),
    defaultTitle: resolveLocalizedText(definition.defaultTitle, locale)
  };
}
