import { z } from "zod";
import type { ActivityPlugin } from "@cognelo/activity-sdk";
import { codingHomeworkGraderDatabaseModule } from "./db";
export * from "./algorithm";

export const codingHomeworkGraderPlugin: ActivityPlugin = {
  key: "coding-homework-grader",
  packageName: "@cognelo/plugin-coding-homework-grader",
  name: "Coding Homework Grader",
  db: codingHomeworkGraderDatabaseModule,
  activities: [
    {
      key: "coding-homework-grader",
      name: "Coding Homework Grader",
      description: "Programming assignment submission and grading workflow.",
      defaultCategoryIds: ["programming"],
      icon: "document-check",
      i18n: {
        en: {
          name: "Coding Homework Grader",
          description: "Programming assignment submission and grading workflow.",
          defaultTitle: "Coding Homework Grader"
        },
        fr: {
          name: "Correcteur de devoirs de programmation",
          description: "Flux futur pour la remise et l'évaluation des devoirs de programmation.",
          defaultTitle: "Correcteur de devoirs de programmation"
        },
        zh: {
          name: "编程作业评分器",
          description: "未来用于编程作业提交与评分的流程。",
          defaultTitle: "编程作业评分器"
        },
        ar: {
          name: "مصَحح واجبات البرمجة",
          description: "سير عمل مستقبلي لتسليم واجبات البرمجة وتصحيحها.",
          defaultTitle: "مصَحح واجبات البرمجة"
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
