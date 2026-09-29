import type { BankActivityVariationHandler } from "@cognelo/activity-sdk/server";
import { activityKnowledgeGenerationPrompt, AppError, generateQuestionAuthoringText, updateBankActivity } from "@cognelo/core";
import { parseMcqSource } from "./mcq";
import { generateValidMcqSource } from "./routes";

export const createMcqBankActivityVariation: BankActivityVariationHandler = async (input) => {
  const sourceConfig = asRecord(input.sourceActivity.config);
  const source = typeof sourceConfig.source === "string" ? sourceConfig.source : "";
  const parsed = parseMcqSource(source, "none");
  if (!parsed.questions.length) {
    throw new AppError(409, "MCQ_VARIATION_SOURCE_INVALID", "The source MCQ must contain at least one valid question before a variation can be generated.");
  }

  await input.reportProgress({ fraction: 0.15, step: "prompt" });
  const description = await generateMcqVariationDescription(input, source);
  await input.reportProgress({ fraction: 0.45, step: "content" });
  const generated = await generateValidMcqSource({
    user: input.user,
    description,
    defaultCodeLanguage: typeof sourceConfig.defaultCodeLanguage === "string" ? sourceConfig.defaultCodeLanguage : "none",
    instructions: buildVariationInstructions(input.instructions, input.sourceActivity.description, source),
    locale: input.locale,
    questionCount: parsed.questions.length,
    subject: input.subject,
    knowledge: input.knowledge
  });
  if (generated.source.trim() === source.trim()) {
    throw new AppError(422, "MCQ_VARIATION_NOT_DISTINCT", "The AI agent repeated the original MCQ questions.");
  }

  await input.reportProgress({ fraction: 0.9, step: "saving" });
  await updateBankActivity(input.user, input.activity.id, {
    description,
    config: { ...sourceConfig, source: generated.source },
    lifecycle: "draft"
  });
};

async function generateMcqVariationDescription(
  input: Parameters<BankActivityVariationHandler>[0],
  source: string
) {
  const systemPrompt = [
    "You create the student-facing introduction for a variation of an existing Cognelo MCQ activity.",
    "Return only the new introduction text, without JSON, a title, questions, answers, or commentary.",
    "Preserve the same assessed concepts and overall difficulty.",
    "Make the new task genuinely different; do not merely replace names or move the same questions into another context.",
    `Write in ${localeName(input.locale)}.`,
    "",
    activityKnowledgeGenerationPrompt(input.knowledge)
  ].join("\n");
  let prompt = [
    "Original student introduction:",
    input.sourceActivity.description,
    "",
    "Original questions (for difficulty and concept reference only):",
    source.slice(0, 50_000),
    "",
    "Optional teacher instructions:",
    input.instructions || "None."
  ].join("\n");

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const generated = (await generateQuestionAuthoringText(input.user, {
      systemPrompt,
      userPrompt: prompt,
      maxOutputTokens: 2500
    })).trim();
    if (generated.length >= 10 && generated.length <= 30_000 && generated !== input.sourceActivity.description.trim()) {
      return generated;
    }
    prompt = `Return a distinct student introduction between 10 and 30000 characters. Do not repeat the original verbatim.\n\nPrevious response:\n${generated}`;
  }
  throw new AppError(422, "MCQ_VARIATION_PROMPT_INVALID", "The AI agent could not generate a distinct student prompt for this MCQ variation.");
}

function buildVariationInstructions(instructions: string, originalDescription: string, originalSource: string) {
  return [
    "Create a genuine variation of the original activity below.",
    "Keep the same knowledge concepts, number of questions, overall difficulty, cognitive demand, and expected completion time.",
    "Change the questions, correct answers, distractors, reasoning path, examples, and data.",
    "Do not merely rename entities or place the same problem in a different story.",
    "The new questions must be independently solvable and must not refer to the original activity.",
    "",
    "Optional teacher instructions:",
    instructions || "None.",
    "",
    "Original student introduction:",
    originalDescription.slice(0, 20_000),
    "",
    "Original MCQ source:",
    originalSource.slice(0, 60_000)
  ].join("\n");
}

function asRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function localeName(locale: "en" | "fr" | "zh" | "ar") {
  return locale === "fr" ? "French" : locale === "zh" ? "Chinese" : locale === "ar" ? "Arabic" : "English";
}
