import type { BankActivityVariationHandler } from "@cognelo/activity-sdk/server";
import { AppError, updateBankActivity } from "@cognelo/core";
import {
  mergeCodingExerciseGeneratedSolutionPrivateConfig,
  parseCodingExerciseConfig,
  parseCodingExercisePrivateConfig
} from "./coding-exercises";
import {
  generateCodingExercisePrompt,
  generateCodingExerciseSolution,
  generateCodingExerciseTests
} from "./generation";
import { listBankCodingExerciseHiddenTests, replaceBankCodingExerciseHiddenTests } from "./hidden-tests";

export const createCodingExerciseBankActivityVariation: BankActivityVariationHandler = async (input) => {
  const sourceConfig = parseCodingExerciseConfig(input.sourceActivity.config);
  if (!sourceConfig.language) {
    throw new AppError(409, "CODING_EXERCISE_VARIATION_LANGUAGE_REQUIRED", "Choose a programming language before generating a variation.");
  }
  const sourcePrivate = await listBankCodingExerciseHiddenTests({ bankActivityId: input.sourceActivity.id });
  const sourceReferenceSolution = sourcePrivate.referenceSolution?.sourceCode ?? "";
  const sourcePrivateConfig = parseCodingExercisePrivateConfig(sourcePrivate.referenceSolution?.privateConfig);
  const variationBrief = buildCodingVariationBrief({
    description: input.sourceActivity.description,
    instructions: input.instructions,
    prompt: sourceConfig.prompt,
    referenceSolution: sourceReferenceSolution
  });

  await input.reportProgress({ fraction: 0.1, step: "prompt" });
  const promptResult = await generateCodingExercisePrompt({
    user: input.user,
    description: variationBrief,
    language: sourceConfig.language,
    locale: input.locale,
    subject: input.subject,
    knowledge: input.knowledge
  });
  if (promptResult.prompt.trim() === sourceConfig.prompt.trim()) {
    throw new AppError(422, "CODING_EXERCISE_VARIATION_NOT_DISTINCT", "The AI agent repeated the original programming exercise prompt.");
  }

  await input.reportProgress({ fraction: 0.35, step: "solution" });
  const solutionResult = await generateCodingExerciseSolution({
    user: input.user,
    description: variationBrief,
    prompt: promptResult.prompt,
    language: sourceConfig.language,
    locale: input.locale,
    subject: input.subject,
    knowledge: input.knowledge
  });
  if (solutionResult.status === "error") {
    throw new AppError(422, "CODING_EXERCISE_VARIATION_SOLUTION_UNAVAILABLE", solutionResult.message);
  }
  if (sourceReferenceSolution && solutionResult.referenceSolution.trim() === sourceReferenceSolution.trim()) {
    throw new AppError(422, "CODING_EXERCISE_VARIATION_SOLUTION_NOT_DISTINCT", "The AI agent repeated the original programming exercise solution.");
  }

  const visibleTestCount = sourceConfig.sampleTests.length;
  const hiddenTestCount = sourcePrivate.tests.length;
  await input.reportProgress({ fraction: 0.58, step: "tests" });
  const testsResult = visibleTestCount || hiddenTestCount
    ? await generateCodingExerciseTests({
        user: input.user,
        description: variationBrief,
        prompt: promptResult.prompt,
        language: sourceConfig.language,
        locale: input.locale,
        subject: input.subject,
        referenceSolution: solutionResult.referenceSolution,
        templateSource: solutionResult.templateSource,
        templateVisibleLineNumbers: solutionResult.templateVisibleLineNumbers,
        visibleTestCount,
        hiddenTestCount,
        knowledge: input.knowledge
      })
    : null;
  if (testsResult?.status === "error") {
    throw new AppError(422, "CODING_EXERCISE_VARIATION_TESTS_UNAVAILABLE", testsResult.message);
  }
  if (testsResult && testSuitesMatch(sourceConfig.sampleTests, sourcePrivate.tests, testsResult.sampleTests, testsResult.hiddenTests)) {
    throw new AppError(422, "CODING_EXERCISE_VARIATION_TESTS_NOT_DISTINCT", "The AI agent repeated the original programming exercise tests.");
  }

  const nextPrivateConfig = mergeCodingExerciseGeneratedSolutionPrivateConfig(sourcePrivateConfig, solutionResult);
  const sampleTests = testsResult?.sampleTests ?? [];
  const hiddenTests = (testsResult?.hiddenTests ?? []).map((test, index) => ({
    ...test,
    weight: sourcePrivate.tests[index]?.weight ?? test.weight
  }));
  const nextConfig = {
    ...sourceConfig,
    prompt: promptResult.prompt,
    starterCode: solutionResult.starterCode,
    studentTemplateSource: solutionResult.templateSource,
    sampleTests
  };

  await input.reportProgress({ fraction: 0.82, step: "validating" });
  await updateBankActivity(input.user, input.activity.id, { config: nextConfig, lifecycle: "draft" });
  await replaceBankCodingExerciseHiddenTests({
    activityBankId: input.activityBankId,
    bankActivityId: input.activity.id,
    activityConfig: nextConfig,
    user: input.user,
    input: {
      tests: hiddenTests,
      sampleTests,
      referenceSolution: solutionResult.referenceSolution,
      privateConfig: nextPrivateConfig,
      activityConfig: nextConfig
    }
  });
  await input.reportProgress({ fraction: 0.98, step: "saving" });
};

function buildCodingVariationBrief(input: {
  description: string;
  instructions: string;
  prompt: string;
  referenceSolution: string;
}) {
  return [
    "Create a genuine variation of the programming exercise below.",
    "Preserve the same selected knowledge concepts, programming language, rubric applicability, difficulty, cognitive demand, and approximate amount of work.",
    "The rubric will be copied unchanged, so the new exercise must still be assessable with every original criterion.",
    "Change the required reasoning or implementation path so the solution is slightly different.",
    "Do not merely rename variables, numbers, or entities, and do not only move the same task into a different story.",
    "",
    "Optional teacher instructions:",
    input.instructions || "None.",
    "",
    "Original activity description:",
    input.description.slice(0, 1000),
    "",
    "Original student prompt:",
    input.prompt.slice(0, 6000),
    "",
    "Original reference solution (for complexity reference only):",
    input.referenceSolution.slice(0, 2500)
  ].join("\n");
}

function testSuitesMatch(
  sourceSampleTests: unknown[],
  sourceHiddenTests: unknown[],
  generatedSampleTests: unknown[],
  generatedHiddenTests: unknown[]
) {
  return comparableTests(sourceSampleTests, ["title", "input", "output", "testCode", "outputMatchMode", "containsLinesOrderMatters"])
      === comparableTests(generatedSampleTests, ["title", "input", "output", "testCode", "outputMatchMode", "containsLinesOrderMatters"])
    && comparableTests(sourceHiddenTests, ["name", "stdin", "expectedOutput", "testCode", "isEnabled", "outputMatchMode", "containsLinesOrderMatters"])
      === comparableTests(generatedHiddenTests, ["name", "stdin", "expectedOutput", "testCode", "isEnabled", "outputMatchMode", "containsLinesOrderMatters"]);
}

function comparableTests(tests: unknown[], keys: string[]) {
  return JSON.stringify(tests.map((test) => {
    if (!test || typeof test !== "object" || Array.isArray(test)) return test;
    const record = test as Record<string, unknown>;
    return keys.map((key) => record[key]);
  }));
}
