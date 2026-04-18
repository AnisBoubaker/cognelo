import { z } from "zod";

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

const definitions = new Map<string, ActivityDefinition>();

export function registerActivity(definition: ActivityDefinition) {
  if (definitions.has(definition.key)) {
    throw new Error(`Activity type already registered: ${definition.key}`);
  }
  definitions.set(definition.key, definition);
}

export function getActivityDefinition(key: string) {
  return definitions.get(key);
}

export function listActivityDefinitions() {
  return Array.from(definitions.values());
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

registerActivity({
  key: "placeholder",
  name: "Placeholder activity",
  description: "A generic shell used while a pedagogical activity is being designed.",
  i18n: {
    en: {
      name: "Placeholder activity",
      description: "A generic shell used while a pedagogical activity is being designed.",
      defaultTitle: "Placeholder activity"
    },
    fr: {
      name: "Activité provisoire",
      description: "Une structure générique utilisée pendant la conception d'une activité pédagogique.",
      defaultTitle: "Activité provisoire"
    },
    zh: {
      name: "占位活动",
      description: "用于设计教学活动时的通用占位结构。",
      defaultTitle: "占位活动"
    }
  },
  defaultConfig: {}
});

registerActivity({
  key: "homework-grader",
  name: "Homework grader",
  description: "Future programming assignment submission and grading workflow.",
  i18n: {
    en: {
      name: "Homework grader",
      description: "Future programming assignment submission and grading workflow.",
      defaultTitle: "Homework grader"
    },
    fr: {
      name: "Correcteur de devoirs",
      description: "Flux futur pour la remise et l'évaluation des devoirs de programmation.",
      defaultTitle: "Correcteur de devoirs"
    },
    zh: {
      name: "作业评分器",
      description: "未来用于编程作业提交与评分的流程。",
      defaultTitle: "作业评分器"
    }
  },
  defaultConfig: {
    gradingMode: "manual",
    maxAttempts: 3
  },
  configSchema: z.object({
    gradingMode: z.enum(["manual", "automated", "hybrid"]).default("manual"),
    maxAttempts: z.number().int().min(1).max(100).default(3),
    repositoryTemplateUrl: z.string().url().optional()
  })
});

const parsonsGroupSchema = z.object({
  id: z.string().min(1).max(80),
  label: z.string().min(1).max(120),
  orderSensitive: z.boolean().default(true),
  startLine: z.number().int().min(0),
  endLine: z.number().int().min(0)
});

const parsonsPrecedenceRuleSchema = z.object({
  id: z.string().min(1).max(80),
  beforeGroupId: z.string().min(1).max(80),
  afterGroupId: z.string().min(1).max(80)
});

const parsonsConfigSchema = z
  .object({
    prompt: z.string().min(10).max(6000),
    solution: z.string().min(2).max(20000),
    language: z.string().min(1).max(40).default("python"),
    stripIndentation: z.boolean().default(false),
    groups: z.array(parsonsGroupSchema).default([]),
    precedenceRules: z.array(parsonsPrecedenceRuleSchema).default([])
  })
  .superRefine((value, context) => {
    const groupIds = new Set<string>();
    for (const group of value.groups) {
      if (groupIds.has(group.id)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["groups"],
          message: "Parsons group ids must be unique."
        });
        return;
      }
      groupIds.add(group.id);
      if (group.endLine < group.startLine) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["groups"],
          message: "Parsons groups must end on or after their start line."
        });
        return;
      }
    }

    for (const [index, rule] of value.precedenceRules.entries()) {
      if (!groupIds.has(rule.beforeGroupId) || !groupIds.has(rule.afterGroupId)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["precedenceRules", index],
          message: "Each Parsons precedence rule must reference existing groups."
        });
      }
    }
  });

registerActivity({
  key: "parsons-problem",
  name: "Parsons problem",
  description: "Reorder scrambled code blocks and optionally restore indentation to rebuild a working program.",
  i18n: {
    en: {
      name: "Parsons problem",
      description: "Reorder scrambled code blocks and optionally restore indentation to rebuild a working program.",
      defaultTitle: "Parsons problem"
    },
    fr: {
      name: "Problème de Parsons",
      description: "Réorganisez des blocs de code mélangés et, si nécessaire, restaurez l'indentation pour reconstruire un programme correct.",
      defaultTitle: "Problème de Parsons"
    },
    zh: {
      name: "Parsons 题",
      description: "重新排列被打乱的代码块，并在需要时恢复缩进，以重建正确程序。",
      defaultTitle: "Parsons 题"
    }
  },
  defaultConfig: {
    prompt: "Rebuild the program in the correct order.",
    solution: "print('Hello, Parsons!')",
    language: "python",
    stripIndentation: false,
    groups: [],
    precedenceRules: []
  },
  configSchema: parsonsConfigSchema
});
