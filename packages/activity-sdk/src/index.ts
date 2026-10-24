import { z } from "zod";
export * from "./categories";
import type { ActivityCategoryAssignment } from "./categories";

export type PluginLocale = "en" | "fr" | "zh" | "ar";

export type ActivityMessages = {
  name: string;
  description: string;
  defaultTitle?: string;
};

export type ActivityIconName = "browser-code" | "checklist" | "clipboard-check" | "code" | "document-check" | "file-code" | "list-check" | "placeholder" | "tornado";

export type ActivityGradingCapability = {
  supportsAttempts?: boolean;
  supportsAnswerExport?: boolean;
  supportsAutoGrading?: boolean;
  supportsManualGrading?: boolean;
  supportsRegrading?: boolean;
  supportsFeedbackRenderer?: boolean;
  supportsAiFeedback?: boolean;
  supportsAiFeedbackGrading?: boolean;
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

export type ActivitySolutionContent = {
  blocks: Array<
    | { kind: "markdown"; markdown: string }
    | { kind: "code"; code: string; language: string; title?: string }
  >;
};

export type ActivitySolution = {
  activities: Array<{ id: string; title: string; content: ActivitySolutionContent }>;
};

export type ActivityExecutionContext =
  | {
      kind: "student_preview";
      previewSessionId: string;
      activityId: string;
    }
  | {
      kind: "standalone";
      groupActivityId: string;
      activityAttemptId: string | null;
    }
  | {
      kind: "test_item";
      parentAttemptId: string;
      testItemId: string;
      testItemAttemptId: string | null;
    };

export type ActivityExecutionStateHost<TState> = {
  context: ActivityExecutionContext;
  load: () => Promise<TState | null>;
  save: (state: TState) => Promise<TState>;
  clear?: () => Promise<void>;
  executeAction?: <TResult = unknown>(action: string, payload: unknown) => Promise<TResult>;
};

export type ActivityExecutionHost<TState, TSubmissionResult> = ActivityExecutionStateHost<TState> & {
  submit: (state: TState) => Promise<TSubmissionResult>;
};

export type TimedActivityAutoSubmit = {
  requestId: number;
  onSettled: (submitted: boolean) => void;
};

export type ActivityManualGradingContract = {
  routePath?: string;
  rendererKey?: string;
};

export type ActivityAiFeedbackContract = {
  rendererKey?: string;
};

export type ActivityAuthoringContract = {
  gradingTab?: boolean;
  supportsVariations?: boolean;
};

export type ActivityStudentViewContract =
  | {
      mode: "interactive";
      execution: "client" | "core" | "plugin";
    }
  | { mode: "read_only" }
  | { mode: "unsupported" };

export type ActivityProvider =
  | { kind: "core"; key: string }
  | { kind: "plugin"; key: string };

export type ActivityCreationScope = "bank" | "course";

export type ActivityDefinition = {
  /** Opt-in reference solution, served only through the host's release gate. */
  supportsSolution?: boolean;
  /** Preserve response identity when authored questions change during an attempt. Pure and student-safe. */
  reconcileResponseState?: (previousConfig: unknown, nextConfig: unknown, state: Record<string, unknown>) => Record<string, unknown>;
  /** Strip grading evidence from learner draft/history payloads. Grades use the release-controlled channel. */
  studentResponseState?: (state: Record<string, unknown>) => Record<string, unknown>;
  key: string;
  name: string;
  description: string;
  creationScopes?: readonly ActivityCreationScope[];
  defaultCategoryIds?: ActivityCategoryAssignment;
  isEnabledByDefault?: boolean;
  icon?: ActivityIconName;
  grading?: ActivityGradingCapability;
  manualGrading?: ActivityManualGradingContract;
  aiFeedback?: ActivityAiFeedbackContract;
  authoring?: ActivityAuthoringContract;
  studentView: ActivityStudentViewContract;
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

const pluginsByKey = new Map<string, ActivityPlugin>();

const coreDefinitions: ActivityDefinition[] = [
  {
    key: "test",
    supportsSolution: true,
    name: "Test",
    description: "A summative assessment composed of regular activities.",
    creationScopes: ["course", "bank"],
    defaultCategoryIds: ["generic"],
    isEnabledByDefault: true,
    icon: "clipboard-check",
    studentView: { mode: "interactive", execution: "core" },
    grading: {
      supportsAttempts: true,
      supportsAnswerExport: true,
      supportsAutoGrading: true,
      supportsManualGrading: true,
      supportsRegrading: true,
      supportsFeedbackRenderer: true,
      supportsAnalyticsPayloads: true,
      supportsAiFeedback: true,
      supportsAiFeedbackGrading: true
    },
    manualGrading: {
      rendererKey: "test-manual-grading"
    },
    authoring: {
      supportsVariations: true
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
function registerActivityDefinition(definition: ActivityDefinition, provider: ActivityProvider) {
  if (definitions.has(definition.key)) {
    throw new Error(`Activity type already registered: ${definition.key}`);
  }
  if (!definition.studentView) {
    throw new Error(`Activity type must declare Student view support: ${definition.key}`);
  }
  if (definition.grading?.supportsCompositeExecution && definition.studentView.mode !== "interactive") {
    throw new Error(`Test-capable activity types must provide interactive Student view support: ${definition.key}`);
  }
  definitions.set(definition.key, { ...definition, provider });
}

export function registerActivityPlugin(plugin: ActivityPlugin) {
  const replacementDefinitions = new Map(definitions);
  const previousPlugin = pluginsByKey.get(plugin.key);

  for (const definition of previousPlugin?.activities ?? []) {
    if (replacementDefinitions.get(definition.key)?.provider.key === plugin.key) {
      replacementDefinitions.delete(definition.key);
    }
  }

  for (const definition of plugin.activities) {
    if (!definition.studentView) {
      throw new Error(`Activity type must declare Student view support: ${definition.key}`);
    }
    if (definition.grading?.supportsCompositeExecution && definition.studentView.mode !== "interactive") {
      throw new Error(`Test-capable activity types must provide interactive Student view support: ${definition.key}`);
    }
    if (replacementDefinitions.has(definition.key)) {
      throw new Error(`Activity type already registered: ${definition.key}`);
    }
    replacementDefinitions.set(definition.key, {
      ...definition,
      provider: { kind: "plugin", key: plugin.key }
    });
  }

  pluginsByKey.set(plugin.key, plugin);
  definitions.clear();
  for (const [key, definition] of replacementDefinitions) definitions.set(key, definition);
}

export function registerActivityPlugins(plugins: readonly ActivityPlugin[]) {
  for (const plugin of plugins) registerActivityPlugin(plugin);
}

export function validateStudentViewClientContracts(input: {
  definitions: readonly ActivityDefinition[];
  interactiveActivityTypeKeys: readonly string[];
  testItemActivityTypeKeys: readonly string[];
}) {
  const definitionsByKey = new Map(input.definitions.map((definition) => [definition.key, definition]));
  const interactiveKeys = new Set(input.interactiveActivityTypeKeys);
  const testItemKeys = new Set(input.testItemActivityTypeKeys);

  for (const key of interactiveKeys) {
    const definition = definitionsByKey.get(key);
    if (!definition) throw new Error(`Student view renderer registered for unknown activity type: ${key}`);
    if (definition.studentView.mode !== "interactive") {
      throw new Error(`Non-interactive activity type has a Student view renderer: ${key}`);
    }
  }

  for (const definition of input.definitions) {
    if (definition.studentView.mode === "interactive" && !interactiveKeys.has(definition.key)) {
      throw new Error(`Interactive activity type is missing a Student view renderer: ${definition.key}`);
    }
    if (definition.grading?.supportsCompositeExecution && !testItemKeys.has(definition.key)) {
      throw new Error(`Test-capable activity type is missing a Student view Test-item renderer: ${definition.key}`);
    }
  }

  for (const key of testItemKeys) {
    const definition = definitionsByKey.get(key);
    if (!definition) throw new Error(`Student view Test-item renderer registered for unknown activity type: ${key}`);
    if (!definition.grading?.supportsCompositeExecution || definition.studentView.mode !== "interactive") {
      throw new Error(`Invalid Student view Test-item renderer registration: ${key}`);
    }
  }
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
  return [...pluginsByKey.values()];
}

export function getActivityPlugin(key: string) {
  return pluginsByKey.get(key);
}

export function getActivityPluginForActivityType(activityTypeKey: string) {
  return listActivityPlugins().find((plugin) => plugin.activities.some((definition) => definition.key === activityTypeKey));
}

export function listPluginDatabaseModules() {
  return listActivityPlugins().map((plugin) => ({
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
