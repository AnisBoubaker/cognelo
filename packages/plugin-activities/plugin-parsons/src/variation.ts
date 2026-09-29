import type { BankActivityVariationHandler } from "@cognelo/activity-sdk/server";
import { AppError, updateBankActivity } from "@cognelo/core";
import { generateParsonsProblem } from "./generation";
import { parseParsonsConfig } from "./parsons";

export const createParsonsBankActivityVariation: BankActivityVariationHandler = async (input) => {
  const sourceConfig = parseParsonsConfig(input.sourceActivity.config);
  const requiredNonEmptyLineCount = sourceConfig.solution
    .replace(/\r\n/g, "\n")
    .split("\n")
    .filter((line) => line.trim()).length;
  const requiredPhysicalLineCount = sourceConfig.solution.replace(/\r\n/g, "\n").split("\n").length;

  await input.reportProgress({ fraction: 0.2, step: "content" });
  const generated = await generateParsonsProblem({
    user: input.user,
    description: input.sourceActivity.description || sourceConfig.prompt,
    language: sourceConfig.language,
    locale: input.locale,
    subject: input.subject,
    knowledge: input.knowledge,
    variation: {
      originalPrompt: sourceConfig.prompt,
      originalSolution: sourceConfig.solution,
      instructions: input.instructions,
      requiredNonEmptyLineCount,
      requiredPhysicalLineCount,
      groupingStructure: JSON.stringify({
        groups: sourceConfig.groups,
        precedenceRules: sourceConfig.precedenceRules
      })
    }
  });
  if (generated.status === "error") {
    throw new AppError(422, "PARSONS_VARIATION_UNAVAILABLE", generated.message);
  }
  if (generated.prompt.trim() === sourceConfig.prompt.trim() || generated.solution.trim() === sourceConfig.solution.trim()) {
    throw new AppError(422, "PARSONS_VARIATION_NOT_DISTINCT", "The AI agent did not generate a sufficiently distinct Parsons variation.");
  }

  await input.reportProgress({ fraction: 0.9, step: "saving" });
  await updateBankActivity(input.user, input.activity.id, {
    config: {
      ...sourceConfig,
      prompt: generated.prompt,
      solution: generated.solution
    },
    lifecycle: "draft"
  });
};
