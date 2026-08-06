import { z } from "zod";
import type { ActivityPlugin } from "@cognelo/activity-sdk";
import { parseMcqSource } from "./mcq";

const supportedLanguages = new Set<string>([
  "none",
  "actionscript",
  "c",
  "coffee",
  "cpp",
  "css",
  "go",
  "graphql",
  "html",
  "javascript",
  "json",
  "jsx",
  "kotlin",
  "markdown",
  "objectivec",
  "python",
  "reason",
  "rust",
  "sql",
  "swift",
  "typescript",
  "tsx",
  "xml",
  "yaml"
]);

const mcqConfigSchema = z
  .object({
    source: z.string().min(20).max(30000),
    aiGenerationInstructions: z.string().max(4000).default(""),
    aiQuestionCount: z.number().int().min(1).max(20).default(5),
    defaultCodeLanguage: z.string().min(1).max(40).default("none"),
    randomizeChoices: z.boolean().default(false)
  })
  .superRefine((value, context) => {
    if (!supportedLanguages.has(value.defaultCodeLanguage)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["defaultCodeLanguage"],
        message: "Choose one of the supported code languages."
      });
    }

    const parsed = parseMcqSource(value.source, "none");
    if (!parsed.questions.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["source"],
        message: "An MCQ activity must include at least one `## Question` section."
      });
    }

    for (const issue of parsed.errors) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["source"],
        message: issue.message
      });
    }
  });

const defaultMcqSource = [
  "Write the MCQ activity with Markdown-style text.",
  "",
  "## Question 1",
  "Which planet is the largest in our solar system?",
  "",
  "- [ ] Earth",
  "- [x] Jupiter",
  "- [ ] Mars",
  "",
  "## Question 2",
  "Which of these are renewable energy sources?",
  "",
  "- [x] Solar energy",
  "- [x] Wind energy",
  "- [ ] Coal"
].join("\n");

export const mcqPlugin: ActivityPlugin = {
  key: "mcq",
  packageName: "@cognelo/plugin-mcq",
  name: "Multpiple choice questions",
  db: {
    namespace: "plugin_mcq",
    tables: [],
    notes: ["MCQ uses generic activity config for authoring and core ActivityAttempt/gradebook records for summative submissions; it owns no plugin tables."]
  },
  activities: [
    {
      key: "mcq",
      name: "Multpiple choice questions",
      description: "Single-choice and multiple-choice activities authored in a text-first Markdown-like format.",
      defaultCategoryIds: ["generic", "all"],
      icon: "checklist",
      i18n: {
        en: {
          name: "Multpiple choice questions",
          description: "Single-choice and multiple-choice activities authored in a text-first Markdown-like format.",
          defaultTitle: "Multpiple choice questions"
        },
        fr: {
          name: "Questions à choix multiples",
          description: "Activités à choix simple ou multiple rédigées dans un format textuel inspiré de Markdown.",
          defaultTitle: "Questions à choix multiples"
        },
        zh: {
          name: "选择题",
          description: "使用文本优先、类 Markdown 格式编写的单选题和多选题活动。",
          defaultTitle: "选择题"
        },
        ar: {
          name: "أسئلة اختيار من متعدد",
          description: "أنشطة اختيار مفرد ومتعدد تؤلف بصيغة نصية شبيهة بماركداون.",
          defaultTitle: "أسئلة اختيار من متعدد"
        }
      },
      defaultConfig: {
        source: defaultMcqSource,
        aiGenerationInstructions: "",
        aiQuestionCount: 5,
        defaultCodeLanguage: "none",
        randomizeChoices: false
      },
      configSchema: mcqConfigSchema,
      grading: {
        supportsAttempts: true,
        supportsAutoGrading: true,
        supportsManualGrading: true,
        supportsFeedbackRenderer: true,
        supportsAnalyticsPayloads: true
      },
      manualGrading: {
        rendererKey: "mcq-manual-grading"
      }
    }
  ]
};
