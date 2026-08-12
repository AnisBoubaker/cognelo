import { z } from "zod";
import { activityGenerationKnowledgeSchema, activityKnowledgeGenerationPrompt, AppError, generateQuestionAuthoringText, suggestActivityKnowledgeSelections, type ActivityGenerationKnowledge } from "@cognelo/core";
import {
  codingExerciseHiddenTestSchema,
  codingExerciseTestInsertionToken,
  codingExerciseTemplateInsertionToken,
  parseCodingExercisePrivateConfig,
  sampleTestSchema
} from "./coding-exercises";
import { validateReferenceSolutionAgainstHiddenTests } from "./executions";

type SubjectContext = {
  title: string;
  description: string;
};

type GenerationLocale = "en" | "fr" | "zh" | "ar";

export const codingExercisePromptGenerationInputSchema = z.object({
  description: z.string().min(10).max(4000),
  language: z.string().min(1).max(40),
  locale: z.enum(["en", "fr", "zh", "ar"]).default("en"),
  knowledge: activityGenerationKnowledgeSchema.default({ mode: "ignore" })
});

export const codingExerciseSolutionGenerationInputSchema = z.object({
  description: z.string().max(4000).default(""),
  prompt: z.string().min(10).max(12000),
  language: z.string().min(1).max(40),
  locale: z.enum(["en", "fr", "zh", "ar"]).default("en"),
  knowledge: activityGenerationKnowledgeSchema.default({ mode: "ignore" })
});

export const codingExerciseTestsGenerationInputSchema = z.object({
  description: z.string().max(4000).default(""),
  prompt: z.string().min(10).max(12000),
  language: z.string().min(1).max(40),
  locale: z.enum(["en", "fr", "zh", "ar"]).default("en"),
  referenceSolution: z.string().min(1).max(60000),
  templateSource: z.string().min(1).max(120000),
  templateVisibleLineNumbers: z.array(z.number().int().min(0).max(5000)).max(5000).default([]),
  knowledge: activityGenerationKnowledgeSchema.default({ mode: "ignore" })
});

const generatedImpossibleSchema = z.object({
  status: z.literal("error"),
  message: z.string().min(10).max(1200)
});

const generatedSolutionSchema = z
  .object({
    status: z.enum(["ok", "warning"]).optional().default("ok"),
    warningMessage: z.string().max(1200).optional().default(""),
    referenceSolution: z.string().min(1).max(60000),
    templateSource: z.string().min(1).max(120000),
    templateVisibleLineNumbers: z.array(z.number().int().min(0).max(5000)).max(5000).default([])
  })
  .superRefine((solution, context) => {
    if (solution.status === "warning" && solution.warningMessage.trim().length < 10) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["warningMessage"],
        message: "warningMessage is required when status is warning."
      });
    }
  });

const generatedTestsSchema = z
  .object({
    status: z.enum(["ok", "warning"]).optional().default("ok"),
    warningMessage: z.string().max(1200).optional().default(""),
    sampleTests: z.array(sampleTestSchema).min(1).max(10),
    hiddenTests: z.array(codingExerciseHiddenTestSchema).min(1).max(15)
  })
  .superRefine((tests, context) => {
    if (tests.status === "warning" && tests.warningMessage.trim().length < 10) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["warningMessage"],
        message: "warningMessage is required when status is warning."
      });
    }
  });

export async function generateCodingExercisePrompt(input: {
  user: Parameters<typeof generateQuestionAuthoringText>[0];
  description: string;
  language: string;
  locale: GenerationLocale;
  subject: SubjectContext;
  knowledge?: ActivityGenerationKnowledge;
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
      const knowledgeConceptSelections = await suggestActivityKnowledgeSelections({ user: input.user, knowledge: input.knowledge ?? { mode: "ignore", concepts: [] }, generatedActivity: prompt });
      return { prompt, attempts: attempt, knowledgeConceptSelections };
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

export async function generateCodingExerciseSolution(input: {
  user: Parameters<typeof generateQuestionAuthoringText>[0];
  description: string;
  prompt: string;
  language: string;
  locale: GenerationLocale;
  subject: SubjectContext;
  knowledge?: ActivityGenerationKnowledge;
}) {
  const systemPrompt = buildSolutionGenerationSystemPrompt(input);
  let userPrompt = buildSolutionInitialPrompt(input);
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
      userPrompt = buildCorrectionPrompt("JSON payload", raw, lastIssues);
      continue;
    }

    const impossible = generatedImpossibleSchema.safeParse(parsed.value);
    if (impossible.success) {
      if (isMissingProvidedContextError(impossible.data.message)) {
        lastPayload = parsed.value;
        lastIssues = [
          "The request already includes the student-facing prompt, reference solution, and template. Generate tests from the provided context instead of returning a missing-context error."
        ];
        userPrompt = buildCorrectionPrompt("JSON payload", JSON.stringify(parsed.value, null, 2), lastIssues);
        continue;
      }
      return {
        status: "error" as const,
        message: impossible.data.message,
        attempts: attempt
      };
    }

    const validation = validateGeneratedSolution({
      payload: parsed.value,
      language: input.language
    });

    if (!validation.issues.length && validation.solution) {
      const knowledgeConceptSelections = await suggestActivityKnowledgeSelections({
        user: input.user,
        knowledge: input.knowledge ?? { mode: "ignore", concepts: [] },
        generatedActivity: `${input.prompt}\n\n${validation.solution.referenceSolution}`
      });
      return {
        ...validation.solution,
        starterCode: "",
        attempts: attempt,
        knowledgeConceptSelections
      };
    }

    lastPayload = parsed.value;
    lastIssues = validation.issues;
    userPrompt = buildTestCorrectionPrompt(JSON.stringify(parsed.value, null, 2), validation.issues);
  }

  throw new AppError(422, "CODING_EXERCISE_SOLUTION_GENERATION_INVALID", "The AI agent could not generate a valid coding exercise solution.", {
    issues: lastIssues,
    payload: lastPayload
  });
}

export async function generateCodingExerciseTests(input: {
  user: Parameters<typeof generateQuestionAuthoringText>[0];
  description: string;
  prompt: string;
  language: string;
  locale: GenerationLocale;
  subject: SubjectContext;
  referenceSolution: string;
  templateSource: string;
  templateVisibleLineNumbers: number[];
  knowledge?: ActivityGenerationKnowledge;
}) {
  const systemPrompt = buildTestsGenerationSystemPrompt(input);
  let userPrompt = buildTestsInitialPrompt(input);
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

    const impossible = generatedImpossibleSchema.safeParse(parsed.value);
    if (impossible.success) {
      return {
        status: "error" as const,
        message: impossible.data.message,
        attempts: attempt
      };
    }

    const validation = await validateGeneratedTests({
      payload: parsed.value,
      prompt: input.prompt,
      language: input.language,
      referenceSolution: input.referenceSolution,
      templateSource: input.templateSource,
      templateVisibleLineNumbers: input.templateVisibleLineNumbers
    });
    if (validation.fatalError) {
      throw new AppError(validation.fatalError.status, validation.fatalError.code, validation.fatalError.message, {
        issues: validation.issues
      });
    }

    if (!validation.issues.length && validation.tests && validation.validationSummary) {
      const knowledgeConceptSelections = await suggestActivityKnowledgeSelections({
        user: input.user,
        knowledge: input.knowledge ?? { mode: "ignore", concepts: [] },
        generatedActivity: `${input.prompt}\n\n${input.referenceSolution}\n\n${JSON.stringify(validation.tests)}`
      });
      return {
        ...validation.tests,
        validationSummary: validation.validationSummary,
        attempts: attempt,
        knowledgeConceptSelections
      };
    }

    lastPayload = parsed.value;
    lastIssues = validation.issues;
    userPrompt = buildCorrectionPrompt("JSON payload", JSON.stringify(parsed.value, null, 2), validation.issues);
  }

  throw new AppError(422, "CODING_EXERCISE_TEST_GENERATION_INVALID", "The AI agent could not generate valid coding exercise tests.", {
    issues: lastIssues,
    payload: lastPayload
  });
}

function buildPromptGenerationSystemPrompt(input: { language: string; locale: GenerationLocale; subject: SubjectContext; knowledge?: ActivityGenerationKnowledge }) {
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
    `Description: ${input.subject.description || "No subject description provided."}`,
    "",
    activityKnowledgeGenerationPrompt(input.knowledge ?? { mode: "ignore", concepts: [] })
  ].join("\n");
}

function buildSolutionGenerationSystemPrompt(input: { language: string; locale: GenerationLocale; subject: SubjectContext; knowledge?: ActivityGenerationKnowledge }) {
  return [
    "You generate teacher-reviewable reference solutions for Cognelo coding exercises.",
    "Return only valid JSON. Do not wrap the JSON in Markdown fences. Do not add explanations.",
    "",
    "Required JSON shape when generation is possible:",
    "{",
    '  "status": "ok",',
    '  "referenceSolution": "complete teacher-only solution code",',
    `  "templateSource": "${codingExerciseTemplateInsertionToken} or ${codingExerciseTemplateInsertionToken}\\n\\n${codingExerciseTestInsertionToken}",`,
    '  "templateVisibleLineNumbers": []',
    "}",
    "",
    "If the solution can be generated but requires assumptions, return the same shape with:",
    "{",
    '  "status": "warning",',
    '  "warningMessage": "localized explanation of the assumptions made",',
    '  "...": "all normal solution fields are still required"',
    "}",
    "",
    "If the exercise is totally impossible to solve, return this shape instead:",
    "{",
    '  "status": "error",',
    '  "message": "localized explanation shown to the teacher"',
    "}",
    "",
    "Rules:",
    `- Programming language: ${input.language}.`,
    "- The selected programming language is authoritative. Generate code for that language only.",
    "- Generate only the reference solution and execution template; do not generate starter code or tests.",
    "- The app will intentionally clear starterCode after solution generation so the teacher can decide what students should receive.",
    "- Choose exactly one execution pattern:",
    `  1. Full program: templateSource is exactly ${codingExerciseTemplateInsertionToken}. Use this when the student should write a complete executable program that reads input and prints output.`,
    `  2. Callable unit: templateSource is exactly ${codingExerciseTemplateInsertionToken}\\n\\n${codingExerciseTestInsertionToken}. Use this when the student should write a function, method, class, helper, or other code that tests need to call.`,
    "- Do not generate body-insertion templates. Do not indent the student insertion marker inside another function, class, method, main, or block.",
    "- referenceSolution must have the same shape as the expected student answer: a complete program for full-program exercises, or complete top-level declarations/functions/classes for callable-unit exercises.",
    "- templateVisibleLineNumbers should normally be an empty array for AI-generated solutions.",
    "- If the prompt is ambiguous but still permits a plausible solution, generate one with status warning and explain the assumption.",
    "- warningMessage and error message must be concise, actionable, and written in the current UI/content language.",
    "",
    `Current UI/content language: ${localeName(input.locale)}.`,
    "",
    "Subject context:",
    `Title: ${input.subject.title}`,
    `Description: ${input.subject.description || "No subject description provided."}`,
    "",
    activityKnowledgeGenerationPrompt(input.knowledge ?? { mode: "ignore", concepts: [] })
  ].join("\n");
}

function buildTestsGenerationSystemPrompt(input: { language: string; locale: GenerationLocale; subject: SubjectContext; knowledge?: ActivityGenerationKnowledge }) {
  return [
    "You generate visible and hidden test cases for Cognelo coding exercises.",
    "Return only valid JSON. Do not wrap the JSON in Markdown fences. Do not add explanations.",
    "",
    "Required JSON shape when generation is possible:",
    "{",
    '  "status": "ok",',
    '  "sampleTests": [{"id":"sample-1","title":"...","input":"...","output":"...","testCode":""}],',
    '  "hiddenTests": [{"id":"hidden-1","name":"...","stdin":"...","expectedOutput":"...","testCode":"","isEnabled":true,"weight":1}]',
    "}",
    "",
    "If tests can be generated but require assumptions, return the same shape with:",
    "{",
    '  "status": "warning",',
    '  "warningMessage": "localized explanation of the assumptions made",',
    '  "...": "all normal test fields are still required"',
    "}",
    "",
    "If useful tests are totally impossible to generate, return this shape instead:",
    "{",
    '  "status": "error",',
    '  "message": "localized explanation shown to the teacher"',
    "}",
    "",
    "Rules:",
    `- Programming language: ${input.language}.`,
    "- The selected programming language is authoritative. Generate test harness code for that language only.",
    "- Base tests on the student-facing prompt, the reviewed reference solution, and the provided template.",
    "- Generate exactly one visible sample test unless the exercise truly needs more.",
    "- Let the exercise scope decide the number of hidden tests, but never generate more than 15 hidden tests.",
    "- Generate enough hidden tests to cover normal cases, edge cases, and common mistakes.",
    "- IDs must be stable, lowercase, and unique.",
    "- The reference solution must pass every generated sample and hidden test.",
    "- Compute every expected output from the reference solution logic. Do not guess.",
    "- Choose only inputs for which the provided reference solution terminates successfully with exit code 0. Do not test invalid-input branches that intentionally return a non-zero exit code.",
    "- For floating-point comparisons, do not use mathematically exact threshold values unless you have accounted for the language's binary floating-point behavior. Prefer values safely inside or outside the threshold so the observed branch is unambiguous.",
    `- If the template contains ${codingExerciseTestInsertionToken}, every sample and hidden test must include non-empty testCode, and testCode must run the reference/student code and print the expected output.`,
    `- If the template does not contain ${codingExerciseTestInsertionToken}, every testCode field must be empty and tests must use stdin plus expected output only.`,
    "- For full-program tests, put input in input/stdin and expected printed output in output/expectedOutput.",
    "- For callable-unit tests, usually leave input/stdin empty and put setup, calls, assertions, and printed output in testCode.",
    "- Use assertions only when they do not hide the required expected output; the validation still compares stdout to output/expectedOutput.",
    "- warningMessage and error message must be concise, actionable, and written in the current UI/content language.",
    "",
    `Current UI/content language: ${localeName(input.locale)}.`,
    "Use that language for test names/titles.",
    "",
    "Subject context:",
    `Title: ${input.subject.title}`,
    `Description: ${input.subject.description || "No subject description provided."}`,
    "",
    activityKnowledgeGenerationPrompt(input.knowledge ?? { mode: "ignore", concepts: [] })
  ].join("\n");
}

function buildSolutionInitialPrompt(input: { description: string; prompt: string }) {
  return [
    "Generate a reference solution and execution template for this coding exercise.",
    "",
    "Activity description:",
    input.description.trim() || "No separate description provided.",
    "",
    "Student-facing prompt:",
    input.prompt.trim()
  ].join("\n");
}

function buildTestsInitialPrompt(input: { description: string; prompt: string; referenceSolution: string; templateSource: string }) {
  return [
    "Generate coding exercise tests from the complete context below.",
    "The student-facing prompt, reviewed reference solution, and template source are all provided. Do not return a missing-context error.",
    "",
    "Activity description:",
    "<activity_description>",
    input.description.trim() || "No separate description provided.",
    "</activity_description>",
    "",
    "Student-facing prompt:",
    "<student_prompt>",
    input.prompt.trim(),
    "</student_prompt>",
    "",
    "Reference solution:",
    "<reference_solution>",
    input.referenceSolution,
    "</reference_solution>",
    "",
    "Template source:",
    "<template_source>",
    input.templateSource,
    "</template_source>"
  ].join("\n");
}

function validateGeneratedSolution(input: { payload: unknown; language: string }) {
  const parsed = generatedSolutionSchema.safeParse(input.payload);
  if (!parsed.success) {
    return {
      issues: parsed.error.issues.map((issue) => `${issue.path.join(".") || "payload"}: ${issue.message}`)
    };
  }

  const solution = parsed.data;
  const issues: string[] = [];
  const languageIssues = collectGeneratedLanguageIssues(input.language, {
    starterCode: "",
    referenceSolution: solution.referenceSolution,
    templateSource: solution.templateSource
  });
  issues.push(...languageIssues);
  issues.push(...collectGeneratedTemplateShapeIssues(solution.templateSource));

  if (issues.length) {
    return { issues };
  }

  const privateConfig = parseCodingExercisePrivateConfig({
    templateSource: solution.templateSource,
    templateVisibleLineNumbers: solution.templateVisibleLineNumbers
  });

  return {
    solution: {
      ...solution,
      templateSource: privateConfig.templateSource,
      templateVisibleLineNumbers: privateConfig.templateVisibleLineNumbers
    },
    issues: []
  };
}

async function validateGeneratedTests(input: {
  payload: unknown;
  prompt: string;
  language: string;
  referenceSolution: string;
  templateSource: string;
  templateVisibleLineNumbers: number[];
}) {
  const parsed = generatedTestsSchema.safeParse(input.payload);
  if (!parsed.success) {
    return {
      issues: parsed.error.issues.map((issue) => `${issue.path.join(".") || "payload"}: ${issue.message}`)
    };
  }

  const tests = parsed.data;
  const issues: string[] = [];
  const allTestIds = [...tests.sampleTests.map((test) => test.id), ...tests.hiddenTests.map((test) => test.id)];
  const duplicateIds = allTestIds.filter((id, index) => allTestIds.indexOf(id) !== index);
  if (duplicateIds.length) {
    issues.push(`Test ids must be unique. Duplicates: ${[...new Set(duplicateIds)].join(", ")}.`);
  }
  issues.push(...collectGeneratedTemplateShapeIssues(input.templateSource));
  const templateUsesTestCode = input.templateSource.includes(codingExerciseTestInsertionToken);
  const allTests = [
    ...tests.sampleTests.map((test) => ({ name: test.title || test.id, testCode: test.testCode })),
    ...tests.hiddenTests.map((test) => ({ name: test.name || test.id, testCode: test.testCode }))
  ];
  const testsWithCode = allTests.filter((test) => test.testCode.trim().length > 0);
  const testsWithoutCode = allTests.filter((test) => test.testCode.trim().length === 0);
  if (templateUsesTestCode && testsWithoutCode.length) {
    issues.push(
      `When templateSource contains ${codingExerciseTestInsertionToken}, every sample and hidden test must include non-empty testCode. Missing: ${testsWithoutCode
        .map((test) => test.name)
        .join(", ")}.`
    );
  }
  if (!templateUsesTestCode && testsWithCode.length) {
    issues.push(
      `When templateSource does not contain ${codingExerciseTestInsertionToken}, generated tests must leave testCode empty. Present: ${testsWithCode
        .map((test) => test.name)
        .join(", ")}.`
    );
  }

  const privateConfig = parseCodingExercisePrivateConfig({
    templateSource: input.templateSource,
    templateVisibleLineNumbers: input.templateVisibleLineNumbers
  });

  if (issues.length) {
    return { issues };
  }

  const validationSummary = await validateReferenceSolutionAgainstHiddenTests({
    activityConfig: {
      prompt: input.prompt,
      language: input.language,
      executionMode: "template",
      starterCode: "",
      studentTemplateSource: privateConfig.templateSource,
      sampleTests: tests.sampleTests,
      maxEditorSeconds: 1800
    },
    sourceCode: input.referenceSolution,
    sampleTests: tests.sampleTests,
    hiddenTests: tests.hiddenTests.map((test, index) => ({
      ...test,
      orderIndex: index
    })),
    privateConfig
  });
  const fatalError = getFatalReferenceValidationError(validationSummary);
  if (fatalError) {
    return { issues: collectValidationIssues(validationSummary), fatalError };
  }

  if (!validationSummary.accepted) {
    const repairedTests = repairTestExpectedOutputsFromValidation(tests, validationSummary);
    if (repairedTests) {
      const repairedValidationSummary = await validateReferenceSolutionAgainstHiddenTests({
        activityConfig: {
          prompt: input.prompt,
          language: input.language,
          executionMode: "template",
          starterCode: "",
          studentTemplateSource: privateConfig.templateSource,
          sampleTests: repairedTests.sampleTests,
          maxEditorSeconds: 1800
        },
        sourceCode: input.referenceSolution,
        sampleTests: repairedTests.sampleTests,
        hiddenTests: repairedTests.hiddenTests.map((test, index) => ({
          ...test,
          orderIndex: index
        })),
        privateConfig
      });

      if (repairedValidationSummary.accepted) {
        return {
          tests: repairedTests,
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
    tests,
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

function getFatalReferenceValidationError(validationSummary: Record<string, unknown>) {
  const results = [
    ...getValidationTests(validationSummary.sampleTests),
    ...getValidationTests(validationSummary.hiddenTests)
  ];
  const failed = results.filter((test) => test.passed === false);
  if (!failed.length) return null;
  if (failed.every((test) => String(test.statusLabel ?? "").toLowerCase().includes("compilation error"))) {
    return {
      status: 422,
      code: "REFERENCE_SOLUTION_COMPILATION_FAILED",
      message: "Judge0 could not compile the reviewed reference solution. Test generation cannot correct a compiler or sandbox failure; verify the reference solution and Judge0 runtime."
    };
  }
  if (failed.every((test) => String(test.statusLabel ?? "").toLowerCase().includes("internal error"))) {
    return {
      status: 503,
      code: "JUDGE0_EXECUTION_UNAVAILABLE",
      message: "Judge0 could not execute the reference solution because its sandbox returned an internal error. Check the Judge0 server and worker logs."
    };
  }
  return null;
}

function repairTestExpectedOutputsFromValidation(
  tests: z.infer<typeof generatedTestsSchema>,
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

  const sampleTests = tests.sampleTests.map((test) => {
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
  const hiddenTests = tests.hiddenTests.map((test) => {
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
        ...tests,
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

function isMissingProvidedContextError(message: string) {
  const normalized = message
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

  return /missing|does not include|not include|need|needed|required|without|cannot|can't|unable/.test(normalized) &&
    /prompt|problem statement|reference solution|solution|template|context|expected output/.test(normalized);
}

function collectGeneratedTemplateShapeIssues(templateSource: string) {
  const normalized = templateSource.replace(/\r\n/g, "\n").trim();
  const fullProgramTemplate = codingExerciseTemplateInsertionToken;
  const callableUnitTemplate = `${codingExerciseTemplateInsertionToken}\n\n${codingExerciseTestInsertionToken}`;
  if (normalized !== fullProgramTemplate && normalized !== callableUnitTemplate) {
    return [
      `AI-generated templates must be exactly ${JSON.stringify(fullProgramTemplate)} for full-program exercises or ${JSON.stringify(
        callableUnitTemplate
      )} for callable-unit exercises.`
    ];
  }
  return [];
}

function collectGeneratedLanguageIssues(
  language: string,
  assets: { starterCode: string; referenceSolution: string; templateSource: string }
) {
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

function looksLikeC(source: string) {
  return /#include\s*<|int\s+main\s*\(|printf\s*\(|scanf\s*\(|\breturn\s+0\s*;/.test(source);
}

function looksLikePython(source: string) {
  return /^\s*def\s+\w+\s*\(|^\s*print\s*\(|^\s*if\s+__name__\s*==\s*["']__main__["']/m.test(source);
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

function buildTestCorrectionPrompt(previous: string, issues: string[]) {
  return [
    "The previous JSON payload failed execution validation. Return the full corrected JSON payload only.",
    "Replace or remove every failing test; do not merely repeat its mathematically expected result.",
    "Do not include inputs for which the reference solution exits with a non-zero status.",
    "Avoid floating-point values exactly on a comparison threshold when binary representation can change the branch.",
    "Expected output must match the reference solution's actual stdout byte for byte.",
    "",
    "Validation issues:",
    ...issues.map((issue) => `- ${issue}`),
    "",
    "Previous JSON payload:",
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
  if (locale === "ar") {
    return "Arabic";
  }
  return "English";
}
