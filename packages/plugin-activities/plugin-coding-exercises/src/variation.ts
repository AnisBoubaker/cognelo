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
import { reviewCodingExerciseVariation, type CodingVariationReviewInput } from "./variation-quality";
import { formatCodingExercisesMessage } from "./web/messages";

type SolutionResult = Exclude<Awaited<ReturnType<typeof generateCodingExerciseSolution>>, { status: "error" }>;

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
    referenceSolution: sourceReferenceSolution,
    rubric: sourcePrivateConfig.aiFeedback
  });
  const generationContext = {
    user: input.user,
    language: sourceConfig.language,
    locale: input.locale,
    subject: input.subject,
    knowledge: input.knowledge
  };
  const reviewContext = {
    ...generationContext,
    instructions: input.instructions,
    source: {
      description: input.sourceActivity.description,
      prompt: sourceConfig.prompt,
      referenceSolution: sourceReferenceSolution,
      rubric: sourcePrivateConfig.aiFeedback
    }
  };
  const initialCandidate = await generateReviewedVariation({
    reviewContext, variationBrief, reportProgress: input.reportProgress
  });
  const prompt = initialCandidate.prompt;
  await input.reportProgress({ fraction: 0.34, step: "prompt" });
  const metadataResult = await generateCodingExerciseVariationMetadata({
    user: input.user,
    prompt,
    originalTitle: input.sourceActivity.title,
    originalDescription: input.sourceActivity.description,
    language: sourceConfig.language,
    locale: input.locale,
    subject: input.subject
  });

  const visibleTestCount = sourceConfig.sampleTests.length;
  const hiddenTestCount = sourcePrivate.tests.length;
  type TestsResult = Exclude<Awaited<ReturnType<typeof generateCodingExerciseTests>>, { status: "error" }>;
  let solutionResult: SolutionResult = initialCandidate.solution;
  let testsResult: TestsResult | null = null;
  let solutionBrief = variationBrief;

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    await input.reportProgress({ fraction: attempt === 1 ? 0.35 : 0.66, step: "solution" });
    let candidateSolution = initialCandidate.solution;
    if (attempt > 1) {
      // Optional testability retries must not replace a reviewed exercise with
      // an unreviewed, cosmetic, or inconsistent candidate.
      try {
        const retry = await generateCodingExerciseSolution({ ...generationContext, description: solutionBrief, prompt });
        if (retry.status === "error") break;
        const issues = await reviewCodingExerciseVariation({
          ...reviewContext, candidate: { prompt, referenceSolution: retry.referenceSolution, templateSource: retry.templateSource }
        });
        if (issues.length) break;
        candidateSolution = retry;
      } catch {
        break;
      }
    }

    solutionResult = candidateSolution;
    await input.reportProgress({ fraction: attempt === 1 ? 0.58 : 0.76, step: "tests" });
    try {
      const candidateTests = visibleTestCount || hiddenTestCount
        ? await generateCodingExerciseTests({
            user: input.user,
            description: solutionBrief,
            prompt,
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
    prompt,
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

async function generateReviewedVariation(input: {
  reviewContext: Omit<CodingVariationReviewInput, "candidate">;
  variationBrief: string;
  reportProgress: Parameters<BankActivityVariationHandler>[0]["reportProgress"];
}): Promise<{ prompt: string; solution: SolutionResult }> {
  const { user, language, locale, subject, knowledge } = input.reviewContext;
  const context = { user, language, locale, subject, knowledge };
  let feedback = "";
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const description = [input.variationBrief, feedback].filter(Boolean).join("\n\n");
    await input.reportProgress({ fraction: 0.1 + attempt * 0.08, step: "prompt" });
    const { prompt } = await generateCodingExercisePrompt({ ...context, description });
    await input.reportProgress({ fraction: 0.12 + attempt * 0.08, step: "solution" });
    const solution = await generateCodingExerciseSolution({ ...context, description, prompt });
    await input.reportProgress({ fraction: 0.14 + attempt * 0.08, step: "validating" });
    const issues = solution.status === "error"
      ? [solution.message]
      : await reviewCodingExerciseVariation({
          ...input.reviewContext,
          candidate: { prompt, referenceSolution: solution.referenceSolution, templateSource: solution.templateSource }
        });
    if (solution.status !== "error" && !issues.length) return { prompt, solution };
    feedback = [
      "The previous candidate failed independent quality review. Generate a new prompt AND solution addressing every issue. Do not merely reword the rejected task.",
      "Rejected student prompt:", prompt,
      "Review feedback:", ...issues.map((issue) => `- ${issue}`)
    ].join("\n");
  }
  throw new AppError(422, "CODING_EXERCISE_VARIATION_QUALITY_FAILED", formatCodingExercisesMessage(input.reviewContext.locale, "variationQualityFailed"));
}

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
  rubric: unknown;
}) {
  return [
    "Create a genuine variation of the programming exercise below.",
    "Preserve the same selected knowledge concepts, programming language, rubric applicability, difficulty, cognitive demand, and approximate amount of work.",
    "The rubric will be copied unchanged, so the new exercise must still be assessable with every original criterion.",
    "Design a different problem that requires a substantive change to the student's reasoning and implementation: change the computation, decision rules, state to track, decomposition, or data processing.",
    "Do not merely rename variables, change constants, translate/rephrase the prompt, reorder equivalent code, or move the same algorithm into a different story. Students must need to rethink the solution, not reskin it.",
    "Mechanical changes such as reversing ascending/descending order, flipping comparison signs, or swapping one arithmetic operator are insufficient. For simulations, change what must be tracked or how a trial unfolds, not just the labels or direction of the same event.",
    "Reject your own idea if the old solution can be reused by replacing just a condition, formula, or loop bound. For example, replacing the success predicate of the same fixed dice rolls with equality or a target sum is insufficient. Instead choose a different process (such as bounded repeated trials with a stopping rule) or a different state/data relationship, using only the same taught constructs and similar workload.",
    "Choose a coherent new task at the same level using the same taught concepts; do not add advanced techniques just to make it different. Preserve required helper functions/APIs and other course constraints. Shared boilerplate is allowed.",
    "Recompute every example, expected output, formula, probability, unit, and numerical claim for the new task. Never copy an old expected value after changing the event or conditions. Independently check favourable/total outcomes for probability tasks.",
    "Keep required provided helper/scaffold code in language-tagged Markdown fences without revealing the new complete solution.",
    "",
    "Optional teacher instructions:",
    input.instructions || "None.",
    "",
    "Original activity description:",
    input.description,
    "",
    "Original student prompt:",
    input.prompt,
    "",
    "Complete original reference solution (compare reasoning and complexity; do not reproduce its algorithm):",
    input.referenceSolution || "No reference solution provided; infer the required reasoning from the prompt.",
    "",
    "Original rubric and grading policy (preserved unchanged):",
    JSON.stringify(input.rubric)
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
