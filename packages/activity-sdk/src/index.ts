import { z } from "zod";
import { codingExercisesPlugin } from "@cognelo/plugin-coding-exercises";
import { codingHomeworkGraderPlugin } from "@cognelo/plugin-coding-homework-grader";
import { parsonsPlugin } from "@cognelo/plugin-parsons";
import { placeholderPlugin } from "@cognelo/plugin-placeholder";
import { mcqPlugin } from "@cognelo/plugin-mcq";
import { webDesignCodingExercisesPlugin } from "@cognelo/plugin-web-design-coding-exercises";
export * from "./categories";
import type { ActivityCategoryAssignment } from "./categories";

export type PluginLocale = "en" | "fr" | "zh" | "ar";

export type ActivityMessages = {
  name: string;
  description: string;
  defaultTitle?: string;
};

export type ActivityIconName = "code" | "checklist" | "document-check" | "list-check" | "placeholder";

export type ActivityGradingCapability = {
  supportsAttempts?: boolean;
  supportsAutoGrading?: boolean;
  supportsManualGrading?: boolean;
  supportsFeedbackRenderer?: boolean;
  supportsAnalyticsPayloads?: boolean;
  supportsCompositeExecution?: boolean;
  defaultMaxAttempts?: number | null;
};

export type ActivityGradingResult = {
  rawScore: number;
  rawMaxScore: number;
  isPass?: boolean | null;
  feedback?: Record<string, unknown>;
  analyticsPayload?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
};

export type ActivityManualGradingContract = {
  routePath?: string;
  rendererKey?: string;
};

export type ActivityProvider =
  | { kind: "core"; key: string }
  | { kind: "plugin"; key: string };

export type ActivityCreationScope = "bank" | "course";

export type ActivityDefinition = {
  key: string;
  name: string;
  description: string;
  creationScopes?: readonly ActivityCreationScope[];
  defaultCategoryIds?: ActivityCategoryAssignment;
  isEnabledByDefault?: boolean;
  icon?: ActivityIconName;
  grading?: ActivityGradingCapability;
  manualGrading?: ActivityManualGradingContract;
  i18n?: Partial<Record<PluginLocale, ActivityMessages>>;
  defaultConfig?: Record<string, unknown>;
  configSchema?: z.ZodTypeAny;
  metadataSchema?: z.ZodTypeAny;
};

export type RegisteredActivityDefinition = ActivityDefinition & {
  provider: ActivityProvider;
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

export type ActivityPlugin = {
  key: string;
  packageName: string;
  name: string;
  version?: string;
  db: PluginDatabaseModule;
  activities: ActivityDefinition[];
};

const plugins: ActivityPlugin[] = [
  placeholderPlugin,
  codingHomeworkGraderPlugin,
  parsonsPlugin,
  mcqPlugin,
  codingExercisesPlugin,
  webDesignCodingExercisesPlugin
];

const coreDefinitions: ActivityDefinition[] = [
  {
    key: "test",
    name: "Test",
    description: "A summative assessment composed of regular activities.",
    creationScopes: ["course"],
    defaultCategoryIds: ["generic"],
    isEnabledByDefault: true,
    icon: "document-check",
    grading: {
      supportsAttempts: true,
      supportsAutoGrading: true,
      supportsManualGrading: true,
      supportsFeedbackRenderer: true,
      supportsAnalyticsPayloads: true
    },
    i18n: {
      en: {
        name: "Test",
        description: "A summative assessment composed of regular activities.",
        defaultTitle: "New test"
      },
      fr: {
        name: "Test",
        description: "Une évaluation sommative composée d'activités ordinaires.",
        defaultTitle: "Nouveau test"
      },
      zh: {
        name: "测验",
        description: "由常规活动组成的总结性评估。",
        defaultTitle: "新测验"
      },
      ar: {
        name: "اختبار",
        description: "تقييم ختامي مكوّن من أنشطة عادية.",
        defaultTitle: "اختبار جديد"
      }
    }
  }
];

const definitions = new Map<string, RegisteredActivityDefinition>();
for (const definition of coreDefinitions) {
  registerActivityDefinition(definition, { kind: "core", key: definition.key });
}
for (const plugin of plugins) {
  for (const definition of plugin.activities) {
    registerActivityDefinition(definition, { kind: "plugin", key: plugin.key });
  }
}

function registerActivityDefinition(definition: ActivityDefinition, provider: ActivityProvider) {
  if (definitions.has(definition.key)) {
    throw new Error(`Activity type already registered: ${definition.key}`);
  }
  definitions.set(definition.key, { ...definition, provider });
}

export function getActivityDefinition(key: string) {
  return definitions.get(key);
}

export function listActivityDefinitions() {
  return Array.from(definitions.values());
}

export function listCoreActivityDefinitions() {
  return coreDefinitions.map((definition) => definitions.get(definition.key) as RegisteredActivityDefinition);
}

export function getActivityProviderForActivityType(activityTypeKey: string) {
  return definitions.get(activityTypeKey)?.provider;
}

export function isCoreActivityType(activityTypeKey: string) {
  return getActivityProviderForActivityType(activityTypeKey)?.kind === "core";
}

export function listActivityPlugins() {
  return [...plugins];
}

export function getActivityPlugin(key: string) {
  return plugins.find((plugin) => plugin.key === key);
}

export function getActivityPluginForActivityType(activityTypeKey: string) {
  return plugins.find((plugin) => plugin.activities.some((definition) => definition.key === activityTypeKey));
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
