import { z } from "zod";
import { homeworkGraderPlugin } from "@cognelo/plugin-homework-grader";
import { parsonsPlugin } from "@cognelo/plugin-parsons";
import { placeholderPlugin } from "@cognelo/plugin-placeholder";
import { mcqPlugin } from "@cognelo/plugin-mcq";

export type PluginLocale = "en" | "fr" | "zh";

export type ActivityMessages = {
  name: string;
  description: string;
  defaultTitle?: string;
};

export type ActivityDefinition = {
  key: string;
  name: string;
  description: string;
  i18n?: Partial<Record<PluginLocale, ActivityMessages>>;
  defaultConfig?: Record<string, unknown>;
  configSchema?: z.ZodTypeAny;
  metadataSchema?: z.ZodTypeAny;
};

export type PluginDatabaseModule = {
  namespace: string;
  tables: readonly string[];
  notes?: readonly string[];
};

export type ActivityPlugin = {
  key: string;
  name: string;
  db: PluginDatabaseModule;
  activities: ActivityDefinition[];
};

const plugins: ActivityPlugin[] = [placeholderPlugin, homeworkGraderPlugin, parsonsPlugin, mcqPlugin];

const definitions = new Map<string, ActivityDefinition>();
for (const plugin of plugins) {
  for (const definition of plugin.activities) {
    if (definitions.has(definition.key)) {
      throw new Error(`Activity type already registered: ${definition.key}`);
    }
    definitions.set(definition.key, definition);
  }
}

export function getActivityDefinition(key: string) {
  return definitions.get(key);
}

export function listActivityDefinitions() {
  return Array.from(definitions.values());
}

export function listActivityPlugins() {
  return [...plugins];
}

export function listPluginDatabaseModules() {
  return plugins.map((plugin) => ({
    pluginKey: plugin.key,
    pluginName: plugin.name,
    ...plugin.db
  }));
}

export function getActivityMessages(definition: ActivityDefinition | undefined, locale: PluginLocale): ActivityMessages | undefined {
  if (!definition) {
    return undefined;
  }

  const localized = definition.i18n?.[locale];
  return {
    name: localized?.name ?? definition.name,
    description: localized?.description ?? definition.description,
    defaultTitle: localized?.defaultTitle ?? definition.name
  };
}
