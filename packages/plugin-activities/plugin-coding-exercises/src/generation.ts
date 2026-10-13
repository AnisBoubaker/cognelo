import { z } from "zod";
import { activityGenerationKnowledgeSchema, activityKnowledgeGenerationPrompt, AppError, generateQuestionAuthoringText, suggestActivityKnowledgeSelections, type ActivityGenerationKnowledge } from "@cognelo/core";
import {
  createCodingExerciseAiRubricCriterionId,
  codingExerciseDefaultHiddenTestCount,
  codingExerciseDefaultVisibleTestCount,
  codingExerciseHiddenTestSchema,
  codingExerciseMaxGeneratedTestCount,
  codingExerciseTestInsertionToken,
  codingExerciseTemplateInsertionToken,
  parseCodingExercisePrivateConfig,
  sampleTestSchema
} from "./coding-exercises";
import { validateReferenceSolutionAgainstHiddenTests } from "./executions";
import { validateCodingExerciseOutputMatcher } from "./output-matcher";

type SubjectContext = {
  title: string;
  description: string;
};

type GenerationLocale = "en" | "fr" | "zh" | "ar";

export const codingExercisePromptGenerationInputSchema = z.object({
  description: z.string().min(10).max(4000),
  language: z.string().min(1).max(80),
  locale: z.enum(["en", "fr", "zh", "ar"]).default("en"),
  knowledge: activityGenerationKnowledgeSchema.default({ mode: "ignore" })
});

export const codingExerciseSolutionGenerationInputSchema = z.object({
  description: z.string().max(4000).default(""),
  prompt: z.string().min(10).max(12000),
  language: z.string().min(1).max(80),
  locale: z.enum(["en", "fr", "zh", "ar"]).default("en"),
  knowledge: activityGenerationKnowledgeSchema.default({ mode: "ignore" })
});

export const codingExerciseTestsGenerationInputSchema = z.object({
  description: z.string().max(4000).default(""),
  prompt: z.string().min(10).max(12000),
  language: z.string().min(1).max(80),
  locale: z.enum(["en", "fr", "zh", "ar"]).default("en"),
  referenceSolution: z.string().min(1).max(60000),
  templateSource: z.string().min(1).max(120000),
  templateVisibleLineNumbers: z.array(z.number().int().min(0).max(5000)).max(5000).default([]),
  visibleTestCount: z.number().int().min(1).max(codingExerciseMaxGeneratedTestCount).default(codingExerciseDefaultVisibleTestCount),
  hiddenTestCount: z.number().int().min(1).max(codingExerciseMaxGeneratedTestCount).default(codingExerciseDefaultHiddenTestCount),
  knowledge: activityGenerationKnowledgeSchema.default({ mode: "ignore" })
});

export const codingExerciseRubricGenerationInputSchema = z.object({
  title: z.string().trim().min(1).max(300),
  description: z.string().max(4000).default(""),
  prompt: z.string().min(10).max(12000),
  referenceSolution: z.string().trim().min(1).max(60000),
  language: z.string().min(1).max(80),
  locale: z.enum(["en", "fr", "zh", "ar"]).default("en"),
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

const maxGeneratedTestNameLength = 50;
const generatedSampleTestSchema = sampleTestSchema.extend({
  title: z.string().trim().min(1).max(maxGeneratedTestNameLength)
});
const generatedHiddenTestSchema = codingExerciseHiddenTestSchema.extend({
  name: z.string().trim().min(1).max(maxGeneratedTestNameLength)
});

const generatedTestsSchema = z
  .object({
    status: z.enum(["ok", "warning"]).optional().default("ok"),
    warningMessage: z.string().max(1200).optional().default(""),
    sampleTests: z.array(generatedSampleTestSchema).max(codingExerciseMaxGeneratedTestCount),
    hiddenTests: z.array(generatedHiddenTestSchema).max(codingExerciseMaxGeneratedTestCount)
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

const generatedTestsEnvelopeSchema = generatedTestsSchema.innerType().extend({
  sampleTests: z.array(z.unknown()).max(codingExerciseMaxGeneratedTestCount),
  hiddenTests: z.array(z.unknown()).max(codingExerciseMaxGeneratedTestCount)
});
type GeneratedTests = z.infer<typeof generatedTestsSchema>;
type ValidatedGeneratedTests = {
  tests: GeneratedTests;
  validationSummary: Record<string, unknown>;
};

const generatedRubricSchema = z.object({
  criteria: z.array(z.object({
    title: z.string().trim().min(1).max(160),
    description: z.string().trim().min(1).max(2000),
    weightPercent: z.number().int().min(1).max(100)
  }).strict()).min(1).max(10)
}).strict().superRefine((rubric, context) => {
  if (rubric.criteria.reduce((total, criterion) => total + criterion.weightPercent, 0) !== 100) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["criteria"],
      message: "Rubric criterion weights must total 100%."
    });
  }
});

const generatedVariationMetadataSchema = z.object({
  title: z.string().trim().min(2).max(160),
  description: z.string().trim().min(10).max(4000)
}).strict();

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

export async function generateCodingExerciseVariationMetadata(input: {
  user: Parameters<typeof generateQuestionAuthoringText>[0];
  prompt: string;
  originalTitle: string;
  originalDescription: string;
  language: string;
  locale: GenerationLocale;
  subject: SubjectContext;
}) {
  const systemPrompt = [
    "You create the title and catalog description for a newly generated Cognelo coding exercise.",
    "Return only valid JSON with exactly this shape: {\"title\":\"...\",\"description\":\"...\"}.",
    "The title must concisely name the concrete task in the new student prompt.",
    "The description must accurately summarize what the student will implement and the main learning objective.",
    "Do not describe the activity as a variation, copy, or alternative version, and do not refer to the original exercise.",
    "Do not add requirements that are absent from the new student prompt.",
    `Programming language: ${input.language}.`,
    `Write the title and description in ${localeName(input.locale)}.`,
    "",
    "Subject context:",
    `Title: ${input.subject.title}`,
    `Description: ${input.subject.description || "No subject description provided."}`
  ].join("\n");
  const immutableContext = [
    "New student-facing prompt:",
    "<student_prompt>",
    input.prompt.trim(),
    "</student_prompt>",
    "",
    "Original metadata, which must not be repeated verbatim:",
    `Title: ${input.originalTitle.trim()}`,
    `Description: ${input.originalDescription.trim() || "None."}`
  ].join("\n");
  let userPrompt = immutableContext;
  let lastPayload: unknown = null;
  let lastIssues: string[] = [];

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const raw = await generateQuestionAuthoringText(input.user, {
      systemPrompt,
      userPrompt,
      maxOutputTokens: 1200
    });
    const parsed = parseGeneratedJson(raw);
    if (parsed.ok) {
      const validation = generatedVariationMetadataSchema.safeParse(parsed.value);
      if (validation.success) {
        const issues = collectVariationMetadataIssues(validation.data, input);
        if (!issues.length) return { ...validation.data, attempts: attempt };
        lastIssues = issues;
        lastPayload = validation.data;
      } else {
        lastIssues = validation.error.issues.map((issue) => `${issue.path.join(".") || "payload"}: ${issue.message}`);
        lastPayload = parsed.value;
      }
    } else {
      lastIssues = [parsed.issue];
      lastPayload = raw;
    }
    userPrompt = [
      "The previous metadata was invalid. Return the full corrected JSON payload only.",
      "Validation issues:",
      ...lastIssues.map((issue) => `- ${issue}`),
      "",
      immutableContext,
      "",
      "Previous payload:",
      typeof lastPayload === "string" ? lastPayload : JSON.stringify(lastPayload, null, 2)
    ].join("\n");
  }

  throw new AppError(422, "CODING_EXERCISE_VARIATION_METADATA_INVALID", "The AI agent could not generate a matching title and description for the coding exercise variation.", {
    issues: lastIssues,
    payload: lastPayload
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
      userPrompt = buildSolutionCorrectionPrompt(input, raw, lastIssues);
      continue;
    }

    const impossible = generatedImpossibleSchema.safeParse(parsed.value);
    if (impossible.success) {
      if (isMissingProvidedContextError(impossible.data.message)) {
        lastPayload = parsed.value;
        lastIssues = [
          "The request already includes the teacher description and student-facing prompt. Generate the reference solution and template from that provided context instead of returning a missing-context error."
        ];
        userPrompt = buildSolutionCorrectionPrompt(input, JSON.stringify(parsed.value, null, 2), lastIssues);
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
    userPrompt = buildSolutionCorrectionPrompt(input, JSON.stringify(parsed.value, null, 2), validation.issues);
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
  visibleTestCount?: number;
  hiddenTestCount?: number;
  knowledge?: ActivityGenerationKnowledge;
  requireCompleteSuite?: boolean;
}) {
  const visibleTestCount = input.visibleTestCount ?? codingExerciseDefaultVisibleTestCount;
  const hiddenTestCount = input.hiddenTestCount ?? codingExerciseDefaultHiddenTestCount;
  const systemPrompt = buildTestsGenerationSystemPrompt({ ...input, visibleTestCount, hiddenTestCount });
  let userPrompt = buildTestsInitialPrompt({ ...input, visibleTestCount, hiddenTestCount });
  let lastPayload: unknown = null;
  let lastIssues: string[] = [];
  let retained: ValidatedGeneratedTests | undefined;
  const partialResult = (attempts: number) => ({
    ...retained!.tests,
    status: "warning" as const,
    validationSummary: retained!.validationSummary,
    attempts,
    knowledgeConceptSelections: undefined
  });

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    let raw: string;
    try {
      raw = await generateQuestionAuthoringText(input.user, {
        systemPrompt,
        userPrompt,
        maxOutputTokens: 9000
      });
    } catch (error) {
      if (retained && !input.requireCompleteSuite) return partialResult(attempt);
      throw error;
    }
    const parsed = parseGeneratedJson(raw);
    if (!parsed.ok) {
      lastPayload = raw;
      lastIssues = [parsed.issue];
      userPrompt = buildTestCorrectionPrompt(
        { ...input, visibleTestCount, hiddenTestCount },
        raw,
        lastIssues,
        retained?.tests
      );
      continue;
    }

    const impossible = generatedImpossibleSchema.safeParse(parsed.value);
    if (impossible.success) {
      if (retained && !input.requireCompleteSuite) return partialResult(attempt);
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
      templateVisibleLineNumbers: input.templateVisibleLineNumbers,
      visibleTestCount,
      hiddenTestCount,
      retained
    }).catch((error: unknown) => {
      if (!retained || input.requireCompleteSuite) throw error;
      return { issues: ["Further test validation was unavailable."] };
    });
    if ("fatalError" in validation && validation.fatalError) {
      throw new AppError(validation.fatalError.status, validation.fatalError.code, validation.fatalError.message, {
        issues: validation.issues
      });
    }

    if ("tests" in validation && validation.tests && validation.validationSummary) {
      retained = { tests: validation.tests, validationSummary: validation.validationSummary };
    }
    if (retained && retained.tests.sampleTests.length === visibleTestCount && retained.tests.hiddenTests.length === hiddenTestCount) {
      const knowledgeConceptSelections = await suggestActivityKnowledgeSelections({
        user: input.user,
        knowledge: input.knowledge ?? { mode: "ignore", concepts: [] },
        generatedActivity: `${input.prompt}\n\n${input.referenceSolution}\n\n${JSON.stringify(retained.tests)}`
      });
      return {
        ...retained.tests,
        validationSummary: retained.validationSummary,
        attempts: attempt,
        knowledgeConceptSelections
      };
    }

    lastPayload = parsed.value;
    lastIssues = validation.issues;
    userPrompt = buildTestCorrectionPrompt(
      { ...input, visibleTestCount, hiddenTestCount },
      JSON.stringify(parsed.value, null, 2),
      validation.issues,
      retained?.tests
    );
  }

  if (retained && !input.requireCompleteSuite) return partialResult(3);

  throw new AppError(422, "CODING_EXERCISE_TEST_GENERATION_INVALID", "The AI agent could not generate valid coding exercise tests.", {
    issues: lastIssues,
    payload: lastPayload
  });
}

export async function generateCodingExerciseRubric(input: {
  user: Parameters<typeof generateQuestionAuthoringText>[0];
  title: string;
  description: string;
  prompt: string;
  referenceSolution: string;
  language: string;
  locale: GenerationLocale;
  subject: SubjectContext;
  knowledge?: ActivityGenerationKnowledge;
}) {
  const systemPrompt = buildRubricGenerationSystemPrompt(input);
  let userPrompt = [
    "Generate a grading rubric for this coding exercise.",
    "",
    "Activity title:",
    input.title.trim(),
    "",
    "Activity description:",
    input.description.trim() || "No separate description provided.",
    "",
    "Student-facing prompt:",
    input.prompt.trim(),
    "",
    "Teacher reference solution:",
    "<reference_solution>",
    input.referenceSolution,
    "</reference_solution>"
  ].join("\n");
  let lastPayload: unknown = null;
  let lastIssues: string[] = [];

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const raw = await generateQuestionAuthoringText(input.user, {
      systemPrompt,
      userPrompt,
      maxOutputTokens: 3500
    });
    const parsed = parseGeneratedJson(raw);
    if (!parsed.ok) {
      lastPayload = raw;
      lastIssues = [parsed.issue];
      userPrompt = buildCorrectionPrompt("JSON payload", raw, lastIssues);
      continue;
    }

    const validation = generatedRubricSchema.safeParse(parsed.value);
    if (validation.success) {
      const criteria: Array<{
        id: string;
        title: string;
        description: string;
        weightPercent: number;
      }> = [];
      for (const criterion of validation.data.criteria) {
        criteria.push({
          id: createCodingExerciseAiRubricCriterionId(criteria),
          ...criterion
        });
      }
      return { criteria, attempts: attempt };
    }

    lastPayload = parsed.value;
    lastIssues = validation.error.issues.map((issue) => `${issue.path.join(".") || "payload"}: ${issue.message}`);
    userPrompt = buildCorrectionPrompt("JSON payload", JSON.stringify(parsed.value, null, 2), lastIssues);
  }

  throw new AppError(422, "CODING_EXERCISE_RUBRIC_GENERATION_INVALID", "The AI agent could not generate a valid rubric.", {
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
    "Define the executable contract precisely: required inputs or function signature, required return value or printed output, and applicable edge cases.",
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
    "- The reference solution and template must support meaningful independent automated test cases; never hard-code fixed demonstration calls or outputs as the only execution path.",
    `- When the prompt asks students to implement a function, method, class, or helper, use the callable-unit template with ${codingExerciseTestInsertionToken} so each test can invoke it with different arguments.`,
    "- When using the full-program template for an input-driven task, the reference program must read the varying case data from standard input instead of embedding one example in source code.",
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

function buildTestsGenerationSystemPrompt(input: {
  language: string;
  locale: GenerationLocale;
  subject: SubjectContext;
  visibleTestCount: number;
  hiddenTestCount: number;
  knowledge?: ActivityGenerationKnowledge;
}) {
  return [
    "You generate visible and hidden test cases for Cognelo coding exercises.",
    "Return only valid JSON. Do not wrap the JSON in Markdown fences. Do not add explanations.",
    "",
    "Required JSON shape when generation is possible:",
    "{",
    '  "status": "ok",',
    '  "sampleTests": [{"id":"sample-1","title":"...","input":"...","output":"...","testCode":"","outputMatchMode":"contains_lines","containsLinesOrderMatters":false}],',
    '  "hiddenTests": [{"id":"hidden-1","name":"...","stdin":"...","expectedOutput":"...","testCode":"","outputMatchMode":"contains_lines","containsLinesOrderMatters":false,"isEnabled":true,"weight":1}]',
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
    `- Generate exactly ${input.visibleTestCount} visible sample tests and exactly ${input.hiddenTestCount} hidden tests.`,
    `- Never generate more than ${codingExerciseMaxGeneratedTestCount} tests of either kind.`,
    "- Generate enough hidden tests to cover normal cases, edge cases, and common mistakes.",
    "- Every visible and hidden test must use outputMatchMode contains_lines with containsLinesOrderMatters false. Do not use exact or regex matching.",
    "- Every output/expectedOutput must contain at least one non-empty line. Empty or whitespace-only expected output is invalid for contains_lines matching.",
    "- Hidden tests may intentionally reproduce the same test case as a visible test with different input values. This is useful for detecting solutions that hard-code the visible examples, so do not reject that overlap as duplication.",
    `- Give every test a concise, descriptive title/name of at most ${maxGeneratedTestNameLength} characters. State the behavior and expected result when practical, for example "Factorial -3 should give 0" instead of a generic label such as "Negative case".`,
    "- IDs must be stable, lowercase, and unique.",
    "- The reference solution must pass every generated sample and hidden test.",
    "- Compute every expected output from the reference solution logic. Do not guess.",
    "- The reference solution and template are immutable during this stage. Do not invent stdin that the reference program does not read, and do not invent testCode when the template cannot insert it.",
    "- If the immutable solution/template cannot support the requested number of meaningful independent cases, return the error shape instead of fabricating ineffective tests.",
    "- Choose only inputs for which the provided reference solution terminates successfully with exit code 0. Do not test invalid-input branches that intentionally return a non-zero exit code.",
    "- For floating-point comparisons, do not use mathematically exact threshold values unless you have accounted for the language's binary floating-point behavior. Prefer values safely inside or outside the threshold so the observed branch is unambiguous.",
    `- If the template contains ${codingExerciseTestInsertionToken}, every sample and hidden test must include non-empty testCode, and testCode must run the reference/student code and print the expected output.`,
    `- If the template does not contain ${codingExerciseTestInsertionToken}, every testCode field must be empty and tests must use stdin plus expected output only.`,
    "- For full-program tests, put input in input/stdin and expected printed output in output/expectedOutput.",
    "- For callable-unit tests, usually leave input/stdin empty and put setup, calls, assertions, and printed output in testCode.",
    "- testCode must print the result named in output/expectedOutput. Assertions alone are insufficient because validation compares stdout to output/expectedOutput.",
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

function buildRubricGenerationSystemPrompt(input: { language: string; locale: GenerationLocale; subject: SubjectContext; knowledge?: ActivityGenerationKnowledge }) {
  return [
    "You generate concise grading rubrics for Cognelo coding exercises.",
    "Return only valid JSON. Do not wrap the JSON in Markdown fences. Do not add explanations.",
    "",
    "Required JSON shape:",
    "{",
    '  "criteria": [',
    '    {"title":"...","description":"...","weightPercent":40}',
    "  ]",
    "}",
    "",
    "Rules:",
    "- Generate between 2 and 6 criteria unless the exercise genuinely needs only one.",
    "- Criterion weights must be whole numbers and total exactly 100.",
    "- Each criterion must measure a distinct, observable aspect of the submitted work.",
    "- Align the rubric with the student-facing requirements and the selected programming language.",
    "- Do not include deterministic test pass rates as a criterion; tests are scored separately.",
    "- Include code quality or approach only when it is relevant to the stated task.",
    "- Do not include a rubric name or criterion identifiers; Cognelo assigns identifiers.",
    `- Programming language: ${input.language}.`,
    `- Write titles and descriptions in ${localeName(input.locale)}.`,
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

function buildTestsInitialPrompt(input: {
  description: string;
  prompt: string;
  referenceSolution: string;
  templateSource: string;
  visibleTestCount: number;
  hiddenTestCount: number;
}) {
  return [
    `Generate exactly ${input.visibleTestCount} visible tests and ${input.hiddenTestCount} hidden tests from the complete context below.`,
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

function collectVariationMetadataIssues(
  metadata: z.infer<typeof generatedVariationMetadataSchema>,
  input: { originalTitle: string; originalDescription: string }
) {
  const issues: string[] = [];
  if (metadata.title.localeCompare(input.originalTitle.trim(), undefined, { sensitivity: "base" }) === 0) {
    issues.push("title must name the new exercise and must not repeat the original title.");
  }
  if (
    input.originalDescription.trim()
    && metadata.description.localeCompare(input.originalDescription.trim(), undefined, { sensitivity: "base" }) === 0
  ) {
    issues.push("description must summarize the new exercise and must not repeat the original description.");
  }
  return issues;
}

async function validateGeneratedTests(input: {
  payload: unknown;
  prompt: string;
  language: string;
  referenceSolution: string;
  templateSource: string;
  templateVisibleLineNumbers: number[];
  visibleTestCount: number;
  hiddenTestCount: number;
  retained?: ValidatedGeneratedTests;
}) {
  const parsed = generatedTestsEnvelopeSchema.safeParse(input.payload);
  if (!parsed.success) {
    return { issues: parsed.error.issues.map((issue) => `${issue.path.join(".") || "payload"}: ${issue.message}`) };
  }
  const templateIssues = collectGeneratedTemplateShapeIssues(input.templateSource);
  if (templateIssues.length) return { issues: templateIssues };

  const issues: string[] = [];
  if (parsed.data.sampleTests.length !== input.visibleTestCount) {
    issues.push(`Generate exactly ${input.visibleTestCount} visible sample tests; received ${parsed.data.sampleTests.length}.`);
  }
  if (parsed.data.hiddenTests.length !== input.hiddenTestCount) {
    issues.push(`Generate exactly ${input.hiddenTestCount} hidden tests; received ${parsed.data.hiddenTests.length}.`);
  }
  const parseTests = <T extends { id: string; testCode: string }>(values: unknown[], schema: z.ZodType<T, z.ZodTypeDef, unknown>, kind: string, expectedOutput: (test: T) => string) =>
    values.flatMap((value, index) => {
      const result = schema.safeParse(value);
      if (!result.success) {
        issues.push(...result.error.issues.map((issue) => `${kind}.${index}.${issue.path.join(".")}: ${issue.message}`));
        return [];
      }
      const test = { ...result.data, outputMatchMode: "contains_lines" as const, containsLinesOrderMatters: false };
      const matcherIssue = validateCodingExerciseOutputMatcher(expectedOutput(test), test);
      if (matcherIssue) {
        issues.push(`${kind}.${index} has invalid expected output: ${matcherIssue}`);
        return [];
      }
      if (Boolean(test.testCode.trim()) !== input.templateSource.includes(codingExerciseTestInsertionToken)) {
        issues.push(`${kind}.${index}: testCode must be non-empty only when templateSource contains ${codingExerciseTestInsertionToken}.`);
        return [];
      }
      if ("isEnabled" in test && !test.isEnabled) {
        issues.push(`${kind}.${index}: generated hidden tests must be enabled for validation.`);
        return [];
      }
      return [test];
    });

  const retainedIds = new Set([
    ...input.retained?.tests.sampleTests ?? [], ...input.retained?.tests.hiddenTests ?? []
  ].map((test) => test.id));
  const usedIds = new Set(retainedIds);
  const mergeCandidates = <T extends { id: string }>(retained: T[], candidates: T[], limit: number, signature: (test: T) => string) => {
    const result = [...retained];
    const retainedCases = new Set(retained.map(signature));
    for (const test of candidates) {
      // A correction cannot change or remove a test that already passed.
      if (retainedIds.has(test.id) || retainedCases.has(signature(test))) continue;
      if (usedIds.has(test.id)) {
        issues.push(`Test ids must be unique. Duplicate: ${test.id}.`);
        continue;
      }
      if (result.length >= limit) continue;
      usedIds.add(test.id);
      result.push(test);
    }
    return result;
  };
  let tests: GeneratedTests = {
    status: parsed.data.status,
    warningMessage: parsed.data.warningMessage,
    sampleTests: mergeCandidates(input.retained?.tests.sampleTests ?? [], parseTests(parsed.data.sampleTests, generatedSampleTestSchema, "sampleTests", (test) => test.output), input.visibleTestCount,
      (test) => JSON.stringify([test.input, test.output, test.testCode])),
    hiddenTests: mergeCandidates(input.retained?.tests.hiddenTests ?? [], parseTests(parsed.data.hiddenTests, generatedHiddenTestSchema, "hiddenTests", (test) => test.expectedOutput), input.hiddenTestCount,
      (test) => JSON.stringify([test.stdin, test.expectedOutput, test.testCode]))
  };
  if (!tests.sampleTests.length && !tests.hiddenTests.length) return { issues };

  const privateConfig = parseCodingExercisePrivateConfig({
    templateSource: input.templateSource,
    templateVisibleLineNumbers: input.templateVisibleLineNumbers
  });
  const validate = (suite: GeneratedTests, previousValidationSummary?: unknown) => validateReferenceSolutionAgainstHiddenTests({
    activityConfig: {
      prompt: input.prompt,
      language: input.language,
      executionMode: "template",
      starterCode: "",
      studentTemplateSource: privateConfig.templateSource,
      sampleTests: suite.sampleTests,
      maxEditorSeconds: 1800
    },
    sourceCode: input.referenceSolution,
    sampleTests: suite.sampleTests,
    hiddenTests: suite.hiddenTests.map((test, index) => ({ ...test, orderIndex: index })),
    privateConfig,
    allowPartialResults: true,
    previousValidationSummary
  });
  let validationSummary = await validate(tests, input.retained?.validationSummary);
  const fatalError = getFatalReferenceValidationError(validationSummary);
  if (fatalError) return { issues: [...issues, ...collectValidationIssues(validationSummary)], fatalError };

  if (!validationSummary.accepted) {
    const repairedTests = repairTestExpectedOutputsFromValidation(tests, validationSummary);
    if (repairedTests) {
      try {
        const repairedSummary = await validate(repairedTests, validationSummary);
        tests = repairedTests;
        validationSummary = repairedSummary;
      } catch {
        // Keep the original passing results if a correction cannot be executed.
        issues.push("Expected-output correction could not be validated.");
      }
    }
  }
  if (validationSummary.accepted) return { tests, validationSummary, issues };

  issues.push(...collectValidationIssues(validationSummary));
  const sampleResults = getValidationTests(validationSummary.sampleTests).filter((test) => test.passed === true);
  const hiddenResults = getValidationTests(validationSummary.hiddenTests).filter((test) => test.passed === true);
  const sampleIds = new Set(sampleResults.map((test) => test.id));
  const hiddenIds = new Set(hiddenResults.map((test) => test.id));
  tests = {
    ...tests,
    sampleTests: tests.sampleTests.filter((test) => sampleIds.has(test.id)),
    hiddenTests: tests.hiddenTests.filter((test) => hiddenIds.has(test.id))
  };
  if (!tests.sampleTests.length && !tests.hiddenTests.length) return { issues };
  const passingGroup = (results: Array<Record<string, unknown>>) => ({
    accepted: true,
    testCount: results.length,
    passedCount: results.length,
    executedTestCount: 0,
    reusedTestCount: results.length,
    earnedWeight: results.reduce((sum, test) => sum + Number(test.weight ?? 1), 0),
    totalWeight: results.reduce((sum, test) => sum + Number(test.weight ?? 1), 0),
    tests: results
  });
  return {
    tests,
    validationSummary: {
      ...validationSummary,
      accepted: true,
      sampleTests: passingGroup(sampleResults),
      hiddenTests: passingGroup(hiddenResults),
      executedTestCount: 0,
      reusedTestCount: sampleResults.length + hiddenResults.length
    },
    issues
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
  if (!failed.length || failed.length !== results.length) return null;
  if (failed.every((test) => String(test.statusLabel ?? "").toLowerCase().includes("compilation error"))) {
    return {
      status: 422,
      code: "REFERENCE_SOLUTION_COMPILATION_FAILED",
      message: "Judge0 could not compile the reviewed reference solution. Test generation cannot correct a compiler or sandbox failure; verify the reference solution and Judge0 runtime."
    };
  }
  if (failed.every((test) => /internal error|execution unavailable/i.test(String(test.statusLabel ?? "")))) {
    return {
      status: 503,
      code: "JUDGE0_EXECUTION_UNAVAILABLE",
      message: "Judge0 could not execute the reference solution. Check the Judge0 server and worker logs."
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

  if (!failedResults.some(isWrongAnswerWithStdout)) {
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
  return (statusId === 4 || /wrong answer/i.test(statusLabel)) && typeof test.stdout === "string"
    && test.stdout.trim().length > 0 && test.outputTruncated !== true;
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

function buildSolutionCorrectionPrompt(
  input: { description: string; prompt: string },
  previous: string,
  issues: string[]
) {
  return [
    "The previous JSON payload was invalid. Return the full corrected JSON payload only.",
    "Keep the new payload consistent with the complete immutable exercise context below.",
    "",
    "Validation issues:",
    ...issues.map((issue) => `- ${issue}`),
    "",
    buildSolutionInitialPrompt(input),
    "",
    "Previous JSON payload:",
    previous
  ].join("\n");
}

function buildTestCorrectionPrompt(
  input: {
    description: string;
    prompt: string;
    referenceSolution: string;
    templateSource: string;
    visibleTestCount: number;
    hiddenTestCount: number;
  },
  previous: string,
  issues: string[],
  retained?: GeneratedTests
) {
  return [
    "The previous JSON payload failed execution validation. Return the full corrected JSON payload only.",
    "Replace or remove every failing test; do not merely repeat its mathematically expected result.",
    "The reference solution and template are immutable. Re-read them below before changing any input, testCode, or expected output.",
    "Never add stdin unless the reference solution reads it, and never add testCode unless the template contains {{ TEST_CODE }}.",
    "Every output/expectedOutput must contain at least one non-empty line. When testCode is used, it must print that expected result; assertions alone are insufficient.",
    "Do not include inputs for which the reference solution exits with a non-zero status.",
    "Avoid floating-point values exactly on a comparison threshold when binary representation can change the branch.",
    "Expected output must match the reference solution's actual stdout byte for byte.",
    "",
    "Validation issues:",
    ...issues.map((issue) => `- ${issue}`),
    ...(retained ? [
      "",
      "These tests already passed and must be kept unchanged, including their IDs. Correct or replace only the other cases to reach the requested counts:",
      JSON.stringify(retained)
    ] : []),
    "",
    "Complete immutable exercise context:",
    buildTestsInitialPrompt(input),
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
