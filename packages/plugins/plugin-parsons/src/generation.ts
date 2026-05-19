import { z } from "zod";
import { AppError, generateQuestionAuthoringText } from "@cognelo/core";

type SubjectContext = {
  title: string;
  description: string;
};

type GenerationLocale = "en" | "fr" | "zh" | "ar";

export const parsonsGenerationInputSchema = z.object({
  description: z.string().min(10).max(4000),
  language: z.string().min(1).max(40),
  locale: z.enum(["en", "fr", "zh", "ar"]).default("en")
});

const generatedParsonsSchema = z
  .object({
    status: z.enum(["ok", "warning"]).optional().default("ok"),
    warningMessage: z.string().max(1200).optional().default(""),
    prompt: z.string().min(10).max(12000),
    solution: z.string().min(1).max(60000)
  })
  .superRefine((payload, context) => {
    if (payload.status === "warning" && payload.warningMessage.trim().length < 10) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["warningMessage"],
        message: "warningMessage is required when status is warning."
      });
    }
  });

const generatedParsonsErrorSchema = z.object({
  status: z.literal("error"),
  message: z.string().min(10).max(1200)
});

export async function generateParsonsProblem(input: {
  user: Parameters<typeof generateQuestionAuthoringText>[0];
  description: string;
  language: string;
  locale: GenerationLocale;
  subject: SubjectContext;
}) {
  const systemPrompt = buildSystemPrompt(input);
  let userPrompt = buildInitialUserPrompt(input);
  let lastPayload: unknown = null;
  let lastIssues: string[] = [];

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const raw = await generateQuestionAuthoringText(input.user, {
      systemPrompt,
      userPrompt,
      maxOutputTokens: 5000
    });
    const parsed = parseGeneratedJson(raw);
    if (!parsed.ok) {
      lastPayload = raw;
      lastIssues = [parsed.issue];
      userPrompt = buildCorrectionPrompt(raw, lastIssues);
      continue;
    }

    const impossible = generatedParsonsErrorSchema.safeParse(parsed.value);
    if (impossible.success) {
      return {
        status: "error" as const,
        message: impossible.data.message,
        attempts: attempt
      };
    }

    const validated = validateGeneratedParsonsPayload(parsed.value);
    if (!validated.issues.length && validated.payload) {
      return {
        ...validated.payload,
        attempts: attempt
      };
    }

    lastPayload = parsed.value;
    lastIssues = validated.issues;
    userPrompt = buildCorrectionPrompt(JSON.stringify(parsed.value, null, 2), validated.issues);
  }

  throw new AppError(422, "PARSONS_AI_GENERATION_INVALID", "The AI agent could not generate a valid Parsons problem.", {
    issues: lastIssues,
    payload: lastPayload
  });
}

function buildSystemPrompt(input: { language: string; locale: GenerationLocale; subject: SubjectContext }) {
  return [
    "You generate Parsons problem authoring content for Cognelo.",
    "Return only valid JSON. Do not wrap the JSON in Markdown fences. Do not add explanations.",
    "",
    "Required JSON shape when generation is possible:",
    "{",
    '  "status": "ok",',
    '  "prompt": "student-facing instruction",',
    '  "solution": "complete reference solution whose non-empty lines become shuffled Parsons blocks"',
    "}",
    "",
    "If the activity can be generated but requires assumptions, return:",
    "{",
    '  "status": "warning",',
    '  "warningMessage": "localized explanation of the assumptions made",',
    '  "prompt": "student-facing instruction",',
    '  "solution": "complete reference solution"',
    "}",
    "",
    "If the activity is totally impossible to generate, return:",
    "{",
    '  "status": "error",',
    '  "message": "localized explanation shown to the teacher"',
    "}",
    "",
    "Rules:",
    `- Programming language: ${input.language}.`,
    "- The selected programming language is authoritative. Generate the prompt and solution for that language only.",
    "- Respect the teacher description as much as possible.",
    "- A Parsons problem asks students to rebuild a provided solution from shuffled non-empty code lines.",
    "- The solution must be complete, coherent code or pseudocode-like code in the selected language, suitable to be split into line blocks.",
    "- Use tab characters for leading indentation in the solution field. Do not use spaces for leading indentation.",
    "- Prefer a concrete mini-scenario rather than an abstract statement of a programming concept.",
    "- If the description requests a concept, teach it through a small scenario with clear variables, data, or behavior.",
    "- If the description is ambiguous but still permits a plausible Parsons problem, generate anyway with status warning and explain the assumptions in warningMessage.",
    "- Use the error shape only when generation is totally impossible because the requirements are mutually contradictory or too empty to infer any meaningful exercise.",
    "- Do not use the error shape only because some details are missing; make reasonable assumptions and warn.",
    "- Do not include Markdown fences around the solution field.",
    "- The solution should normally contain at least three non-empty lines.",
    "- Keep the prompt student-facing. Do not reveal the exact final line order outside the solution field.",
    "- warningMessage and error message must be concise, actionable, and written in the current UI/content language.",
    "",
    `Current UI/content language: ${localeName(input.locale)}.`,
    "Generate all student-facing text in that language.",
    "",
    "Subject context:",
    `Title: ${input.subject.title}`,
    `Description: ${input.subject.description || "No subject description provided."}`
  ].join("\n");
}

function buildInitialUserPrompt(input: { description: string }) {
  return [
    "Generate a Parsons problem that matches this teacher description:",
    input.description.trim()
  ].join("\n\n");
}

function validateGeneratedParsonsPayload(payload: unknown) {
  const result = generatedParsonsSchema.safeParse(payload);
  if (!result.success) {
    return {
      payload: null,
      issues: result.error.issues.map((issue) => `${issue.path.join(".") || "payload"}: ${issue.message}`)
    };
  }

  const issues: string[] = [];
  const solutionLines = result.data.solution.replace(/\r\n/g, "\n").split("\n").filter((line) => line.trim().length > 0);
  if (solutionLines.length < 3) {
    issues.push("solution must contain at least three non-empty lines for a meaningful Parsons problem.");
  }

  return {
    payload: issues.length ? null : { ...result.data, solution: normalizeGeneratedSolutionIndentation(result.data.solution) },
    issues
  };
}

function normalizeGeneratedSolutionIndentation(solution: string) {
  const lines = solution.replace(/\r\n/g, "\n").split("\n");
  const leadingSpaceCounts = lines
    .map((line) => line.match(/^ +/)?.[0].length ?? 0)
    .filter((count) => count > 0);
  const indentationUnit = leadingSpaceCounts.length ? greatestCommonDivisor(leadingSpaceCounts) : 0;

  if (indentationUnit <= 1) {
    return lines.join("\n");
  }

  return lines
    .map((line) => {
      const leadingSpaces = line.match(/^ +/)?.[0].length ?? 0;
      if (!leadingSpaces) {
        return line;
      }

      const tabCount = Math.floor(leadingSpaces / indentationUnit);
      const remainingSpaces = leadingSpaces % indentationUnit;
      return `${"\t".repeat(tabCount)}${" ".repeat(remainingSpaces)}${line.slice(leadingSpaces)}`;
    })
    .join("\n");
}

function greatestCommonDivisor(values: number[]) {
  return values.reduce((current, value) => {
    let left = current;
    let right = value;
    while (right !== 0) {
      const next = left % right;
      left = right;
      right = next;
    }
    return left;
  });
}

function buildCorrectionPrompt(payload: string, issues: string[]) {
  return [
    "The previous JSON payload was invalid. Return the full corrected JSON payload only.",
    "",
    "Validation issues:",
    ...issues.map((issue) => `- ${issue}`),
    "",
    "Previous payload:",
    payload
  ].join("\n");
}

function parseGeneratedJson(value: string): { ok: true; value: unknown } | { ok: false; issue: string } {
  const trimmed = value.trim();
  const withoutFence = trimmed.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  try {
    return { ok: true, value: JSON.parse(withoutFence) };
  } catch {
    return { ok: false, issue: "Generated response is not valid JSON." };
  }
}

function localeName(locale: GenerationLocale) {
  if (locale === "fr") {
    return "French";
  }
  if (locale === "zh") {
    return "Chinese";
  }
  if (locale === "ar") {
    return "Arabic";
  }
  return "English";
}
