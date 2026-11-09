import { z } from "zod";
import type { ActivityPlugin } from "@cognelo/activity-sdk";
import { codingHomeworkGraderDatabaseModule } from "./db";
export * from "./algorithm";
export * from "./parsers";
export * from "./web/client";
export * from "./web/homework-submission-management";
export * from "./web/coding-homework-grader-activity-view";
export * from "./web/coding-homework-manual-grading-panel";

export const codingHomeworkGraderPlugin: ActivityPlugin = {
  key: "coding-homework-grader",
  packageName: "@cognelo/plugin-coding-homework-grader",
  name: "Programming Homework",
  db: codingHomeworkGraderDatabaseModule,
  activities: [
    {
      key: "coding-homework-grader",
      assessmentFlow: "deferred",
      supportsTeamwork: true,
      usesMaterialEmbeddings: true,
      authoring: { settingsTab: true, simulationTab: true },
      name: "Programming Homework",
      description: "Programming assignment submission and grading workflow.",
      defaultCategoryIds: ["programming"],
      icon: "file-code",
      studentConfig: (config) => ({ gradingMode: config.gradingMode, maxAttempts: config.maxAttempts, repositoryTemplateUrl: config.repositoryTemplateUrl }),
      studentView: { mode: "read_only" },
      grading: {
        supportsAttempts: true,
        supportsAnswerExport: true,
        supportsManualGrading: true,
        supportsFeedbackRenderer: true,
        supportsAnalyticsPayloads: true,
        defaultMaxAttempts: 3
      },
      submissionManagement: { rendererKey: "coding-homework-submission-management" },
      manualGrading: {
        rendererKey: "coding-homework-grader-manual-grading"
      },
      i18n: {
        en: {
          name: "Programming Homework",
          description: "Programming assignment submission and grading workflow.",
          defaultTitle: "Programming Homework"
        },
        fr: {
          name: "Devoir de programmation",
          description: "Remise et évaluation des devoirs de programmation.",
          defaultTitle: "Devoir de programmation"
        },
        zh: {
          name: "编程作业",
          description: "编程作业提交与评分流程。",
          defaultTitle: "编程作业"
        },
        ar: {
          name: "واجب البرمجة",
          description: "سير عمل لتسليم واجبات البرمجة وتصحيحها.",
          defaultTitle: "واجب البرمجة"
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
