import { z } from "zod";
import type { PluginRouteDefinition } from "@cognelo/activity-sdk/server";
import { AppError, assertCanManageActivityBank, assertCanManageCourse, generateQuestionAuthoringText } from "@cognelo/core";
import { prisma } from "@cognelo/db";
import { parseMcqSource, type McqParseError } from "./mcq";

const mcqGenerateInputSchema = z.object({
  description: z.string().min(10).max(4000),
  defaultCodeLanguage: z.string().min(1).max(40).default("python"),
  locale: z.enum(["en", "fr", "zh"]).default("en")
});

type SubjectContext = {
  title: string;
  description: string;
};

export const mcqGenerateRoute: PluginRouteDefinition = {
  path: "mcq/generate",
  activityTypeKeys: ["mcq"],
  methods: {
    POST: async ({ context, readJson }) => {
      const input = mcqGenerateInputSchema.parse(await readJson());

      if (context.activityBankId) {
        await assertCanManageActivityBank(context.user, context.activityBankId);
      } else if (context.courseId) {
        await assertCanManageCourse(context.user, context.courseId);
      } else {
        throw new AppError(400, "ACTIVITY_CONTEXT_REQUIRED", "MCQ generation requires a course or activity bank context.");
      }

      const subject = await resolveSubjectContext(context.activityBankId, context.courseId);
      const generated = await generateValidMcqSource({
        user: context.user,
        description: input.description,
        defaultCodeLanguage: input.defaultCodeLanguage,
        locale: input.locale,
        subject
      });

      return generated;
    }
  }
};

async function resolveSubjectContext(activityBankId: string | undefined, courseId: string | undefined): Promise<SubjectContext> {
  if (activityBankId) {
    const bank = await prisma.activityBank.findUnique({
      where: { id: activityBankId },
      include: { subject: true }
    });
    if (!bank) {
      throw new AppError(404, "ACTIVITY_BANK_NOT_FOUND", "Activity bank was not found.");
    }
    return {
      title: bank.subject.title,
      description: bank.subject.description
    };
  }

  if (courseId) {
    const course = await prisma.course.findUnique({
      where: { id: courseId },
      include: { subject: true }
    });
    if (!course) {
      throw new AppError(404, "COURSE_NOT_FOUND", "Course was not found.");
    }
    return {
      title: course.subject.title,
      description: course.subject.description
    };
  }

  throw new AppError(400, "SUBJECT_CONTEXT_REQUIRED", "Subject context is required for MCQ generation.");
}

async function generateValidMcqSource(input: {
  user: Parameters<typeof generateQuestionAuthoringText>[0];
  description: string;
  defaultCodeLanguage: string;
  locale: "en" | "fr" | "zh";
  subject: SubjectContext;
}) {
  const systemPrompt = buildSystemPrompt(input);
  let userPrompt = buildInitialUserPrompt(input);
  let lastSource = "";
  let lastIssues: McqParseError[] = [];

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const raw = await generateQuestionAuthoringText(input.user, {
      systemPrompt,
      userPrompt,
      maxOutputTokens: 6000
    });
    const source = normalizeGeneratedSource(raw);
    const parsed = parseMcqSource(source, input.defaultCodeLanguage);
    const issues = collectMcqIssues(source, parsed);

    if (!issues.length) {
      return { source, attempts: attempt };
    }

    lastSource = source;
    lastIssues = issues;
    userPrompt = buildCorrectionPrompt(source, issues);
  }

  throw new AppError(422, "MCQ_AI_GENERATION_INVALID", "The AI agent could not generate valid MCQ syntax after three attempts.", {
    issues: lastIssues,
    source: lastSource
  });
}

function buildSystemPrompt(input: {
  defaultCodeLanguage: string;
  locale: "en" | "fr" | "zh";
  subject: SubjectContext;
}) {
  return [
    "You generate multiple-choice question activities for Cognelo.",
    "Return only the MCQ source text. Do not wrap the whole answer in Markdown fences. Do not add explanations outside the source.",
    "",
    "Required syntax:",
    "- Each question starts with a level-2 Markdown heading: `## Question N`.",
    "- The prompt follows the heading.",
    "- Choices must use task-list syntax: `- [x] correct choice` and `- [ ] incorrect choice`.",
    "- Choices may be code alternatives. For a code-only choice, write the marker on its own line and put a fenced code block immediately below it.",
    "- Example code choice: `- [ ]` followed by a fenced code block using the default code language or an explicit fence language.",
    "- Each question must include at least three choices.",
    "- Each question must include at least one correct choice.",
    "- Use one correct choice for single-answer questions and multiple `[x]` choices only when the question clearly asks for multiple answers.",
    "- Code blocks are allowed. If a code block has no explicit language, Cognelo will use the default language.",
    `- Default code language: ${input.defaultCodeLanguage}.`,
    "- Prefer plausible distractors and avoid ambiguous wording.",
    "- If several questions are requested, order them crescendo from simpler to more complex.",
    "",
    `Current UI/content language: ${localeName(input.locale)}.`,
    "Generate all question text and choices in that language.",
    "",
    "Subject context:",
    `Title: ${input.subject.title}`,
    `Description: ${input.subject.description || "No subject description provided."}`
  ].join("\n");
}

function buildInitialUserPrompt(input: { description: string }) {
  return [
    "Generate a valid Cognelo MCQ activity that matches this teacher description:",
    input.description.trim()
  ].join("\n\n");
}

function buildCorrectionPrompt(source: string, issues: McqParseError[]) {
  return [
    "The previous MCQ source was invalid. Return the full corrected MCQ source only.",
    "",
    "Validation issues:",
    ...issues.map((issue) => `- Line ${issue.line}: ${issue.message}`),
    "",
    "Invalid source:",
    source
  ].join("\n");
}

function collectMcqIssues(source: string, parsed: ReturnType<typeof parseMcqSource>): McqParseError[] {
  const issues = [...parsed.errors];
  if (!source.trim()) {
    issues.push({ line: 1, message: "Generated source is empty." });
  }
  if (!parsed.questions.length) {
    issues.push({ line: 1, message: "The activity must include at least one `## Question` section." });
  }
  return issues;
}

function normalizeGeneratedSource(value: string) {
  const trimmed = value.trim();
  const fenceMatch = trimmed.match(/^```(?:markdown|md|text)?\s*\n([\s\S]*?)\n```$/i);
  return (fenceMatch?.[1] ?? trimmed).trim();
}

function localeName(locale: "en" | "fr" | "zh") {
  if (locale === "fr") {
    return "French";
  }
  if (locale === "zh") {
    return "Chinese";
  }
  return "English";
}
