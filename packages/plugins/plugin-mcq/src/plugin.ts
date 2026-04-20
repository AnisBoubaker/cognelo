import { z } from "zod";
import type { ActivityPlugin } from "@cognelo/activity-sdk";
import { parseMcqSource } from "./mcq";

const supportedLanguages = new Set<string>([
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
    defaultCodeLanguage: z.string().min(1).max(40).default("python")
  })
  .superRefine((value, context) => {
    if (!supportedLanguages.has(value.defaultCodeLanguage)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["defaultCodeLanguage"],
        message: "Choose one of the supported code languages."
      });
    }

    const parsed = parseMcqSource(value.source, value.defaultCodeLanguage);
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
  "What does this program print?",
  "",
  "```python",
  "value = 2 + 3",
  "print(value)",
  "```",
  "",
  "- [ ] 4",
  "- [x] 5",
  "- [ ] 6",
  "",
  "## Question 2",
  "Which of these are Python collection types?",
  "",
  "- [x] `list`",
  "- [x] `dict`",
  "- [ ] `switch`"
].join("\n");

export const mcqPlugin: ActivityPlugin = {
  key: "mcq",
  name: "Multpiple choice questions",
  db: {
    namespace: "plugin_mcq",
    tables: [],
    notes: ["MCQ currently relies only on core activity records and evaluates answers client-side."]
  },
  activities: [
    {
      key: "mcq",
      name: "Multpiple choice questions",
      description: "Single-choice and multiple-choice activities authored in a text-first Markdown-like format.",
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
        }
      },
      defaultConfig: {
        source: defaultMcqSource,
        defaultCodeLanguage: "python"
      },
      configSchema: mcqConfigSchema
    }
  ]
};
