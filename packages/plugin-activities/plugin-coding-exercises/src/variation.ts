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
  generateCodingExerciseTests,
  generateCodingExerciseVariationMetadata
} from "./generation";
import { listBankCodingExerciseHiddenTests, replaceBankCodingExerciseHiddenTests } from "./hidden-tests";
import { formatCodingExercisesMessage } from "./web/messages";

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
  await input.reportProgress({ fraction: 0.22, step: "prompt" });
  const metadataResult = await generateCodingExerciseVariationMetadata({
    user: input.user,
    prompt: promptResult.prompt,
    originalTitle: input.sourceActivity.title,
    originalDescription: input.sourceActivity.description,
    language: sourceConfig.language,
    locale: input.locale,
    subject: input.subject
  });

  const visibleTestCount = sourceConfig.sampleTests.length;
  const hiddenTestCount = sourcePrivate.tests.length;
  type SolutionResult = Exclude<Awaited<ReturnType<typeof generateCodingExerciseSolution>>, { status: "error" }>;
  type TestsResult = Exclude<Awaited<ReturnType<typeof generateCodingExerciseTests>>, { status: "error" }>;
  let solutionResult: SolutionResult | null = null;
  let testsResult: TestsResult | null = null;
  let solutionBrief = variationBrief;

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    await input.reportProgress({ fraction: attempt === 1 ? 0.35 : 0.66, step: "solution" });
    const candidateSolution = await generateCodingExerciseSolution({
      user: input.user,
      description: solutionBrief,
      prompt: promptResult.prompt,
      language: sourceConfig.language,
      locale: input.locale,
      subject: input.subject,
      knowledge: input.knowledge
    }).catch((error: unknown) => {
      // A failed optional testability retry must not erase the earlier exercise.
      if (solutionResult) return null;
      throw error;
    });
    if (!candidateSolution) break;
    if (candidateSolution.status === "error") {
      if (solutionResult) break;
      if (attempt < 2 && (visibleTestCount || hiddenTestCount)) {
        solutionBrief = buildTestabilityRetryBrief(variationBrief, visibleTestCount, hiddenTestCount, [candidateSolution.message]);
        continue;
      }
      throw new AppError(422, "CODING_EXERCISE_VARIATION_SOLUTION_UNAVAILABLE", candidateSolution.message);
    }
    if (sourceReferenceSolution && candidateSolution.referenceSolution.trim() === sourceReferenceSolution.trim()) {
      if (solutionResult) break;
      throw new AppError(422, "CODING_EXERCISE_VARIATION_SOLUTION_NOT_DISTINCT", "The AI agent repeated the original programming exercise solution.");
    }

    solutionResult = candidateSolution;
    await input.reportProgress({ fraction: attempt === 1 ? 0.58 : 0.76, step: "tests" });
    try {
      const candidateTests = visibleTestCount || hiddenTestCount
        ? await generateCodingExerciseTests({
            user: input.user,
            description: solutionBrief,
            prompt: promptResult.prompt,
            language: sourceConfig.language,
            locale: input.locale,
            subject: input.subject,
            referenceSolution: candidateSolution.referenceSolution,
            templateSource: candidateSolution.templateSource,
            templateVisibleLineNumbers: candidateSolution.templateVisibleLineNumbers,
            visibleTestCount,
            hiddenTestCount,
            knowledge: input.knowledge
          })
        : null;
      if (candidateTests?.status === "error") {
        if (attempt < 2) {
          solutionBrief = buildTestabilityRetryBrief(variationBrief, visibleTestCount, hiddenTestCount, [candidateTests.message]);
          continue;
        }
        break;
      }
      solutionResult = candidateSolution;
      testsResult = candidateTests;
      break;
    } catch (error) {
      const feedback = recoverableTestGenerationFeedback(error);
      if (!feedback) throw error;
      if (attempt >= 2) break;
      solutionBrief = buildTestabilityRetryBrief(variationBrief, visibleTestCount, hiddenTestCount, feedback);
    }
  }
  if (!solutionResult) {
    throw new AppError(422, "CODING_EXERCISE_VARIATION_SOLUTION_UNAVAILABLE", "The AI agent could not generate a reference solution that supports the required test suite.");
  }
  if (testsResult && testSuitesMatch(sourceConfig.sampleTests, sourcePrivate.tests, testsResult.sampleTests, testsResult.hiddenTests)) {
    testsResult = null;
  }

  const nextPrivateConfig = mergeCodingExerciseGeneratedSolutionPrivateConfig(sourcePrivateConfig, solutionResult);
  let sampleTests = testsResult?.sampleTests ?? [];
  const generatedHiddenTests = testsResult?.hiddenTests ?? [];
  assertVariationTestCounts({
    expectedVisible: visibleTestCount,
    expectedHidden: hiddenTestCount,
    actualVisible: sampleTests.length,
    actualHidden: generatedHiddenTests.length
  });
  let hiddenTests = generatedHiddenTests.map((test, index) => ({
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
  // Save still uses ordinary reference validation. If a case fails a final
  // recheck, prune only non-passing cases and validate the smaller suite again.
  // Each retry strictly reduces the suite; infrastructure/persistence errors throw.
  for (;;) {
    nextConfig.sampleTests = sampleTests;
    try {
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
      break;
    } catch (error) {
      if (!(error instanceof AppError) || error.code !== "REFERENCE_SOLUTION_VALIDATION_FAILED") throw error;
      const summary = (error.details as { validationSummary?: Record<string, unknown> } | undefined)?.validationSummary;
      const sampleIds = passingTestIds(summary?.sampleTests);
      const hiddenIds = passingTestIds(summary?.hiddenTests);
      if (!sampleIds || !hiddenIds) throw error;
      const passingSamples = sampleTests.filter((test) => sampleIds.has(test.id));
      const passingHidden = hiddenTests.filter((test) => hiddenIds.has(test.id));
      if (passingSamples.length + passingHidden.length >= sampleTests.length + hiddenTests.length) throw error;
      sampleTests = passingSamples;
      hiddenTests = passingHidden;
    }
  }
  await updateBankActivity(input.user, input.activity.id, {
    title: metadataResult.title,
    description: metadataResult.description,
    config: nextConfig,
    lifecycle: "draft"
  });
  await input.reportProgress({ fraction: 0.98, step: "saving" });
  const warnings: Array<{ code: string; message: string }> = [];
  if (sampleTests.length < visibleTestCount || hiddenTests.length < hiddenTestCount) {
    warnings.push({
      code: "CODING_EXERCISE_VARIATION_INCOMPLETE_TESTS",
      message: formatCodingExercisesMessage(input.locale, "variationTestsIncomplete", {
        visible: sampleTests.length, expectedVisible: visibleTestCount,
        hidden: hiddenTests.length, expectedHidden: hiddenTestCount
      })
    });
  }
  if (testsResult?.warningMessage) {
    warnings.push({ code: "CODING_EXERCISE_VARIATION_TEST_ASSUMPTIONS", message: testsResult.warningMessage });
  }
  return { warnings };
};

function passingTestIds(value: unknown) {
  if (!value || typeof value !== "object" || !("tests" in value) || !Array.isArray(value.tests)) return null;
  return new Set(value.tests.flatMap((test: unknown) =>
    test && typeof test === "object" && "passed" in test && test.passed === true && "id" in test && typeof test.id === "string"
      ? [test.id] : []
  ));
}

function assertVariationTestCounts(input: {
  expectedVisible: number;
  expectedHidden: number;
  actualVisible: number;
  actualHidden: number;
}) {
  if (input.actualVisible <= input.expectedVisible && input.actualHidden <= input.expectedHidden) return;
  throw new AppError(
    422,
    "CODING_EXERCISE_VARIATION_TEST_COUNT_MISMATCH",
    "The generated variation exceeded the requested visible or hidden test count.",
    input
  );
}

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

function buildTestabilityRetryBrief(
  variationBrief: string,
  visibleTestCount: number,
  hiddenTestCount: number,
  issues: string[]
) {
  return [
    variationBrief,
    "",
    "The previous reference solution/template could not support the required automated test suite and must not be reused.",
    `Generate a new solution/template that supports ${visibleTestCount} visible and ${hiddenTestCount} hidden meaningful independent cases.`,
    "For a function or helper task, use the callable-unit template with {{ TEST_CODE }} so tests can call it with different arguments.",
    "For a full-program task, read all varying case data from standard input; do not hard-code demonstration calls or outputs.",
    "Test-generation or execution feedback:",
    ...issues.slice(0, 12).map((issue) => `- ${issue}`)
  ].join("\n");
}

function recoverableTestGenerationFeedback(error: unknown) {
  if (!error || typeof error !== "object" || Array.isArray(error)) return null;
  const appError = error as { code?: unknown; details?: unknown; message?: unknown };
  if (typeof appError.code !== "string" || ![
    "CODING_EXERCISE_TEST_GENERATION_INVALID",
    "REFERENCE_SOLUTION_COMPILATION_FAILED"
  ].includes(appError.code)) {
    return null;
  }
  const details = appError.details && typeof appError.details === "object" && !Array.isArray(appError.details)
    ? appError.details as { issues?: unknown }
    : {};
  const issues = Array.isArray(details.issues)
    ? details.issues.filter((issue): issue is string => typeof issue === "string")
    : [];
  return issues.length ? issues : [typeof appError.message === "string" ? appError.message : "Test generation failed."];
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
