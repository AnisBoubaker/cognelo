import { z } from "zod";
import type { ActivityPlugin } from "@cognelo/activity-sdk";
import { MCQ_AI_MAX_QUESTION_COUNT, MCQ_SOURCE_MAX_LENGTH } from "./constants";
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
    source: z.string().min(20).max(MCQ_SOURCE_MAX_LENGTH),
    aiGenerationInstructions: z.string().max(4000).default(""),
    aiQuestionCount: z.number().int().min(1).max(MCQ_AI_MAX_QUESTION_COUNT).default(5),
    defaultCodeLanguage: z.string().min(1).max(40).default("none"),
    randomizeChoices: z.boolean().default(false),
    aiFeedbackEnabled: z.boolean().default(false),
    aiFeedbackInstructions: z.string().max(4000).default("")
  })
  .superRefine((value, context) => {
    if (value.aiFeedbackEnabled && !value.aiFeedbackInstructions.trim()) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["aiFeedbackInstructions"], message: "Feedback instructions are required when AI feedback is enabled." });
    }
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
    tables: ["PluginMcqAiEvaluation"],
    migrations: [{
      id: "202609190020_ai_feedback_evaluations",
      statements: [
        `CREATE TABLE IF NOT EXISTS "PluginMcqAiEvaluation" (
          "id" TEXT NOT NULL, "activityId" TEXT NOT NULL, "coreAttemptId" TEXT, "courseId" TEXT NOT NULL,
          "groupId" TEXT NOT NULL, "participantId" TEXT, "userId" TEXT NOT NULL, "createdByUserId" TEXT NOT NULL,
          "assessmentMode" TEXT NOT NULL, "triggerKind" TEXT NOT NULL, "status" TEXT NOT NULL, "version" INTEGER NOT NULL,
          "promptVersion" TEXT NOT NULL, "schemaVersion" TEXT NOT NULL, "provider" TEXT NOT NULL, "model" TEXT NOT NULL,
          "connectionId" TEXT NOT NULL, "requestPayload" JSONB NOT NULL, "rawResponse" TEXT, "parsedResponse" JSONB,
          "sanitizedFeedback" JSONB, "submissionHash" TEXT NOT NULL, "feedbackHash" TEXT, "latencyMs" INTEGER,
          "error" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
          CONSTRAINT "PluginMcqAiEvaluation_pkey" PRIMARY KEY ("id")
        )`,
        `CREATE UNIQUE INDEX IF NOT EXISTS "PluginMcqAiEvaluation_activityId_coreAttemptId_version_key" ON "PluginMcqAiEvaluation"("activityId", "coreAttemptId", "version")`,
        `CREATE INDEX IF NOT EXISTS "PluginMcqAiEvaluation_activityId_createdAt_idx" ON "PluginMcqAiEvaluation"("activityId", "createdAt")`,
        `CREATE INDEX IF NOT EXISTS "PluginMcqAiEvaluation_coreAttemptId_createdAt_idx" ON "PluginMcqAiEvaluation"("coreAttemptId", "createdAt")`,
        `CREATE INDEX IF NOT EXISTS "PluginMcqAiEvaluation_courseId_createdAt_idx" ON "PluginMcqAiEvaluation"("courseId", "createdAt")`,
        `CREATE INDEX IF NOT EXISTS "PluginMcqAiEvaluation_participantId_createdAt_idx" ON "PluginMcqAiEvaluation"("participantId", "createdAt")`
      ]
    }],
    notes: ["MCQ keeps deterministic grading in core and stores immutable AI feedback artifacts in a plugin-owned evaluation table."]
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
        randomizeChoices: false,
        aiFeedbackEnabled: false,
        aiFeedbackInstructions: ""
      },
      configSchema: mcqConfigSchema,
      grading: {
        supportsAttempts: true,
        supportsAutoGrading: true,
        supportsManualGrading: true,
        supportsRegrading: true,
        supportsFeedbackRenderer: true,
        supportsAiFeedback: true,
        supportsAnalyticsPayloads: true,
        supportsCompositeExecution: true
      },
      manualGrading: {
        rendererKey: "mcq-manual-grading"
      },
      aiFeedback: {
        rendererKey: "mcq-ai-feedback-review"
      }
    }
  ]
};
