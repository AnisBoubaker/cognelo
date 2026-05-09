import { z } from "zod";
import { AppError, generateQuestionAuthoringText } from "@cognelo/core";
import {
  codingExerciseHiddenTestSchema,
  codingExerciseTestInsertionToken,
  codingExerciseTemplateInsertionToken,
  codingExerciseTemplateRequiresTestCodeMarker,
  parseCodingExercisePrivateConfig,
  sampleTestSchema
} from "./coding-exercises";
import { validateReferenceSolutionAgainstHiddenTests } from "./executions";

type SubjectContext = {
  title: string;
  description: string;
};

type GenerationLocale = "en" | "fr" | "zh";

export const codingExercisePromptGenerationInputSchema = z.object({
  description: z.string().min(10).max(4000),
  language: z.string().min(1).max(40),
  locale: z.enum(["en", "fr", "zh"]).default("en")
});

export const codingExerciseAssetsGenerationInputSchema = z.object({
  description: z.string().max(4000).default(""),
  prompt: z.string().min(10).max(12000),
  language: z.string().min(1).max(40),
  locale: z.enum(["en", "fr", "zh"]).default("en")
});

const generatedAssetsSchema = z
  .object({
    status: z.enum(["ok", "warning"]).optional().default("ok"),
    warningMessage: z.string().max(1200).optional().default(""),
    starterCode: z.string().max(40000).default(""),
    referenceSolution: z.string().min(1).max(60000),
    templateSource: z.string().min(1).max(120000),
    templateVisibleLineNumbers: z.array(z.number().int().min(0).max(5000)).max(5000).default([]),
    sampleTests: z.array(sampleTestSchema).min(1).max(10),
    hiddenTests: z.array(codingExerciseHiddenTestSchema).min(5).max(50)
  })
  .superRefine((assets, context) => {
    if (assets.status === "warning" && assets.warningMessage.trim().length < 10) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["warningMessage"],
        message: "warningMessage is required when status is warning."
      });
    }
  });

const generatedAssetsImpossibleSchema = z.object({
  status: z.literal("error"),
  message: z.string().min(10).max(1200)
});

export async function generateCodingExercisePrompt(input: {
  user: Parameters<typeof generateQuestionAuthoringText>[0];
  description: string;
  language: string;
  locale: GenerationLocale;
  subject: SubjectContext;
}) {
  const systemPrompt = buildPromptGenerationSystemPrompt(input);
  let userPrompt = [
    "Generate only the student-facing coding exercise prompt.",
    "Teacher description:",
    input.description.trim()
  ].join("\n\n");
  let lastPrompt = "";
  let lastIssues: string[] = [];

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const raw = await generateQuestionAuthoringText(input.user, {
      systemPrompt,
      userPrompt,
      maxOutputTokens: 2500
    });
    const prompt = normalizeGeneratedText(raw);
    const issues = validateGeneratedPrompt(prompt);

    if (!issues.length) {
      return { prompt, attempts: attempt };
    }

    lastPrompt = prompt;
    lastIssues = issues;
    userPrompt = buildCorrectionPrompt("prompt", prompt, issues);
  }

  throw new AppError(422, "CODING_EXERCISE_PROMPT_GENERATION_INVALID", "The AI agent could not generate a valid coding exercise prompt.", {
    issues: lastIssues,
    prompt: lastPrompt
  });
}

export async function generateCodingExerciseAssets(input: {
  user: Parameters<typeof generateQuestionAuthoringText>[0];
  description: string;
  prompt: string;
  language: string;
  locale: GenerationLocale;
  subject: SubjectContext;
}) {
  const systemPrompt = buildAssetsGenerationSystemPrompt(input);
  let userPrompt = buildAssetsInitialPrompt(input);
  let lastPayload: unknown = null;
  let lastIssues: string[] = [];

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const raw = await generateQuestionAuthoringText(input.user, {
      systemPrompt,
      userPrompt,
      maxOutputTokens: 9000
    });
    const parsed = parseGeneratedJson(raw);
    if (!parsed.ok) {
      lastPayload = raw;
      lastIssues = [parsed.issue];
      userPrompt = buildCorrectionPrompt("JSON payload", raw, lastIssues);
      continue;
    }

    const impossible = generatedAssetsImpossibleSchema.safeParse(parsed.value);
    if (impossible.success) {
      return {
        status: "error" as const,
        message: impossible.data.message,
        attempts: attempt
      };
    }

    const validation = await validateGeneratedAssets({
      payload: parsed.value,
      prompt: input.prompt,
      language: input.language
    });

    if (!validation.issues.length && validation.assets && validation.validationSummary) {
      return {
        ...validation.assets,
        validationSummary: validation.validationSummary,
        attempts: attempt
      };
    }

    lastPayload = parsed.value;
    lastIssues = validation.issues;
    userPrompt = buildCorrectionPrompt("JSON payload", JSON.stringify(parsed.value, null, 2), validation.issues);
  }

  throw new AppError(422, "CODING_EXERCISE_ASSET_GENERATION_INVALID", "The AI agent could not generate valid coding exercise assets.", {
    issues: lastIssues,
    payload: lastPayload
  });
}

function buildPromptGenerationSystemPrompt(input: { language: string; locale: GenerationLocale; subject: SubjectContext }) {
  return [
    "You generate student-facing prompts for Cognelo coding exercises.",
    "Return only the prompt text. Do not return JSON, Markdown fences, starter code, solutions, or tests.",
    "The prompt must be clear enough for a student to implement the exercise.",
    "The prompt must be anchored in a concrete, realistic mini-scenario. Do not ask the student to invent the context or decide what the function is for.",
    "Prefer domain examples that make the function useful: inventory, grades, temperatures, bank/account values, coordinates, counters, reservations, sensor readings, or small business rules.",
    "Avoid purely meta phrasing such as 'write a function that illustrates concept X' as the main task. Teach the concept through the scenario instead.",
    "When the teacher gives a difficulty level, match the scope and constraints to that difficulty.",
    "Do not reveal the reference solution.",
    `Programming language: ${input.language}.`,
    "The selected programming language is authoritative. If the teacher description or subject context mentions another language, adapt the exercise to the selected programming language.",
    `Current UI/content language: ${localeName(input.locale)}.`,
    "Generate all student-facing text in that language.",
    "",
    "Subject context:",
    `Title: ${input.subject.title}`,
    `Description: ${input.subject.description || "No subject description provided."}`
  ].join("\n");
}

function buildAssetsGenerationSystemPrompt(input: { language: string; locale: GenerationLocale; subject: SubjectContext }) {
  return [
    "You generate structured assets for Cognelo coding exercises.",
    "Return only valid JSON. Do not wrap the JSON in Markdown fences. Do not add explanations.",
    "",
    "Required JSON shape:",
    "If the exercise is coherent and possible, return this shape:",
    "{",
    '  "status": "ok",',
    '  "starterCode": "student-visible starter code",',
    '  "referenceSolution": "complete teacher-only solution code",',
    '  "templateSource": "full execution scaffold containing {{ STUDENT_CODE }} and optionally {{ TEST_CODE }}",',
    '  "templateVisibleLineNumbers": [0, 1],',
    '  "sampleTests": [{"id":"sample-1","title":"...","input":"...","output":"...","testCode":""}],',
    '  "hiddenTests": [{"id":"hidden-1","name":"...","stdin":"...","expectedOutput":"...","testCode":"","isEnabled":true,"weight":1}]',
    "}",
    "",
    "If the exercise can be generated but requires assumptions, return the same assets shape with:",
    "{",
    '  "status": "warning",',
    '  "warningMessage": "localized explanation of the assumptions made",',
    '  "...": "all normal asset fields are still required"',
    "}",
    "",
    "If the exercise is totally impossible to generate, return this shape instead:",
    "{",
    '  "status": "error",',
    '  "message": "localized explanation shown to the teacher"',
    "}",
    "",
    "Rules:",
    `- Programming language: ${input.language}.`,
    "- The selected programming language is authoritative. Generate code, starter code, reference solution, templates, and tests for that language only.",
    "- If the teacher description or student prompt mentions another programming language, adapt the exercise to the selected programming language instead of following the conflicting language mention.",
    "- Respect the student-facing prompt as much as possible.",
    "- Use the error shape only when the prompt makes generation totally impossible, for example when core requirements are mutually contradictory and no reasonable assumptions could produce valid tests.",
    "- If the prompt is ambiguous but still permits a plausible generation, generate assets anyway with status warning and explain the assumptions in warningMessage.",
    "- If the prompt leaves some edge cases undefined but normal behavior is testable, generate assets with status warning, test the defined behavior, and explain which edge cases were not tested or how they were interpreted.",
    "- The error message must be concise, actionable, and written in the current UI/content language.",
    "- warningMessage must be concise, actionable, and written in the current UI/content language.",
    `- The templateSource must contain ${codingExerciseTemplateInsertionToken}.`,
    `- The templateSource must contain ${codingExerciseTemplateInsertionToken} exactly once.`,
    `- The templateSource may contain ${codingExerciseTestInsertionToken} at most once.`,
    `- Include ${codingExerciseTestInsertionToken} in templateSource if any sample or hidden test has testCode.`,
    `- If templateSource contains ${codingExerciseTestInsertionToken}, every sampleTests and hiddenTests entry must include non-empty testCode.`,
    "- When tests use testCode, the referenceSolution and starterCode must not define a main function unless every testCode is only statements injected inside that same main.",
    "- Generate exactly one visible sample test unless the exercise truly needs more.",
    "- Generate at least five enabled hidden tests.",
    "- Hidden tests should cover normal cases, edge cases, and common mistakes.",
    "- IDs must be stable, lowercase, and unique.",
    "- The reference solution must pass every generated sample and hidden test.",
    "- Compute every output from the referenceSolution logic. Do not guess expected outputs from the prompt examples.",
    "- If validation reports stdout that differs from expected output, correct the test output fields unless the referenceSolution is clearly wrong.",
    "- Prefer stdin/expectedOutput tests. Use testCode only when stdin/output is insufficient.",
    `- For C function exercises that need multiple hidden fixtures, prefer this robust pattern: templateSource is \`#include <stdio.h>\\n\\n${codingExerciseTemplateInsertionToken}\\n\\n${codingExerciseTestInsertionToken}\`; starterCode/referenceSolution define only the requested function(s), not main; every sample and hidden testCode provides its own int main(void) function and expectedOutput.`,
    "- For C function exercises using that robust pattern, leave input/stdin empty and put all test setup, calls, and printf checks inside testCode.",
    "- Do not wrap {{ STUDENT_CODE }} inside a C function body unless referenceSolution contains only the replacement body statements. The safer default is to inject complete student functions at top level.",
    "- Keep starterCode incomplete; it should help students start without solving the exercise.",
    "- templateVisibleLineNumbers are zero-based line indexes in templateSource that students may see as read-only scaffold lines.",
    "",
    `Current UI/content language: ${localeName(input.locale)}.`,
    "Use that language for test names/titles.",
    "",
    "Subject context:",
    `Title: ${input.subject.title}`,
    `Description: ${input.subject.description || "No subject description provided."}`
  ].join("\n");
}

function buildAssetsInitialPrompt(input: { description: string; prompt: string }) {
  return [
    "Generate coding exercise assets for this prompt.",
    "",
    "Activity description:",
    input.description.trim() || "No separate description provided.",
    "",
    "Student-facing prompt:",
    input.prompt.trim()
  ].join("\n");
}

async function validateGeneratedAssets(input: { payload: unknown; prompt: string; language: string }) {
  const parsed = generatedAssetsSchema.safeParse(input.payload);
  if (!parsed.success) {
    return {
      issues: parsed.error.issues.map((issue) => `${issue.path.join(".") || "payload"}: ${issue.message}`)
    };
  }

  const assets = parsed.data;
  const issues: string[] = [];
  const allTestIds = [...assets.sampleTests.map((test) => test.id), ...assets.hiddenTests.map((test) => test.id)];
  const duplicateIds = allTestIds.filter((id, index) => allTestIds.indexOf(id) !== index);
  const enabledHiddenCount = assets.hiddenTests.filter((test) => test.isEnabled).length;
  const languageIssues = collectGeneratedLanguageIssues(input.language, assets);
  const templateIssues = collectGeneratedTemplateIssues(input.language, assets);
  const privateConfig = parseCodingExercisePrivateConfig({
    templateSource: assets.templateSource,
    templateVisibleLineNumbers: assets.templateVisibleLineNumbers
  });

  if (duplicateIds.length) {
    issues.push(`Test ids must be unique. Duplicates: ${[...new Set(duplicateIds)].join(", ")}.`);
  }
  if (enabledHiddenCount < 5) {
    issues.push("At least five hidden tests must be enabled.");
  }
  issues.push(...languageIssues);
  issues.push(...templateIssues);
  if (!privateConfig.templateSource.includes(codingExerciseTemplateInsertionToken)) {
    issues.push(`templateSource must include ${codingExerciseTemplateInsertionToken}.`);
  }
  if (codingExerciseTemplateRequiresTestCodeMarker(privateConfig.templateSource, [...assets.sampleTests, ...assets.hiddenTests])) {
    issues.push("templateSource must include {{ TEST_CODE }} when any test includes testCode.");
  }

  if (issues.length) {
    return { issues };
  }

  const validationSummary = await validateReferenceSolutionAgainstHiddenTests({
    activityConfig: {
      prompt: input.prompt,
      language: input.language,
      executionMode: "template",
      starterCode: assets.starterCode,
      studentTemplateSource: assets.templateSource,
      sampleTests: assets.sampleTests,
      maxEditorSeconds: 1800
    },
    sourceCode: assets.referenceSolution,
    sampleTests: assets.sampleTests,
    hiddenTests: assets.hiddenTests.map((test, index) => ({
      ...test,
      orderIndex: index
    })),
    privateConfig
  });

  if (!validationSummary.accepted) {
    const repairedAssets = repairExpectedOutputsFromValidation(assets, validationSummary);
    if (repairedAssets) {
      const repairedValidationSummary = await validateReferenceSolutionAgainstHiddenTests({
        activityConfig: {
          prompt: input.prompt,
          language: input.language,
          executionMode: "template",
          starterCode: repairedAssets.starterCode,
          studentTemplateSource: repairedAssets.templateSource,
          sampleTests: repairedAssets.sampleTests,
          maxEditorSeconds: 1800
        },
        sourceCode: repairedAssets.referenceSolution,
        sampleTests: repairedAssets.sampleTests,
        hiddenTests: repairedAssets.hiddenTests.map((test, index) => ({
          ...test,
          orderIndex: index
        })),
        privateConfig
      });

      if (repairedValidationSummary.accepted) {
        return {
          assets: {
            ...repairedAssets,
            templateSource: privateConfig.templateSource,
            templateVisibleLineNumbers: privateConfig.templateVisibleLineNumbers
          },
          validationSummary: repairedValidationSummary,
          issues: []
        };
      }
    }
  }

  if (!validationSummary.accepted) {
    return {
      issues: collectValidationIssues(validationSummary)
    };
  }

  return {
    assets: {
      ...assets,
      templateSource: privateConfig.templateSource,
      templateVisibleLineNumbers: privateConfig.templateVisibleLineNumbers
    },
    validationSummary,
    issues: []
  };
}

function validateGeneratedPrompt(prompt: string) {
  const issues: string[] = [];
  if (prompt.trim().length < 10) {
    issues.push("Prompt must contain at least 10 characters.");
  }
  if (isGenericConceptPrompt(prompt)) {
    issues.push("Prompt is too generic or concept-only. Rewrite it around a concrete mini-scenario with a specific use case.");
  }
  return issues;
}

function isGenericConceptPrompt(prompt: string) {
  const normalized = normalizeForHeuristics(prompt);

  return [
    /illustre[rz]?\s+(le\s+)?/,
    /montrer\s+que\s+la\s+fonction/,
    /objectif\s*:\s*montrer/,
    /votre\s+tache\s*:\s*1\./,
    /fonction\s+qui\s+(illustre|montre|porte\s+sur)/,
    /permet\s+d['’]illustrer/
  ].some((pattern) => pattern.test(normalized));
}

function normalizeForHeuristics(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

function collectValidationIssues(validationSummary: Record<string, unknown>) {
  const issues = ["The reference solution did not pass all generated tests."];
  for (const groupName of ["sampleTests", "hiddenTests"]) {
    const tests = getValidationTests(validationSummary[groupName]);
    for (const test of tests) {
      if (test.passed === false) {
        const details = [
          test.statusLabel ? `status=${String(test.statusLabel)}` : "",
          test.message ? `message=${String(test.message)}` : "",
          test.stderr ? `stderr=${String(test.stderr)}` : "",
          test.compileOutput ? `compileOutput=${String(test.compileOutput)}` : "",
          test.expectedOutput ? `expectedOutput=${JSON.stringify(String(test.expectedOutput))}` : "",
          test.stdout ? `stdout=${JSON.stringify(String(test.stdout))}` : ""
        ].filter(Boolean);
        issues.push(`${String(test.name ?? test.id ?? "test")} failed: ${details.join("; ") || "No details."}`);
      }
    }
  }
  return issues;
}

function repairExpectedOutputsFromValidation(
  assets: z.infer<typeof generatedAssetsSchema>,
  validationSummary: Record<string, unknown>
) {
  const sampleResults = getValidationTests(validationSummary.sampleTests);
  const hiddenResults = getValidationTests(validationSummary.hiddenTests);
  const failedResults = [...sampleResults, ...hiddenResults].filter((test) => test.passed === false);

  if (!failedResults.length || failedResults.some((test) => !isWrongAnswerWithStdout(test))) {
    return null;
  }

  let changed = false;
  const sampleStdoutById = new Map(
    sampleResults
      .filter(isWrongAnswerWithStdout)
      .map((test) => [String(test.id), String(test.stdout)] as const)
  );
  const hiddenStdoutById = new Map(
    hiddenResults
      .filter(isWrongAnswerWithStdout)
      .map((test) => [String(test.id), String(test.stdout)] as const)
  );

  const sampleTests = assets.sampleTests.map((test) => {
    const stdout = sampleStdoutById.get(test.id);
    if (stdout === undefined || test.output === stdout) {
      return test;
    }
    changed = true;
    return {
      ...test,
      output: stdout
    };
  });
  const hiddenTests = assets.hiddenTests.map((test) => {
    const stdout = hiddenStdoutById.get(test.id);
    if (stdout === undefined || test.expectedOutput === stdout) {
      return test;
    }
    changed = true;
    return {
      ...test,
      expectedOutput: stdout
    };
  });

  return changed
    ? {
        ...assets,
        sampleTests,
        hiddenTests
      }
    : null;
}

function getValidationTests(group: unknown) {
  return group && typeof group === "object" && !Array.isArray(group) && Array.isArray((group as { tests?: unknown[] }).tests)
    ? (group as { tests: Array<Record<string, unknown>> }).tests
    : [];
}

function isWrongAnswerWithStdout(test: Record<string, unknown>) {
  const statusId = typeof test.statusId === "number" ? test.statusId : null;
  const statusLabel = typeof test.statusLabel === "string" ? test.statusLabel : "";
  return (statusId === 4 || /wrong answer/i.test(statusLabel)) && typeof test.stdout === "string";
}

function collectGeneratedLanguageIssues(language: string, assets: z.infer<typeof generatedAssetsSchema>) {
  const normalized = language.trim().toLowerCase();
  const source = [assets.starterCode, assets.referenceSolution, assets.templateSource].join("\n\n");
  const issues: string[] = [];

  if (!["c", "cpp"].includes(normalized) && looksLikeC(source)) {
    issues.push(`Generated code appears to be C/C++, but the selected programming language is ${language}. Generate ${language} code only.`);
  }

  if (["c", "cpp"].includes(normalized) && looksLikePython(source)) {
    issues.push(`Generated code appears to be Python, but the selected programming language is ${language}. Generate ${language} code only.`);
  }

  return issues;
}

function collectGeneratedTemplateIssues(language: string, assets: z.infer<typeof generatedAssetsSchema>) {
  const issues: string[] = [];
  const studentTokenCount = countOccurrences(assets.templateSource, codingExerciseTemplateInsertionToken);
  const testTokenCount = countOccurrences(assets.templateSource, codingExerciseTestInsertionToken);
  const tests = [
    ...assets.sampleTests.map((test) => ({ id: test.id, name: test.title || test.id, testCode: test.testCode })),
    ...assets.hiddenTests.map((test) => ({ id: test.id, name: test.name || test.id, testCode: test.testCode }))
  ];
  const testsWithTestCode = tests.filter((test) => test.testCode.trim().length > 0);
  const testsWithoutTestCode = tests.filter((test) => test.testCode.trim().length === 0);
  const templateUsesTestCode = assets.templateSource.includes(codingExerciseTestInsertionToken);
  const normalizedLanguage = language.trim().toLowerCase();

  if (studentTokenCount !== 1) {
    issues.push(`templateSource must contain ${codingExerciseTemplateInsertionToken} exactly once; found ${studentTokenCount}.`);
  }

  if (testTokenCount > 1) {
    issues.push(`templateSource may contain ${codingExerciseTestInsertionToken} at most once; found ${testTokenCount}.`);
  }

  if (templateUsesTestCode && testsWithoutTestCode.length) {
    issues.push(
      `When templateSource contains ${codingExerciseTestInsertionToken}, every sample and hidden test must include non-empty testCode. Missing: ${testsWithoutTestCode
        .map((test) => test.name)
        .join(", ")}.`
    );
  }

  if (["c", "cpp"].includes(normalizedLanguage)) {
    const templateDefinesMain = definesCMain(assets.templateSource);
    const referenceDefinesMain = definesCMain(assets.referenceSolution);
    const testsWithMain = testsWithTestCode.filter((test) => definesCMain(test.testCode));

    if (templateDefinesMain && referenceDefinesMain) {
      issues.push("For C/C++, templateSource and referenceSolution must not both define main because referenceSolution is injected into templateSource.");
    }

    if (testsWithMain.length && templateDefinesMain) {
      issues.push("For C/C++ tests whose testCode defines main, templateSource must not also define main.");
    }

    if (testsWithMain.length && referenceDefinesMain) {
      issues.push("For C/C++ tests whose testCode defines main, referenceSolution must define only the tested function(s), not main.");
    }

    if (templateUsesTestCode) {
      const testsWithoutMain = tests.filter((test) => !definesCMain(test.testCode));
      if (testsWithoutMain.length) {
        issues.push(
          `For C/C++ templates that contain ${codingExerciseTestInsertionToken}, every sample and hidden testCode must define its own int main(void). Missing main: ${testsWithoutMain
            .map((test) => test.name)
            .join(", ")}.`
        );
      }
    }

    if (!templateDefinesMain && !referenceDefinesMain && !testsWithMain.length) {
      issues.push(
        "For C/C++, the generated program must define exactly one main function after insertion. Provide main in referenceSolution, templateSource, or preferably in each testCode when testing standalone functions."
      );
    }
  }

  return issues;
}

function countOccurrences(source: string, needle: string) {
  if (!needle) {
    return 0;
  }
  return source.split(needle).length - 1;
}

function looksLikeC(source: string) {
  return /#include\s*<|int\s+main\s*\(|printf\s*\(|scanf\s*\(|\breturn\s+0\s*;/.test(source);
}

function looksLikePython(source: string) {
  return /^\s*def\s+\w+\s*\(|^\s*print\s*\(|^\s*if\s+__name__\s*==\s*["']__main__["']/m.test(source);
}

function definesCMain(source: string) {
  return /\b(?:int|void)\s+main\s*\(/.test(source);
}

function buildCorrectionPrompt(label: string, previous: string, issues: string[]) {
  return [
    `The previous ${label} was invalid. Return the full corrected ${label} only.`,
    "",
    "Validation issues:",
    ...issues.map((issue) => `- ${issue}`),
    "",
    `Previous ${label}:`,
    previous
  ].join("\n");
}

function normalizeGeneratedText(value: string) {
  const trimmed = value.trim();
  const fenceMatch = trimmed.match(/^```(?:markdown|md|text)?\s*\n([\s\S]*?)\n```$/i);
  return (fenceMatch?.[1] ?? trimmed).trim();
}

function parseGeneratedJson(value: string): { ok: true; value: unknown } | { ok: false; issue: string } {
  const trimmed = value.trim();
  const fenceMatch = trimmed.match(/^```(?:json)?\s*\n([\s\S]*?)\n```$/i);
  const source = fenceMatch?.[1] ?? trimmed;
  try {
    return { ok: true, value: JSON.parse(source) };
  } catch {
    return { ok: false, issue: "The response must be valid JSON only." };
  }
}

function localeName(locale: GenerationLocale) {
  if (locale === "fr") {
    return "French";
  }
  if (locale === "zh") {
    return "Chinese";
  }
  return "English";
}
