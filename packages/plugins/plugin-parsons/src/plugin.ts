import { z } from "zod";
import type { ActivityPlugin } from "@cognara/activity-sdk";
import { parsonsDatabaseModule } from "./db";

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

export const parsonsPlugin: ActivityPlugin = {
  key: "parsons",
  name: "Parsons",
  db: parsonsDatabaseModule,
  activities: [
    {
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
    }
  ]
};
