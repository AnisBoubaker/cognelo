import type { BankActivityVariationHandler } from "@cognelo/activity-sdk/server";
import { activityKnowledgeGenerationPrompt, AppError, generateQuestionAuthoringText, updateBankActivity } from "@cognelo/core";
import { z } from "zod";
import { listBankWebDesignExerciseTests, replaceBankWebDesignExerciseTests } from "./tests";
import {
  parseWebDesignExerciseConfig,
  webDesignExpectedResultCroppedToken,
  webDesignExpectedResultToken,
  type WebDesignExerciseFile
} from "./web-design-coding-exercises";

const generatedVariationSchema = z.object({
  prompt: z.string().min(10).max(20_000),
  files: z.array(z.object({
    path: z.string().min(1).max(120),
    starterCode: z.string().max(120_000),
    referenceCode: z.string().max(120_000)
  }).strict()).min(1).max(12),
  tests: z.array(z.object({
    name: z.string().min(1).max(180),
    testCode: z.string().min(1).max(80_000)
  }).strict()).max(80)
}).strict();

export const createWebDesignBankActivityVariation: BankActivityVariationHandler = async (input) => {
  const sourceConfig = parseWebDesignExerciseConfig(input.sourceActivity.config);
  const privateData = await listBankWebDesignExerciseTests({ bankActivityId: input.sourceActivity.id });
  const referenceFiles = privateData.referenceBundle?.files ?? sourceConfig.files;
  const sourcePaths = sourceConfig.files.map((file) => file.path);
  const referencePaths = referenceFiles.map((file) => file.path);
  if (referencePaths.length !== sourcePaths.length || referencePaths.some((path, index) => path !== sourcePaths[index])) {
    throw new AppError(
      409,
      "WEB_DESIGN_VARIATION_FILE_TOPOLOGY_INVALID",
      "The source activity's student and reference files must have matching paths before a variation can be generated."
    );
  }
  const sourceContext = buildSourceContext(sourceConfig, referenceFiles, privateData.tests);

  await input.reportProgress({ fraction: 0.15, step: "content" });
  let userPrompt = buildInitialPrompt(input.instructions, sourceContext);
  let lastIssues: string[] = [];
  let generated: z.infer<typeof generatedVariationSchema> | null = null;

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const raw = await generateQuestionAuthoringText(input.user, {
      systemPrompt: buildSystemPrompt(input),
      userPrompt,
      maxOutputTokens: 24_000
    });
    const parsed = generatedVariationSchema.safeParse(parseJson(raw));
    if (parsed.success) {
      const issues = validateCandidate(parsed.data, sourceConfig, referenceFiles, privateData.tests);
      if (!issues.length) {
        generated = parsed.data;
        break;
      }
      lastIssues = issues;
    } else {
      lastIssues = parsed.error.issues.map((issue) => `${issue.path.join(".") || "payload"}: ${issue.message}`);
    }
    userPrompt = [
      "The previous variation was invalid. Return a complete corrected JSON payload only.",
      "Validation issues:",
      ...lastIssues.map((issue) => `- ${issue}`),
      "",
      "Optional teacher instructions:",
      input.instructions || "None.",
      "",
      "Original activity context:",
      sourceContext
    ].join("\n");
  }
  if (!generated) {
    throw new AppError(422, "WEB_DESIGN_VARIATION_INVALID", "The AI agent could not generate a valid web design activity variation.", { issues: lastIssues });
  }

  const generatedByPath = new Map(generated.files.map((file) => [file.path, file]));
  const studentFiles = sourceConfig.files.map((file) => ({
    ...file,
    starterCode: generatedByPath.get(file.path)!.starterCode
  }));
  const generatedReferenceFiles: WebDesignExerciseFile[] = referenceFiles.map((file) => ({
    ...file,
    starterCode: generatedByPath.get(file.path)!.referenceCode
  }));
  const tests = privateData.tests.map((test, index) => ({
    id: test.id,
    name: generated!.tests[index].name,
    kind: test.kind,
    testCode: generated!.tests[index].testCode,
    isEnabled: test.isEnabled,
    weight: test.weight,
    metadata: test.metadata
  }));
  const nextConfig = { ...sourceConfig, prompt: generated.prompt, files: studentFiles };

  await input.reportProgress({ fraction: 0.7, step: "validating" });
  await updateBankActivity(input.user, input.activity.id, { config: nextConfig, lifecycle: "draft" });
  await replaceBankWebDesignExerciseTests({
    activityBankId: input.activityBankId,
    bankActivityId: input.activity.id,
    activityConfig: nextConfig,
    user: input.user,
    input: { referenceFiles: generatedReferenceFiles, tests }
  });
  await input.reportProgress({ fraction: 0.98, step: "saving" });
};

function buildSystemPrompt(input: Parameters<BankActivityVariationHandler>[0]) {
  return [
    "You create complete variations of Cognelo web-design coding exercises.",
    "Return valid JSON only. Do not use Markdown fences or add commentary.",
    "Required shape: {\"prompt\":\"...\",\"files\":[{\"path\":\"index.html\",\"starterCode\":\"...\",\"referenceCode\":\"...\"}],\"tests\":[{\"name\":\"...\",\"testCode\":\"...\"}]}",
    "Preserve the exact file paths and exact number and order of tests from the original.",
    "Preserve the same knowledge concepts, technologies, difficulty, cognitive demand, and approximate amount of work.",
    "Make the solution meaningfully different in structure, styling, behavior, or implementation—not merely a renamed or rethemed copy.",
    "starterCode is the incomplete student starting point; referenceCode is the complete private solution for the same file.",
    "Each Playwright test receives a page object and must pass against the generated reference files.",
    `Write all learner-facing text and test names in ${localeName(input.locale)}.`,
    "",
    "Subject context:",
    `Title: ${input.subject.title}`,
    `Description: ${input.subject.description || "None."}`,
    "",
    activityKnowledgeGenerationPrompt(input.knowledge)
  ].join("\n");
}

function buildInitialPrompt(instructions: string, sourceContext: string) {
  return [
    "Generate a genuine variation of this activity.",
    "The new prompt, student files, reference files, and every test must agree with one another.",
    "Do not refer to the original activity.",
    "",
    "Optional teacher instructions:",
    instructions || "None.",
    "",
    "Original activity context:",
    sourceContext
  ].join("\n");
}

function buildSourceContext(
  config: ReturnType<typeof parseWebDesignExerciseConfig>,
  referenceFiles: WebDesignExerciseFile[],
  tests: Awaited<ReturnType<typeof listBankWebDesignExerciseTests>>["tests"]
) {
  const payload = {
    prompt: config.prompt,
    files: config.files.map((file) => ({ path: file.path, starterCode: file.starterCode.slice(0, 16_000) })),
    referenceFiles: referenceFiles.map((file) => ({ path: file.path, referenceCode: file.starterCode.slice(0, 20_000) })),
    tests: tests.map((test) => ({ name: test.name, kind: test.kind, testCode: test.testCode.slice(0, 10_000) }))
  };
  return JSON.stringify(payload).slice(0, 180_000);
}

function validateCandidate(
  candidate: z.infer<typeof generatedVariationSchema>,
  sourceConfig: ReturnType<typeof parseWebDesignExerciseConfig>,
  referenceFiles: WebDesignExerciseFile[],
  tests: Awaited<ReturnType<typeof listBankWebDesignExerciseTests>>["tests"]
) {
  const issues: string[] = [];
  const sourcePaths = sourceConfig.files.map((file) => file.path);
  const generatedPaths = candidate.files.map((file) => file.path);
  if (generatedPaths.length !== sourcePaths.length || generatedPaths.some((path, index) => path !== sourcePaths[index])) {
    issues.push(`files must preserve these exact paths and order: ${sourcePaths.join(", ")}.`);
  }
  if (candidate.tests.length !== tests.length) {
    issues.push(`tests must contain exactly ${tests.length} entries; received ${candidate.tests.length}.`);
  }
  if (candidate.prompt.trim() === sourceConfig.prompt.trim()) {
    issues.push("prompt must differ from the original.");
  }
  if (sourceConfig.prompt.includes(webDesignExpectedResultCroppedToken) && !candidate.prompt.includes(webDesignExpectedResultCroppedToken)) {
    issues.push(`prompt must preserve ${webDesignExpectedResultCroppedToken}.`);
  } else if (sourceConfig.prompt.includes(webDesignExpectedResultToken) && !candidate.prompt.includes(webDesignExpectedResultToken)) {
    issues.push(`prompt must preserve ${webDesignExpectedResultToken}.`);
  }
  if (candidate.files.every((file, index) => file.starterCode.trim() === sourceConfig.files[index]?.starterCode.trim())) {
    issues.push("student starting files must be meaningfully different from the original.");
  }
  const referenceByPath = new Map(referenceFiles.map((file) => [file.path, file.starterCode.trim()]));
  if (candidate.files.every((file) => file.referenceCode.trim() === referenceByPath.get(file.path))) {
    issues.push("reference solution files must be meaningfully different from the original.");
  }
  if (tests.length > 0 && candidate.tests.every((test, index) =>
    test.name.trim() === tests[index]?.name.trim() && test.testCode.trim() === tests[index]?.testCode.trim()
  )) {
    issues.push("tests must be meaningfully different from the original.");
  }
  return issues;
}

function parseJson(value: string) {
  try {
    return JSON.parse(value.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, ""));
  } catch {
    return null;
  }
}

function localeName(locale: "en" | "fr" | "zh" | "ar") {
  return locale === "fr" ? "French" : locale === "zh" ? "Chinese" : locale === "ar" ? "Arabic" : "English";
}
