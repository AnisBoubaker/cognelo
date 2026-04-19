import { z } from "zod";
import type { ActivityPlugin } from "@cognelo/activity-sdk";

export const homeworkGraderPlugin: ActivityPlugin = {
  key: "homework-grader",
  name: "Homework grader",
  db: {
    namespace: "plugin_homework_grader",
    tables: [],
    notes: ["Future homework-grader tables should live in this plugin namespace instead of altering core course/activity tables."]
  },
  activities: [
    {
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
    }
  ]
};
