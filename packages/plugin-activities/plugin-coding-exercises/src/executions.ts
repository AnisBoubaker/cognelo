import { codingSourceFilesSchema, readCodingSourceFiles, referenceCodingFiles, formatCodingSourceFiles, type CodingSourceFile } from "./coding-files";
import { codingExecutionSources, resolveCodingFileInput } from "./coding-project";
import { AppError } from "@cognelo/core";
import { z } from "zod";
import { gradeCodingBlanks } from "./blank-grading";
import { assertCodingPracticeRunsEnabled, createCodingPracticeRun } from "./practice-runs";
import { assembleCodingBlankSource, codingBlankIds, codingBlankAnswersSchema, readCodingBlankResponse, resolveCodingBlankInput, type CodingBlankResponse } from "./code-blanks";
import {
  getCodingExerciseMaxTestRuns,
  getCodingExerciseCpuTimeLimit,
  codingExerciseOutputMatchModeSchema,
  parseCodingExerciseConfig,
  parseCodingExercisePrivateConfig,
  type CodingExerciseOutputMatchMode,
  type CodingExercisePrivateConfig,
  type CodingExerciseSampleTest
} from "./coding-exercises";
import { Prisma, prisma } from "./db-client";
import { capExecutionResultSummary, capExecutionText, capJudge0Output, MAX_EXECUTION_MESSAGE_BYTES } from "./execution-output";
import { isCodingExerciseOperationalFailure } from "./execution-results";
import { resolveJudge0Language, runJudge0Submission } from "./judge0";
import {
  compareCodingExerciseOutput,
  getJudge0ExpectedOutput,
  validateCodingExerciseOutputMatcher,
  type CodingExerciseOutputMatcher
} from "./output-matcher";
import { hashCodingExerciseValidationValue } from "./validation-cache";

type CodingExerciseExecutionRow = {
  id: string;
  activityId: string;
  userId: string;
  kind: "run" | "submit";
  status: "pending" | "completed" | "failed";
  languageKey: string;
  judge0LanguageId: number;
  sourceCode: string;
  sourceFiles?: unknown;
  judge0Token: string | null;
  stdin: string | null;
  expectedOutput: string | null;
  stdout: string | null;
  stderr: string | null;
  compileOutput: string | null;
  message: string | null;
  timeSeconds: string | null;
  memoryKb: number | null;
  judge0StatusId: number | null;
  judge0StatusLabel: string | null;
  resultSummary: unknown;
  createdAt: Date;
  updatedAt: Date;
};

const codingExerciseExecutionClient = prisma as typeof prisma & {
  pluginCodingExerciseExecution: {
    create(args: Prisma.PluginCodingExerciseExecutionCreateArgs): Promise<CodingExerciseExecutionRow>;
    update(args: Prisma.PluginCodingExerciseExecutionUpdateArgs): Promise<CodingExerciseExecutionRow>;
    findMany(args: Prisma.PluginCodingExerciseExecutionFindManyArgs): Promise<CodingExerciseExecutionRow[]>;
  };
  pluginCodingExerciseReferenceSolution: {
    findUnique(
      args: Prisma.PluginCodingExerciseReferenceSolutionFindUniqueArgs
    ): Promise<{
      sourceCode: string;
      privateConfig: unknown;
      validationSummary: unknown;
      createdAt: Date;
      updatedAt: Date;
    } | null>;
  };
};

export const codingExerciseRunInputSchema = z.object({
  sourceCode: z.string().max(300000).default(""),
  files: codingSourceFilesSchema.optional(),
  blankAnswers: codingBlankAnswersSchema.optional(),
  blankTemplate: z.string().max(40000).optional(),
  stdin: z.string().max(12000).optional().default(""),
  expectedOutput: z.string().max(12000).optional().default(""),
  testCode: z.string().max(40000).optional().default(""),
  outputMatchMode: codingExerciseOutputMatchModeSchema.optional().default("exact"),
  containsLinesOrderMatters: z.boolean().optional().default(false),
  compareOutput: z.boolean().optional().default(true)
}).refine(value => value.sourceCode.trim().length > 0 || Object.values(value.blankAnswers ?? {}).some(answer => answer.trim()) || value.files?.some(file => file.sourceCode.trim()),
  "Enter code before running or submitting.").superRefine((value, ctx) => {
    if (!value.files && value.sourceCode.length > 60000) ctx.addIssue({ code: "custom", path: ["sourceCode"], message: "The submitted code exceeds 60,000 characters." });
  });

export type CodingExerciseRunInput = z.input<typeof codingExerciseRunInputSchema>;

export const codingExerciseSubmitInputSchema = z.object({
  sourceCode: z.string().max(300000).default(""),
  files: codingSourceFilesSchema.optional(),
  blankAnswers: codingBlankAnswersSchema.optional(),
  blankTemplate: z.string().max(40000).optional()
}).superRefine((value, ctx) => {
  if (!value.files && value.sourceCode.length > 60000) ctx.addIssue({ code: "custom", path: ["sourceCode"], message: "The submitted code exceeds 60,000 characters." });
});

type HiddenTestCase = {
  id: string;
  name: string;
  stdin: string;
  expectedOutput: string;
  testCode: string;
  outputMatchMode: CodingExerciseOutputMatchMode;
  containsLinesOrderMatters: boolean;
  isEnabled: boolean;
  weight: number;
  orderIndex: number;
};

type ReferenceValidationTestCase = {
  id: string;
  name: string;
  stdin: string;
  expectedOutput: string;
  testCode: string;
  outputMatchMode: CodingExerciseOutputMatchMode;
  containsLinesOrderMatters: boolean;
  weight: number;
  validationFingerprint: string;
};

type ReferenceValidationTestResult = Record<string, unknown> & {
  id: string;
  name: string;
  passed: boolean;
  weight: number;
  validationFingerprint: string;
  statusId?: number | null;
  statusLabel?: string | null;
  expectedOutput?: string;
  stdout?: string | null;
  stderr?: string | null;
  compileOutput?: string | null;
  message?: string | null;
  outputTruncated?: boolean;
  outputMatchMode?: CodingExerciseOutputMatchMode;
  containsLinesOrderMatters?: boolean;
  timeSeconds?: string | null;
  memoryKb?: number | null;
};

type ReferenceSolutionValidationRecord = {
  sourceCode: string;
  privateConfig: CodingExercisePrivateConfig;
  validationSummary: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

function getHiddenTestCode(value: unknown) {
  const metadata =
    value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
  return typeof metadata?.testCode === "string" ? metadata.testCode : "";
}

function getHiddenTestOutputMatcher(value: unknown): CodingExerciseOutputMatcher {
  const metadata =
    value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  const parsedMode = codingExerciseOutputMatchModeSchema.safeParse(metadata.outputMatchMode);
  return {
    outputMatchMode: parsedMode.success ? parsedMode.data : "exact",
    containsLinesOrderMatters: metadata.containsLinesOrderMatters === true
  };
}

function toHiddenTestCase(test: {
  id: string;
  name: string;
  stdin: string;
  expectedOutput: string;
  isEnabled: boolean;
  weight: number;
  orderIndex: number;
  metadata: unknown;
}): HiddenTestCase {
  const outputMatcher = getHiddenTestOutputMatcher(test.metadata);
  const metadata = test.metadata && typeof test.metadata === "object" && !Array.isArray(test.metadata)
    ? test.metadata as Record<string, unknown>
    : {};
  return {
    id: typeof metadata.stableId === "string" && metadata.stableId.trim() ? metadata.stableId : test.id,
    name: test.name,
    stdin: test.stdin,
    expectedOutput: test.expectedOutput,
    testCode: getHiddenTestCode(test.metadata),
    ...outputMatcher,
    isEnabled: test.isEnabled,
    weight: test.weight,
    orderIndex: test.orderIndex
  };
}

export async function runCodingExercise(params: {
  activityId: string;
  userId: string;
  activityConfig: unknown;
  input: CodingExerciseRunInput;
  practiceScope?: string;
}) {
  const config = parseCodingExerciseConfig(params.activityConfig);
  const input = resolveExecutionInput(config, codingExerciseRunInputSchema.parse(params.input));
  if (!input.sourceCode.trim()) throw new AppError(400, "CODING_EXERCISE_ANSWER_REQUIRED", "Enter code before running.");
  assertCodingPracticeRunsEnabled(config);
  const outputMatcher = toOutputMatcher(input);
  if (input.compareOutput) {
    assertValidOutputMatcher(input.expectedOutput, outputMatcher);
  }
  const privateConfig = await getCodingExercisePrivateConfig({ activityId: params.activityId });
  if (privateConfig.aiFeedback.testsEnabled === false) throw new AppError(403, "CODING_EXERCISE_RUN_DISABLED", "Tests are disabled for this exercise.");
  const runtime = await resolveJudge0Language(config.language);
  const executionSources = codingExecutionSources({ config, privateConfig, sourceCode: input.sourceCode,
    files: input.files, testCode: input.compareOutput ? input.testCode : "" });

  const pendingExecution = await createCodingPracticeRun({
    activityId: params.activityId,
    userId: params.userId,
    kind: "run",
    status: "pending",
    languageKey: runtime.languageKey,
    judge0LanguageId: runtime.languageId,
    sourceCode: input.sourceCode,
    ...(input.files ? { sourceFiles: input.files as Prisma.InputJsonValue } : {}),
    stdin: input.stdin,
    expectedOutput: input.expectedOutput,
    resultSummary: {
      ...(params.practiceScope ? { practiceRunScope: params.practiceScope } : {}),
      ...blankExecutionSnapshot(input),
      judge0LanguageName: runtime.languageName,
      executionMode: config.executionMode,
      phase: "pending"
    } as Prisma.InputJsonValue
  }, getCodingExerciseMaxTestRuns(config), params.practiceScope);

  try {
    const result = await runJudge0Submission({
      languageId: runtime.languageId,
      ...executionSources,
      stdin: input.stdin,
      expectedOutput: input.compareOutput ? getJudge0ExpectedOutput(input.expectedOutput, outputMatcher) : undefined,
      cpuTimeLimit: getCodingExerciseCpuTimeLimit(config.maxEditorSeconds),
      wallTimeLimit: 10,
      memoryLimitKb: 128000
    });

    const comparison = evaluateJudge0Result(result, input.expectedOutput, outputMatcher, input.compareOutput);
    const savedOutput = capJudge0Output(result);
    const message = capExecutionText(result.message ?? comparison.message, MAX_EXECUTION_MESSAGE_BYTES);
    const comparisonMessage = capExecutionText(comparison.message, MAX_EXECUTION_MESSAGE_BYTES);
    const normalizedExecution = await codingExerciseExecutionClient.pluginCodingExerciseExecution.update({
      where: { id: pendingExecution.id },
      data: {
        status: comparison.matched ? "completed" : "failed",
        judge0Token: result.token,
        stdout: savedOutput.stdout,
        stderr: savedOutput.stderr,
        compileOutput: savedOutput.compileOutput,
        message: message.value,
        timeSeconds: result.time,
        memoryKb: result.memory ?? undefined,
        judge0StatusId: result.status?.id,
        judge0StatusLabel: result.status?.description,
        resultSummary: {
          ...(params.practiceScope ? { practiceRunScope: params.practiceScope } : {}),
          ...blankExecutionSnapshot(input),
          judge0LanguageName: runtime.languageName,
          accepted: comparison.matched,
          outputCompared: input.compareOutput,
          outputMatchMode: input.outputMatchMode,
          containsLinesOrderMatters: input.containsLinesOrderMatters,
          comparisonMessage: comparisonMessage.value,
          outputTruncated: savedOutput.outputTruncated || message.truncated || comparisonMessage.truncated,
          executionMode: config.executionMode,
          phase: "finished"
        } as Prisma.InputJsonValue
      }
    });

    return toCodingExerciseExecutionRecord(normalizedExecution);
  } catch (error) {
    await codingExerciseExecutionClient.pluginCodingExerciseExecution.update({
      where: { id: pendingExecution.id },
      data: {
        status: "failed",
        resultSummary: {
          ...(params.practiceScope ? { practiceRunScope: params.practiceScope } : {}),
          phase: "failed-before-result",
          outputCompared: input.compareOutput
        } as Prisma.InputJsonValue,
        message: capExecutionText(error instanceof Error ? error.message : "Unknown Judge0 execution failure.", MAX_EXECUTION_MESSAGE_BYTES).value
      }
    });

    if (error instanceof AppError) {
      throw error;
    }

    throw new AppError(502, "JUDGE0_EXECUTION_FAILED", "The remote code execution service could not complete the run.");
  }
}

export async function runCodingExercisePreview(params: {
  activityId: string;
  userId: string;
  activityConfig: unknown;
  input: CodingExerciseRunInput;
}) {
  const config = parseCodingExerciseConfig(params.activityConfig);
  const input = resolveExecutionInput(config, codingExerciseRunInputSchema.parse(params.input));
  if (!input.sourceCode.trim()) throw new AppError(400, "CODING_EXERCISE_ANSWER_REQUIRED", "Enter code before running.");
  assertCodingPracticeRunsEnabled(config);
  const outputMatcher = toOutputMatcher(input);
  if (input.compareOutput) assertValidOutputMatcher(input.expectedOutput, outputMatcher);
  const [privateConfig, runtime] = await Promise.all([
    getCodingExercisePrivateConfig({ activityId: params.activityId }),
    resolveJudge0Language(config.language)
  ]);
  if (privateConfig.aiFeedback.testsEnabled === false) throw new AppError(403, "CODING_EXERCISE_RUN_DISABLED", "Tests are disabled for this exercise.");
  const executionSources = codingExecutionSources({ config, privateConfig, sourceCode: input.sourceCode,
    files: input.files, testCode: input.compareOutput ? input.testCode : "" });
  try {
    const result = await runJudge0Submission({
      languageId: runtime.languageId,
      ...executionSources,
      stdin: input.stdin,
      expectedOutput: input.compareOutput ? getJudge0ExpectedOutput(input.expectedOutput, outputMatcher) : undefined,
      cpuTimeLimit: getCodingExerciseCpuTimeLimit(config.maxEditorSeconds),
      wallTimeLimit: 10,
      memoryLimitKb: 128000
    });
    const comparison = evaluateJudge0Result(result, input.expectedOutput, outputMatcher, input.compareOutput);
    const savedOutput = capJudge0Output(result);
    const message = capExecutionText(result.message ?? comparison.message, MAX_EXECUTION_MESSAGE_BYTES);
    const comparisonMessage = capExecutionText(comparison.message, MAX_EXECUTION_MESSAGE_BYTES);
    return previewCodingExecutionRecord({
      activityId: params.activityId,
      userId: params.userId,
      kind: "run",
      status: comparison.matched ? "completed" : "failed",
      languageKey: runtime.languageKey,
      judge0LanguageId: runtime.languageId,
      sourceCode: input.sourceCode,
    ...(input.files ? { sourceFiles: input.files as Prisma.InputJsonValue } : {}),
      stdin: input.stdin,
      expectedOutput: input.expectedOutput,
      judge0Token: result.token,
      stdout: savedOutput.stdout ?? null,
      stderr: savedOutput.stderr ?? null,
      compileOutput: savedOutput.compileOutput ?? null,
      message: message.value ?? null,
      timeSeconds: result.time ?? null,
      memoryKb: result.memory ?? null,
      judge0StatusId: result.status?.id ?? null,
      judge0StatusLabel: result.status?.description ?? null,
      resultSummary: {
        ...blankExecutionSnapshot(input),
        judge0LanguageName: runtime.languageName,
        accepted: comparison.matched,
        outputCompared: input.compareOutput,
        outputMatchMode: input.outputMatchMode,
        containsLinesOrderMatters: input.containsLinesOrderMatters,
        comparisonMessage: comparisonMessage.value,
        outputTruncated: savedOutput.outputTruncated || message.truncated || comparisonMessage.truncated,
        executionMode: config.executionMode,
        phase: "finished",
        studentPreview: true
      }
    });
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(502, "JUDGE0_EXECUTION_FAILED", "The remote code execution service could not complete the preview run.");
  }
}

export async function listRecentCodingExerciseExecutions(params: {
  activityId: string;
  userId: string;
  limit?: number;
}) {
  const executions = await codingExerciseExecutionClient.pluginCodingExerciseExecution.findMany({
    where: {
      activityId: params.activityId,
      userId: params.userId
    },
    orderBy: [{ createdAt: "desc" }],
    take: params.limit ?? 10
  });

  return executions.map((execution) => toCodingExerciseExecutionRecord(execution));
}

export async function listCodingExerciseAttemptHistory(params: {
  activityId: string;
  userId: string;
}) {
  const executions = await codingExerciseExecutionClient.pluginCodingExerciseExecution.findMany({
    where: {
      activityId: params.activityId,
      userId: params.userId
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }]
  });

  const attempts: Array<{
    submission: ReturnType<typeof toCodingExerciseExecutionRecord>;
    runs: Array<ReturnType<typeof toCodingExerciseExecutionRecord>>;
  }> = [];
  let currentRuns: Array<ReturnType<typeof toCodingExerciseExecutionRecord>> = [];

  for (const execution of executions) {
    const record = toCodingExerciseExecutionRecord(execution);
    if (record.kind === "run") {
      currentRuns.push(record);
      continue;
    }

    if (isCodingExerciseOperationalFailure(record)) {
      continue;
    }

    attempts.push({
      submission: record,
      runs: currentRuns
    });
    currentRuns = [];
  }

  return {
    currentRuns: [...currentRuns].reverse(),
    attempts: [...attempts].reverse()
  };
}

export async function listCodingExerciseReviewExecutions(params: { activityId: string; userIds: string[] }) {
  const executions = await listCodingExerciseReviewExecutionAttempts(params);
  const seen = new Set<string>();
  return executions.filter((execution) => {
    if (seen.has(execution.userId)) return false;
    seen.add(execution.userId);
    return true;
  });
}

export async function listCodingExerciseReviewExecutionAttempts(params: { activityId: string; userIds: string[]; executionId?: string | null }) {
  if (!params.userIds.length) return [];
  const executions = await codingExerciseExecutionClient.pluginCodingExerciseExecution.findMany({
    where: {
      activityId: params.activityId,
      userId: { in: params.userIds },
      kind: "submit",
      ...(params.executionId ? { id: params.executionId } : {})
    },
    orderBy: [{ createdAt: "desc" }]
  });
  return executions.flatMap((execution) => {
    const record = toCodingExerciseExecutionRecord(execution);
    if (isCodingExerciseOperationalFailure(record)) return [];
    return [record];
  });
}

export async function submitCodingExercise(params: {
  activityId: string;
  userId: string;
  activityConfig: unknown;
  input: z.infer<typeof codingExerciseSubmitInputSchema>;
}) {
  const config = parseCodingExerciseConfig(params.activityConfig);
  const input = resolveExecutionInput(config, codingExerciseSubmitInputSchema.parse(params.input));
  const privateConfig = await getCodingExercisePrivateConfig({ activityId: params.activityId });
  const runtime = privateConfig.aiFeedback.testsEnabled === false || (config.responseMode === "blanks" && !input.sourceCode.trim())
    ? { languageKey: config.language, languageId: 0, languageName: config.language } : await resolveJudge0Language(config.language);
  const hiddenTests = privateConfig.aiFeedback.testsEnabled === false ? [] : await prisma.pluginCodingExerciseHiddenTest.findMany({
    where: { activityId: params.activityId, isEnabled: true },
    orderBy: [{ orderIndex: "asc" }, { createdAt: "asc" }]
  });
  const normalizedHiddenTests = hiddenTests.map((hiddenTest) => toHiddenTestCase(hiddenTest));

  const pendingExecution = await codingExerciseExecutionClient.pluginCodingExerciseExecution.create({
    data: {
      activityId: params.activityId,
      userId: params.userId,
      kind: "submit",
      status: "pending",
      languageKey: runtime.languageKey,
      judge0LanguageId: runtime.languageId,
      sourceCode: input.sourceCode,
    ...(input.files ? { sourceFiles: input.files as Prisma.InputJsonValue } : {}),
      stdin: "",
      expectedOutput: "",
      resultSummary: {
        ...blankExecutionSnapshot(input),
        judge0LanguageName: runtime.languageName,
        executionMode: config.executionMode,
        phase: "pending",
        testCount: normalizedHiddenTests.length
      } as Prisma.InputJsonValue
    }
  });

  let blankEvaluationId: string | null = null;
  try {
    if (config.files || (config.responseMode === "blanks" && normalizedHiddenTests.length)) {
      const evaluation = await prisma.pluginCodingExerciseTestEvaluation.create({ data: {
        activityId: params.activityId, executionId: pendingExecution.id, actorUserId: params.userId, status: "pending",
        resultSummary: { phase: "pending" }, configSnapshot: { purpose: config.responseMode === "blanks" ? "initial-blank-grading" : "initial-project-snapshot", policy: config.responseMode === "blanks" ? "isolated-blanks-v1" : "weighted-tests-v1",
          activityConfig: config, privateConfig, hiddenTests: normalizedHiddenTests, sourceFiles: input.files, blankResponse: readCodingBlankResponse(input) } as Prisma.InputJsonValue
      } });
      blankEvaluationId = evaluation.id;
    }
    const evaluated = await evaluateCodingSubmissionTests({ config, privateConfig, runtime, hiddenTests: normalizedHiddenTests,
      sourceCode: input.sourceCode, files: input.files, blankResponse: readCodingBlankResponse(input) });
    if (blankEvaluationId) await prisma.pluginCodingExerciseTestEvaluation.update({ where: { id: blankEvaluationId },
      data: { status: "completed", resultSummary: evaluated.summary as Prisma.InputJsonValue } });
    const updatedExecution = await codingExerciseExecutionClient.pluginCodingExerciseExecution.update({
      where: { id: pendingExecution.id },
      data: {
        status: evaluated.summary.accepted !== false ? "completed" : "failed",
        judge0Token: evaluated.latestToken,
        stdout: evaluated.latestStdout,
        stderr: evaluated.latestStderr,
        compileOutput: evaluated.latestCompileOutput,
        message: evaluated.firstFailureMessage,
        timeSeconds: evaluated.latestTime,
        memoryKb: evaluated.latestMemory ?? undefined,
        judge0StatusId: evaluated.latestStatusId ?? undefined,
        judge0StatusLabel: evaluated.latestStatusLabel ?? undefined,
        resultSummary: { ...evaluated.summary, ...blankExecutionSnapshot(input) } as Prisma.InputJsonValue
      }
    });

    return toCodingExerciseExecutionRecord(updatedExecution);
  } catch (error) {
    if (blankEvaluationId) await prisma.pluginCodingExerciseTestEvaluation.update({ where: { id: blankEvaluationId }, data: {
      status: "failed", resultSummary: { phase: "failed-before-result" }, error: error instanceof Error ? error.message.slice(0, 4000) : "Blank grading failed."
    } }).catch(() => undefined);
    await codingExerciseExecutionClient.pluginCodingExerciseExecution.update({
      where: { id: pendingExecution.id },
      data: {
        status: "failed",
        resultSummary: {
          phase: "failed-before-result"
        } as Prisma.InputJsonValue,
        message: capExecutionText(error instanceof Error ? error.message : "Unknown Judge0 submission failure.", MAX_EXECUTION_MESSAGE_BYTES).value
      }
    });

    if (error instanceof AppError) {
      throw error;
    }

    throw new AppError(502, "JUDGE0_SUBMISSION_FAILED", "The remote code execution service could not complete the submission.");
  }
}

export async function submitCodingExercisePreview(params: {
  activityId: string;
  userId: string;
  activityConfig: unknown;
  input: z.infer<typeof codingExerciseSubmitInputSchema>;
}) {
  const config = parseCodingExerciseConfig(params.activityConfig);
  const input = resolveExecutionInput(config, codingExerciseSubmitInputSchema.parse(params.input));
  const privateConfig = await getCodingExercisePrivateConfig({ activityId: params.activityId });
  const [runtime, hiddenTests] = await Promise.all([
    privateConfig.aiFeedback.testsEnabled === false || (config.responseMode === "blanks" && !input.sourceCode.trim())
      ? Promise.resolve({ languageKey: config.language, languageId: 0, languageName: config.language }) : resolveJudge0Language(config.language),
    privateConfig.aiFeedback.testsEnabled === false ? Promise.resolve([]) : prisma.pluginCodingExerciseHiddenTest.findMany({
      where: { activityId: params.activityId, isEnabled: true },
      orderBy: [{ orderIndex: "asc" }, { createdAt: "asc" }]
    })
  ]);
  const normalizedHiddenTests = hiddenTests.map(toHiddenTestCase);
  try {
    const evaluated = await evaluateCodingSubmissionTests({ config, privateConfig, runtime, hiddenTests: normalizedHiddenTests,
      sourceCode: input.sourceCode, files: input.files, blankResponse: readCodingBlankResponse(input) });
    return previewCodingExecutionRecord({
      activityId: params.activityId,
      userId: params.userId,
      kind: "submit",
      status: evaluated.summary.accepted !== false ? "completed" : "failed",
      languageKey: runtime.languageKey,
      judge0LanguageId: runtime.languageId,
      sourceCode: input.sourceCode,
    ...(input.files ? { sourceFiles: input.files as Prisma.InputJsonValue } : {}),
      stdin: "",
      expectedOutput: "",
      judge0Token: evaluated.latestToken,
      stdout: evaluated.latestStdout,
      stderr: evaluated.latestStderr,
      compileOutput: evaluated.latestCompileOutput,
      message: evaluated.firstFailureMessage,
      timeSeconds: evaluated.latestTime,
      memoryKb: evaluated.latestMemory,
      judge0StatusId: evaluated.latestStatusId,
      judge0StatusLabel: evaluated.latestStatusLabel,
      resultSummary: { ...evaluated.summary, ...blankExecutionSnapshot(input), studentPreview: true }
    });
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(502, "JUDGE0_SUBMISSION_FAILED", "The remote code execution service could not complete the preview submission.");
  }
}

async function evaluateCodingSubmissionTests(input: Parameters<typeof executeHiddenTests>[0] & {
  blankResponse: CodingBlankResponse | null; checkReference?: boolean; referenceFiles?: CodingSourceFile[]; legacyReferenceSource?: string;
}) {
  if (input.legacyReferenceSource && !(await executeHiddenTests({ ...input, files: undefined, sourceCode: input.legacyReferenceSource, stopAfterFailure: true })).summary.accepted) throw new AppError(409, "CODING_EXERCISE_PROJECT_REFERENCE_INVALID", "The original single-file reference no longer passes the current tests. Review this response manually.");
  if (input.referenceFiles && !(await executeHiddenTests({ ...input, files: input.referenceFiles,
    sourceCode: formatCodingSourceFiles(input.referenceFiles), stopAfterFailure: true })).summary.accepted) {
    throw new AppError(409, "CODING_EXERCISE_PROJECT_REFERENCE_INVALID", "The original file layout and reference no longer pass the current tests.");
  }
  if (input.config.responseMode !== "blanks" || !input.hiddenTests.length) return executeHiddenTests(input);
  const response = input.blankResponse;
  if (!response) throw new AppError(409, "CODING_EXERCISE_BLANK_RESPONSE_REQUIRED", "Saved blank values are required for automatic grading.");
  type Source = string | CodingSourceFile[];
  const assembleSource = (answers: Record<string, string>): Source => input.files
    ? input.files.map(file => ({ ...file, sourceCode: assembleCodingBlankSource(file.blankTemplate ?? "", answers) }))
    : assembleCodingBlankSource(response.blankTemplate, answers);
  const key = (source: Source) => typeof source === "string" ? source : JSON.stringify(source);
  const suites = new Map<string, Promise<Awaited<ReturnType<typeof executeHiddenTests>>>>();
  const runSuite = (source: Source, stopAfterFailure: boolean) => {
    let result = suites.get(key(source));
    if (!result) {
      result = executeHiddenTests({ ...input, sourceCode: typeof source === "string" ? source : formatCodingSourceFiles(source),
        files: typeof source === "string" ? undefined : source, stopAfterFailure, stopAfterCompilationFailure: true });
      suites.set(key(source), result);
    }
    return result;
  };
  if (input.checkReference && Object.values(response.blankAnswers).some(answer => answer.trim())) {
    const reference = assembleSource(input.privateConfig.blankReferenceAnswers ?? {});
    if (!(await runSuite(reference, true)).summary.accepted) throw new AppError(409, "CODING_EXERCISE_BLANK_REFERENCE_INVALID", "The saved reference completion does not pass the current tests for this submitted blank layout.");
  }
  const checkSyntax = ["python", "python2"].includes(input.runtime.languageKey) ? async (source: Source) => {
    const assembled = codingExecutionSources({ config: input.config, privateConfig: input.privateConfig,
      sourceCode: typeof source === "string" ? source : formatCodingSourceFiles(source), files: typeof source === "string" ? undefined : source,
      testCode: input.hiddenTests[0].testCode });
    const encoded = Buffer.from(assembled.sourceCode, "utf8").toString("base64");
    const marker = "COGNELO_SYNTAX_OK";
    const result = await runJudge0Submission({ languageId: input.runtime.languageId,
      ...(assembled.files ? { ...assembled, syntaxOnly: true } : {
        sourceCode: `import base64\ncompile(base64.b64decode("${encoded}"), "<student>", "exec", 0, True)\nprint("${marker}")` }),
      expectedOutput: marker + "\n", cpuTimeLimit: 2, wallTimeLimit: 5, memoryLimitKb: 128000 });
    return result.status?.id === 3 && (result.stdout ?? "").trim() === marker;
  } : undefined;
  const template = input.files ? input.files.map(file => file.blankTemplate ?? "").join("\n") : response.blankTemplate;
  const { grading, combined, reviewRequired } = await gradeCodingBlanks({ template, assembleSource, sourceKey: key,
    answers: response.blankAnswers, referenceAnswers: input.privateConfig.blankReferenceAnswers ?? {}, checkSyntax, runSuite });
  if (input.files) for (const outcome of grading.outcomes) outcome.fileName = input.files.find(file => codingBlankIds(file.blankTemplate ?? "").includes(outcome.id))?.name;
  // Compilation is part of the first sandbox test for compiled runtimes; never enable learner compiler options.
  if (grading.syntaxPassed === null && combined) grading.syntaxPassed = !combined.summary.tests.some(test => test.statusId === 6);
  const tests = (combined?.summary.tests ?? []).map(test => ({ ...test, message: null }));
  return {
    summary: { judge0LanguageName: input.runtime.languageName, executionMode: input.config.executionMode, phase: "finished",
      accepted: reviewRequired ? null : grading.correct === grading.total, gradingPending: reviewRequired,
      reviewRequired, blankGrading: grading, outputTruncated: false,
      testCount: combined?.summary.testCount ?? 0, passedCount: combined?.summary.passedCount ?? 0,
      earnedWeight: grading.correct, totalWeight: grading.total, hiddenTestCount: input.hiddenTests.length, tests },
    // Substitutions can appear in stdout/compiler diagnostics; retain only original student source on the execution.
    firstFailureMessage: reviewRequired ? "Automatic checks require teacher review." : grading.correct < grading.total ? "Some code blanks did not pass the checks." : null,
    latestToken: null, latestStdout: null, latestStderr: null, latestCompileOutput: null,
    latestStatusId: null, latestStatusLabel: null, latestTime: null, latestMemory: null
  };
}

async function executeHiddenTests(input: {
  config: ReturnType<typeof parseCodingExerciseConfig>;
  privateConfig: CodingExercisePrivateConfig;
  runtime: Awaited<ReturnType<typeof resolveJudge0Language>>;
  hiddenTests: HiddenTestCase[];
  sourceCode: string;
  files?: CodingSourceFile[];
  stopAfterFailure?: boolean;
  stopAfterCompilationFailure?: boolean;
}) {
  const { config, privateConfig, runtime, hiddenTests } = input;
  const testResults = [];
  let totalWeight = 0;
  let earnedWeight = 0;
  let firstFailureMessage: string | null = null;
  let latestToken: string | null = null;
  let latestStdout: string | null = null;
  let latestStderr: string | null = null;
  let latestCompileOutput: string | null = null;
  let latestStatusId: number | null = null;
  let latestStatusLabel: string | null = null;
  let latestTime: string | null = null;
  let latestMemory: number | null = null;
  let outputTruncated = false;

  for (const hiddenTest of hiddenTests) {
    totalWeight += hiddenTest.weight;
    const executionSources = codingExecutionSources({ config, privateConfig, sourceCode: input.sourceCode,
      files: input.files, testCode: hiddenTest.testCode });
    const result = await runJudge0Submission({
      languageId: runtime.languageId,
      ...executionSources,
      stdin: hiddenTest.stdin,
      expectedOutput: getJudge0ExpectedOutput(hiddenTest.expectedOutput, hiddenTest),
      cpuTimeLimit: getCodingExerciseCpuTimeLimit(config.maxEditorSeconds),
      wallTimeLimit: 10,
      memoryLimitKb: 128000
    });
    const comparison = evaluateJudge0Result(result, hiddenTest.expectedOutput, hiddenTest);
    const savedOutput = capJudge0Output(result);
    const testMessage = capExecutionText(
      result.message ?? result.stderr ?? result.compile_output ?? comparison.message ?? null,
      MAX_EXECUTION_MESSAGE_BYTES
    );
    outputTruncated ||= savedOutput.outputTruncated || testMessage.truncated;
    const passed = comparison.matched;
    if (passed) earnedWeight += hiddenTest.weight;
    else if (!firstFailureMessage) {
      firstFailureMessage = capExecutionText(
        result.message ?? result.stderr ?? result.compile_output ?? comparison.message ?? result.status?.description ?? "Hidden test failed.",
        MAX_EXECUTION_MESSAGE_BYTES
      ).value ?? null;
    }
    latestToken = result.token;
    latestStdout = savedOutput.stdout ?? null;
    latestStderr = savedOutput.stderr ?? null;
    latestCompileOutput = savedOutput.compileOutput ?? null;
    latestStatusId = result.status?.id ?? null;
    latestStatusLabel = result.status?.description ?? null;
    latestTime = result.time ?? null;
    latestMemory = result.memory ?? null;
    testResults.push({
      id: hiddenTest.id,
      name: hiddenTest.name,
      passed,
      weight: hiddenTest.weight,
      statusId: result.status?.id ?? null,
      statusLabel: result.status?.description ?? null,
      message: testMessage.value ?? null,
      outputMatchMode: hiddenTest.outputMatchMode,
      containsLinesOrderMatters: hiddenTest.containsLinesOrderMatters,
      timeSeconds: result.time ?? null,
      memoryKb: result.memory ?? null
    });
    if ((!passed && input.stopAfterFailure) || (result.status?.id === 6 && input.stopAfterCompilationFailure)) break;
  }

  return {
    summary: {
      judge0LanguageName: runtime.languageName,
      executionMode: config.executionMode,
      phase: "finished",
      accepted: totalWeight > 0 ? earnedWeight === totalWeight : null,
      gradingPending: totalWeight === 0,
      outputTruncated,
      testCount: hiddenTests.length,
      passedCount: testResults.filter((test) => test.passed).length,
      earnedWeight,
      totalWeight,
      tests: testResults
    },
    firstFailureMessage,
    latestToken,
    latestStdout,
    latestStderr,
    latestCompileOutput,
    latestStatusId,
    latestStatusLabel,
    latestTime,
    latestMemory
  };
}

export async function getLatestCodingExerciseTestResult(input: {
  activityId: string;
  executionId: string;
  originalResultSummary: unknown;
}) {
  const latest = await prisma.pluginCodingExerciseTestEvaluation.findFirst({
    where: { activityId: input.activityId, executionId: input.executionId, status: "completed" },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }], select: { id: true, resultSummary: true }
  });
  return {
    resultSummary: capExecutionResultSummary(latest?.resultSummary ?? input.originalResultSummary).value,
    testEvaluationId: latest?.id ?? null
  };
}

export async function regradeCodingExerciseTests(input: {
  activityId: string;
  executionId: string;
  actorUserId: string;
  activityConfig: unknown;
}) {
  const execution = await prisma.pluginCodingExerciseExecution.findFirst({
    where: { id: input.executionId, activityId: input.activityId, kind: "submit" }
  });
  if (!execution) {
    throw new AppError(404, "CODING_EXERCISE_EXECUTION_NOT_FOUND", "The coding exercise submission was not found.");
  }
  if (isCodingExerciseOperationalFailure(execution)) {
    throw new AppError(503, "CODING_EXERCISE_RESULT_UNAVAILABLE", "This submission was interrupted by the code execution service and cannot be regraded.");
  }
  let config = parseCodingExerciseConfig(input.activityConfig);
  let privateConfig = await getCodingExercisePrivateConfig({ activityId: input.activityId });
  if (privateConfig.aiFeedback.testsEnabled === false) return {
    testEvaluationId: null,
    resultSummary: { earnedWeight: 0, totalWeight: 0, testsEnabled: false },
    feedbackConfig: privateConfig.aiFeedback
  };
  let runtime = await resolveJudge0Language(config.language);
  const hiddenTests = (await prisma.pluginCodingExerciseHiddenTest.findMany({
    where: { activityId: input.activityId, isEnabled: true },
    orderBy: [{ orderIndex: "asc" }, { createdAt: "asc" }]
  })).map(toHiddenTestCase);
  if (!hiddenTests.length) {
    throw new AppError(400, "HIDDEN_TESTS_REQUIRED", "This coding exercise does not have any enabled hidden tests yet.");
  }
  const blankResponse = readCodingBlankResponse(normalizeResultSummary(execution.resultSummary).blankResponse);
  let checkReference = false;
  let referenceFiles: CodingSourceFile[] | undefined;
  const originalFiles = readCodingSourceFiles(execution.sourceFiles);
  if (execution.sourceFiles != null && !originalFiles) throw new AppError(409, "CODING_EXERCISE_PROJECT_RESPONSE_INVALID", "The saved file snapshot is invalid. Review this response manually.");
  let legacyReferenceSource: string | undefined;
  let legacyContextRevisionId: string | undefined;
  if (config.files && !originalFiles) {
    const prior = await prisma.pluginCodingExerciseAuthoringRevision.findFirst({ where: { activityId: input.activityId,
      createdAt: { lte: execution.createdAt } }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], select: { id: true, nextValue: true } });
    let historical = normalizeResultSummary(prior?.nextValue);
    legacyContextRevisionId = prior?.id;
    if (typeof historical.referenceSolution !== "string") {
      const next = await prisma.pluginCodingExerciseAuthoringRevision.findFirst({ where: { activityId: input.activityId,
        createdAt: { gt: execution.createdAt } }, orderBy: [{ createdAt: "asc" }, { id: "asc" }], select: { id: true, previousValue: true } });
      const reference = normalizeResultSummary(normalizeResultSummary(next?.previousValue).referenceSolution);
      historical = { referenceSolution: reference.sourceCode, privateConfig: reference.privateConfig };
      legacyContextRevisionId = next?.id;
    }
    const oldPrivate = normalizeResultSummary(historical.privateConfig);
    if (typeof historical.referenceSolution !== "string" || !historical.referenceSolution.trim() || oldPrivate.fileSources) {
      throw new AppError(409, "CODING_EXERCISE_PROJECT_REFERENCE_UNAVAILABLE", "The original single-file reference context is unavailable. Review this response manually; its grade has been retained.");
    }
    legacyReferenceSource = historical.referenceSolution;
    privateConfig = parseCodingExercisePrivateConfig({ ...oldPrivate, aiFeedback: privateConfig.aiFeedback });
    config = { ...config, files: undefined, language: execution.languageKey, responseMode: blankResponse ? "blanks" : "code",
      blankTemplate: blankResponse?.blankTemplate };
    runtime = await resolveJudge0Language(config.language);
  }
  if (originalFiles && !blankResponse) config = { ...config, responseMode: "code" };
  const layout = (files: Array<{ id: string; name: string; blankTemplate?: string }>) => JSON.stringify(files.map(file => ({ id: file.id, name: file.name, blankTemplate: blankResponse ? file.blankTemplate : undefined })));
  if (originalFiles && (!config.files || layout(originalFiles) !== layout(config.files))) {
    const original = await prisma.pluginCodingExerciseTestEvaluation.findFirst({ where: { activityId: input.activityId,
      executionId: input.executionId, status: "completed" }, orderBy: [{ createdAt: "asc" }, { id: "asc" }], select: { configSnapshot: true } });
    const snapshot = normalizeResultSummary(original?.configSnapshot);
    const savedValue = normalizeResultSummary(snapshot.activityConfig);
    if (!Array.isArray(savedValue.files)) throw new AppError(409, "CODING_EXERCISE_PROJECT_REFERENCE_UNAVAILABLE", "The original file reference snapshot is unavailable.");
    const saved = parseCodingExerciseConfig(savedValue);
    const oldPrivate = parseCodingExercisePrivateConfig(snapshot.privateConfig);
    if (!saved.files || layout(originalFiles) !== layout(saved.files) || !oldPrivate.fileSources || saved.files.some(file => !oldPrivate.fileSources?.[file.id])) {
      throw new AppError(409, "CODING_EXERCISE_PROJECT_REFERENCE_UNAVAILABLE", "The original files no longer have a compatible reference snapshot for regrading.");
    }
    config = { ...config, files: saved.files, blankTemplate: saved.blankTemplate, responseMode: saved.responseMode };
    privateConfig = { ...privateConfig, blankReferenceAnswers: oldPrivate.blankReferenceAnswers,
      fileSources: Object.fromEntries(saved.files.map(file => [file.id, { ...oldPrivate.fileSources![file.id], ...privateConfig.fileSources?.[file.id],
        referenceSolution: oldPrivate.fileSources![file.id].referenceSolution }])) };
    referenceFiles = referenceCodingFiles(config, privateConfig, "");
    checkReference = !!blankResponse;
  }
  if (blankResponse) config = { ...config, responseMode: "blanks" };
  if (!originalFiles && config.responseMode === "blanks" && blankResponse && config.blankTemplate !== blankResponse.blankTemplate) {
    const original = await prisma.pluginCodingExerciseTestEvaluation.findFirst({ where: {
      activityId: input.activityId, executionId: input.executionId, status: "completed"
    }, orderBy: [{ createdAt: "asc" }, { id: "asc" }], select: { configSnapshot: true } });
    const snapshot = normalizeResultSummary(original?.configSnapshot);
    const savedConfig = normalizeResultSummary(snapshot.activityConfig);
    const savedPrivate = normalizeResultSummary(snapshot.privateConfig);
    const references = codingBlankAnswersSchema.safeParse(savedPrivate.blankReferenceAnswers);
    if (savedConfig.blankTemplate !== blankResponse.blankTemplate || !references.success) {
      throw new AppError(409, "CODING_EXERCISE_BLANK_REFERENCE_UNAVAILABLE", "The saved blank layout no longer has a compatible reference completion for automatic regrading.");
    }
    config = { ...config, blankTemplate: blankResponse.blankTemplate };
    privateConfig = { ...privateConfig, blankReferenceAnswers: references.data };
    checkReference = true;
  }
  const evaluation = await prisma.pluginCodingExerciseTestEvaluation.create({
    data: {
      activityId: input.activityId,
      executionId: input.executionId,
      actorUserId: input.actorUserId,
      status: "pending",
      resultSummary: { phase: "pending", testCount: hiddenTests.length },
      configSnapshot: { activityConfig: config, currentActivityConfig: input.activityConfig, privateConfig, hiddenTests, blankResponse, sourceFiles: originalFiles, legacyContextRevisionId, legacyReferenceSource } as Prisma.InputJsonValue
    }
  });
  try {
    const result = await evaluateCodingSubmissionTests({ config, privateConfig, runtime, hiddenTests,
      sourceCode: execution.sourceCode, files: readCodingSourceFiles(execution.sourceFiles) ?? undefined, blankResponse, checkReference, referenceFiles, legacyReferenceSource });
    const completed = await prisma.pluginCodingExerciseTestEvaluation.update({
      where: { id: evaluation.id },
      data: { status: "completed", resultSummary: result.summary as Prisma.InputJsonValue }
    });
    return { testEvaluationId: completed.id, resultSummary: completed.resultSummary, feedbackConfig: privateConfig.aiFeedback };
  } catch (error) {
    await prisma.pluginCodingExerciseTestEvaluation.update({
      where: { id: evaluation.id },
      data: {
        status: "failed",
        resultSummary: { phase: "failed-before-result" },
        error: error instanceof Error ? error.message.slice(0, 8000) : "Unknown Judge0 failure."
      }
    });
    if (error instanceof AppError) throw error;
    throw new AppError(502, "JUDGE0_SUBMISSION_FAILED", "The remote code execution service could not complete the regrade.");
  }
}

export async function getCodingExerciseReferenceSolution(params: { activityId: string }) {
  const referenceSolution = await prisma.pluginCodingExerciseReferenceSolution.findUnique({
    where: { activityId: params.activityId }
  });

  if (!referenceSolution) {
    return null;
  }

  return toReferenceSolutionRecord(referenceSolution);
}

export async function getCodingExercisePrivateConfig(params: { activityId: string }) {
  const referenceSolution = await prisma.pluginCodingExerciseReferenceSolution.findUnique({
    where: { activityId: params.activityId },
    select: { privateConfig: true }
  });

  return parseCodingExercisePrivateConfig(referenceSolution?.privateConfig ?? {});
}

export async function validateReferenceSolutionAgainstHiddenTests(params: {
  activityConfig: unknown;
  sourceCode: string;
  sampleTests: CodingExerciseSampleTest[];
  hiddenTests: HiddenTestCase[];
  privateConfig: CodingExercisePrivateConfig;
  previousValidationSummary?: unknown;
  // Generation may retain other passing cases; ordinary saves remain fail-closed.
  allowPartialResults?: boolean;
}) {
  const config = parseCodingExerciseConfig(params.activityConfig);
  const testsEnabled = params.privateConfig.aiFeedback.testsEnabled !== false;
  const sampleTests = (testsEnabled ? params.sampleTests : []).map((test) => withReferenceValidationFingerprint({
    id: test.id,
    name: test.title.trim() || test.id,
    stdin: test.input,
    expectedOutput: test.output,
    testCode: test.testCode,
    outputMatchMode: test.outputMatchMode,
    containsLinesOrderMatters: test.containsLinesOrderMatters,
    weight: 1
  }, config, params.privateConfig, params.sourceCode));
  const enabledHiddenTests = (testsEnabled ? params.hiddenTests : [])
    .filter((test) => test.isEnabled)
    .map((test) => withReferenceValidationFingerprint({
      id: test.id,
      name: test.name,
      stdin: test.stdin,
      expectedOutput: test.expectedOutput,
      testCode: test.testCode,
      outputMatchMode: test.outputMatchMode,
      containsLinesOrderMatters: test.containsLinesOrderMatters,
      weight: test.weight
    }, config, params.privateConfig, params.sourceCode));
  const allTestsCount = sampleTests.length + enabledHiddenTests.length;

  if (!allTestsCount) {
    return {
      accepted: true,
      judge0LanguageName: null,
      validatedAt: new Date().toISOString(),
      sampleTests: {
        testCount: 0,
        passedCount: 0,
        executedTestCount: 0,
        reusedTestCount: 0,
        tests: []
      },
      hiddenTests: {
        testCount: 0,
        passedCount: 0,
        executedTestCount: 0,
        reusedTestCount: 0,
        earnedWeight: 0,
        totalWeight: 0,
        tests: []
      },
      executedTestCount: 0,
      reusedTestCount: 0
    };
  }

  if (!params.sourceCode.trim()) {
    throw new AppError(
      400,
      "REFERENCE_SOLUTION_REQUIRED",
      "Add a reference solution before saving tests so the test suite can be validated."
    );
  }

  const previousSummary = normalizeValidationRecord(params.previousValidationSummary);
  const samplePlan = planReferenceValidationGroup(sampleTests, previousSummary?.sampleTests);
  const hiddenPlan = planReferenceValidationGroup(enabledHiddenTests, previousSummary?.hiddenTests);
  const dirtyTestCount = samplePlan.dirtyTests.length + hiddenPlan.dirtyTests.length;
  let runtime: Awaited<ReturnType<typeof resolveJudge0Language>> | null = null;
  let sampleExecutedResults: ReferenceValidationTestResult[] = [];
  let hiddenExecutedResults: ReferenceValidationTestResult[] = [];

  if (dirtyTestCount > 0) {
    runtime = await resolveJudge0Language(config.language);
    const executionParams = {
      config,
      privateConfig: params.privateConfig,
      languageId: runtime.languageId,
      sourceCode: params.sourceCode,
      allowPartialResults: params.allowPartialResults,
      cpuTimeLimit: getCodingExerciseCpuTimeLimit(config.maxEditorSeconds)
    };
    sampleExecutedResults = (await validateReferenceSolutionTestGroup({
      ...executionParams,
      tests: samplePlan.dirtyTests
    })).tests;
    hiddenExecutedResults = (await validateReferenceSolutionTestGroup({
      ...executionParams,
      tests: hiddenPlan.dirtyTests
    })).tests;
  }

  const sampleValidation = mergeReferenceValidationGroup(sampleTests, samplePlan.reusedResults, sampleExecutedResults);
  const hiddenValidation = mergeReferenceValidationGroup(enabledHiddenTests, hiddenPlan.reusedResults, hiddenExecutedResults);
  const previousJudge0LanguageName = typeof previousSummary?.judge0LanguageName === "string"
    ? previousSummary.judge0LanguageName
    : null;

  return {
    accepted: sampleValidation.accepted && hiddenValidation.accepted,
    judge0LanguageName: runtime?.languageName ?? previousJudge0LanguageName,
    validatedAt: new Date().toISOString(),
    sampleTests: sampleValidation,
    hiddenTests: hiddenValidation,
    executedTestCount: dirtyTestCount,
    reusedTestCount: allTestsCount - dirtyTestCount
  };
}

function withReferenceValidationFingerprint(
  test: Omit<ReferenceValidationTestCase, "validationFingerprint">,
  config: ReturnType<typeof parseCodingExerciseConfig>,
  privateConfig: CodingExercisePrivateConfig,
  sourceCode: string
): ReferenceValidationTestCase {
  return {
    ...test,
    validationFingerprint: hashCodingExerciseValidationValue({
      version: 1,
      language: config.language,
      executionMode: config.executionMode,
      maxEditorSeconds: config.maxEditorSeconds,
      sourceCode,
      ...(config.files ? { projectExecution: config.files.map(file => ({ id: file.id, name: file.name, templateSource: privateConfig.fileSources?.[file.id]?.templateSource })) } : {}),
      templateSource: privateConfig.templateSource,
      templatePrefix: privateConfig.templatePrefix,
      templateSuffix: privateConfig.templateSuffix,
      stdin: test.stdin,
      expectedOutput: test.expectedOutput,
      testCode: test.testCode,
      outputMatchMode: test.outputMatchMode,
      containsLinesOrderMatters: test.containsLinesOrderMatters
    })
  };
}

function normalizeValidationRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function planReferenceValidationGroup(tests: ReferenceValidationTestCase[], previousGroupValue: unknown) {
  const previousGroup = normalizeValidationRecord(previousGroupValue);
  const previousTests = Array.isArray(previousGroup?.tests) ? previousGroup.tests : [];
  const previousByKey = new Map<string, ReferenceValidationTestResult>();
  for (const value of previousTests) {
    const result = normalizeValidationRecord(value);
    if (
      result &&
      typeof result.id === "string" &&
      typeof result.name === "string" &&
      result.passed === true &&
      typeof result.weight === "number" &&
      typeof result.validationFingerprint === "string"
    ) {
      previousByKey.set(
        referenceValidationResultKey(result.id, result.validationFingerprint),
        result as ReferenceValidationTestResult
      );
    }
  }

  const reusedResults = new Map<string, ReferenceValidationTestResult>();
  const dirtyTests: ReferenceValidationTestCase[] = [];
  for (const test of tests) {
    const resultKey = referenceValidationResultKey(test.id, test.validationFingerprint);
    const previous = previousByKey.get(resultKey);
    if (previous) {
      reusedResults.set(resultKey, previous);
    } else {
      dirtyTests.push(test);
    }
  }
  return { dirtyTests, reusedResults };
}

function mergeReferenceValidationGroup(
  tests: ReferenceValidationTestCase[],
  reusedResults: Map<string, ReferenceValidationTestResult>,
  executedResults: ReferenceValidationTestResult[]
) {
  const executedByKey = new Map(executedResults.map((result) => [
    referenceValidationResultKey(result.id, result.validationFingerprint),
    result
  ]));
  const results = tests.map((test) => {
    const resultKey = referenceValidationResultKey(test.id, test.validationFingerprint);
    const result = executedByKey.get(resultKey) ?? reusedResults.get(resultKey);
    if (!result) {
      throw new Error(`Missing reference validation result for test ${test.id}.`);
    }
    return {
      ...result,
      id: test.id,
      name: test.name,
      weight: test.weight,
      expectedOutput: test.expectedOutput,
      outputMatchMode: test.outputMatchMode,
      containsLinesOrderMatters: test.containsLinesOrderMatters,
      validationFingerprint: test.validationFingerprint
    };
  });
  const totalWeight = tests.reduce((total, test) => total + test.weight, 0);
  const earnedWeight = results.reduce((total, result) => total + (result.passed ? result.weight : 0), 0);
  return {
    accepted: results.every((result) => result.passed),
    testCount: results.length,
    passedCount: results.filter((result) => result.passed).length,
    executedTestCount: executedResults.length,
    reusedTestCount: results.length - executedResults.length,
    earnedWeight,
    totalWeight,
    tests: results
  };
}

function referenceValidationResultKey(id: string, validationFingerprint: string) {
  return `${id}:${validationFingerprint}`;
}

async function validateReferenceSolutionTestGroup(params: {
  tests: ReferenceValidationTestCase[];
  config: ReturnType<typeof parseCodingExerciseConfig>;
  privateConfig: CodingExercisePrivateConfig;
  languageId: number;
  sourceCode: string;
  cpuTimeLimit: number;
  allowPartialResults?: boolean;
}) {
  if (!params.tests.length) {
    return {
      accepted: true,
      testCount: 0,
      passedCount: 0,
      executedTestCount: 0,
      reusedTestCount: 0,
      earnedWeight: 0,
      totalWeight: 0,
      tests: [] as ReferenceValidationTestResult[]
    };
  }

  const testResults: ReferenceValidationTestResult[] = [];
  let totalWeight = 0;
  let earnedWeight = 0;

  for (const testCase of params.tests) {
    assertValidOutputMatcher(testCase.expectedOutput, testCase);
    totalWeight += testCase.weight;
    const executionSources = codingExecutionSources({ config: params.config, privateConfig: params.privateConfig,
      sourceCode: params.sourceCode, files: params.config.files ? referenceCodingFiles(params.config, params.privateConfig, params.sourceCode) : undefined,
      testCode: testCase.testCode });
    let result: Awaited<ReturnType<typeof runJudge0Submission>>;
    try {
      result = await runJudge0Submission({
        languageId: params.languageId,
        ...executionSources,
        stdin: testCase.stdin,
        expectedOutput: getJudge0ExpectedOutput(testCase.expectedOutput, testCase),
        cpuTimeLimit: params.cpuTimeLimit,
        wallTimeLimit: 10,
        memoryLimitKb: 128000
      });
    } catch (error) {
      if (!params.allowPartialResults) throw error;
      testResults.push({
        id: testCase.id,
        name: testCase.name,
        passed: false,
        weight: testCase.weight,
        validationFingerprint: testCase.validationFingerprint,
        statusLabel: "Execution unavailable",
        message: "This generated test could not be validated because execution was unavailable."
      });
      continue;
    }

    const comparison = evaluateJudge0Result(result, testCase.expectedOutput, testCase);
    const savedOutput = capJudge0Output(result);
    const message = capExecutionText(result.message ?? comparison.message, MAX_EXECUTION_MESSAGE_BYTES);
    const passed = comparison.matched;
    if (passed) {
      earnedWeight += testCase.weight;
    }

    testResults.push({
      id: testCase.id,
      name: testCase.name,
      passed,
      weight: testCase.weight,
      statusId: result.status?.id ?? null,
      statusLabel: result.status?.description ?? null,
      expectedOutput: testCase.expectedOutput,
      stdout: savedOutput.stdout ?? null,
      stderr: savedOutput.stderr ?? null,
      compileOutput: savedOutput.compileOutput ?? null,
      message: message.value,
      outputTruncated: savedOutput.outputTruncated || message.truncated,
      outputMatchMode: testCase.outputMatchMode,
      containsLinesOrderMatters: testCase.containsLinesOrderMatters,
      validationFingerprint: testCase.validationFingerprint,
      timeSeconds: result.time ?? null,
      memoryKb: result.memory ?? null
    });
  }

  return {
    accepted: earnedWeight === totalWeight,
    testCount: params.tests.length,
    passedCount: testResults.filter((test) => test.passed).length,
    executedTestCount: params.tests.length,
    reusedTestCount: 0,
    earnedWeight,
    totalWeight,
    tests: testResults
  };
}

function toOutputMatcher(value: {
  outputMatchMode: CodingExerciseOutputMatchMode;
  containsLinesOrderMatters: boolean;
}): CodingExerciseOutputMatcher {
  return {
    outputMatchMode: value.outputMatchMode,
    containsLinesOrderMatters: value.containsLinesOrderMatters
  };
}

function assertValidOutputMatcher(expectedOutput: string, matcher: CodingExerciseOutputMatcher) {
  const message = validateCodingExerciseOutputMatcher(expectedOutput, matcher);
  if (message) {
    throw new AppError(400, "INVALID_OUTPUT_MATCHER", message);
  }
}

function evaluateJudge0Result(
  result: Awaited<ReturnType<typeof runJudge0Submission>>,
  expectedOutput: string,
  matcher: CodingExerciseOutputMatcher,
  compareOutput = true
) {
  if (result.status?.id !== 3) {
    return { matched: false, message: null as string | null };
  }
  if (!compareOutput) {
    return { matched: true, message: null as string | null };
  }
  if (matcher.outputMatchMode === "exact") {
    return { matched: true, message: null as string | null };
  }
  return compareCodingExerciseOutput(expectedOutput, result.stdout ?? "", matcher);
}

function normalizeResultSummary(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function toCodingExerciseExecutionRecord(execution: CodingExerciseExecutionRow) {
  const stdout = capExecutionText(execution.stdout);
  const stderr = capExecutionText(execution.stderr);
  const compileOutput = capExecutionText(execution.compileOutput);
  const message = capExecutionText(execution.message, MAX_EXECUTION_MESSAGE_BYTES);
  const summary = capExecutionResultSummary(normalizeResultSummary(execution.resultSummary));
  const { practiceRunScope: _scope, ...resultSummary } = summary.value as Record<string, unknown>;
  return {
    id: execution.id,
    activityId: execution.activityId,
    userId: execution.userId,
    kind: execution.kind,
    status: execution.status,
    languageKey: execution.languageKey,
    judge0LanguageId: execution.judge0LanguageId,
    sourceCode: execution.sourceCode,
    ...(readCodingSourceFiles(execution.sourceFiles) ? { files: readCodingSourceFiles(execution.sourceFiles)! } : {}),
    judge0Token: execution.judge0Token,
    stdin: execution.stdin ?? "",
    expectedOutput: execution.expectedOutput ?? "",
    stdout: stdout.value,
    stderr: stderr.value,
    compileOutput: compileOutput.value,
    message: message.value,
    outputTruncated: stdout.truncated || stderr.truncated || compileOutput.truncated || message.truncated || summary.truncated || resultSummary.outputTruncated === true,
    timeSeconds: execution.timeSeconds,
    memoryKb: execution.memoryKb,
    judge0StatusId: execution.judge0StatusId,
    judge0StatusLabel: execution.judge0StatusLabel,
    resultSummary,
    createdAt: execution.createdAt.toISOString(),
    updatedAt: execution.updatedAt.toISOString()
  };
}

function previewCodingExecutionRecord(input: Omit<CodingExerciseExecutionRow, "id" | "createdAt" | "updatedAt">) {
  const now = new Date();
  return toCodingExerciseExecutionRecord({
    ...input,
    id: `student-preview-${crypto.randomUUID()}`,
    createdAt: now,
    updatedAt: now
  });
}

function toReferenceSolutionRecord(referenceSolution: {
  sourceCode: string;
  privateConfig: unknown;
  validationSummary: unknown;
  createdAt: Date;
  updatedAt: Date;
}): ReferenceSolutionValidationRecord {
  return {
    sourceCode: referenceSolution.sourceCode,
    privateConfig: parseCodingExercisePrivateConfig(referenceSolution.privateConfig),
    validationSummary: capExecutionResultSummary(normalizeResultSummary(referenceSolution.validationSummary)).value as Record<string, unknown>,
    createdAt: referenceSolution.createdAt.toISOString(),
    updatedAt: referenceSolution.updatedAt.toISOString()
  };
}

function resolveExecutionInput<T extends { sourceCode: string; files?: CodingSourceFile[]; blankAnswers?: Record<string, string>; blankTemplate?: string }>(
  config: ReturnType<typeof parseCodingExerciseConfig>, input: T
): T {
  try {
    if (config.files) return resolveCodingFileInput(config, input);
    if (input.sourceCode.length > 60000) throw new Error("The submitted code exceeds 60,000 characters.");
    const result = resolveCodingBlankInput(config, input);
    delete result.files;
    return result;
  }
  catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(409, "CODING_EXERCISE_BLANK_RESPONSE_INVALID", error instanceof Error ? error.message : "Invalid code blank response.");
  }
}

function blankExecutionSnapshot(input: unknown) {
  const response = readCodingBlankResponse(input);
  return response ? { blankResponse: response } : {};
}

export async function codingExerciseRequiresTeacherReview(activityId: string, executionId: string | null) {
  if (!executionId) return false;
  const execution = await prisma.pluginCodingExerciseExecution.findFirst({ where: { id: executionId, activityId, kind: "submit" }, select: { resultSummary: true } });
  if (!execution) return false;
  const latest = await getLatestCodingExerciseTestResult({ activityId, executionId, originalResultSummary: execution.resultSummary });
  return normalizeResultSummary(latest.resultSummary).reviewRequired === true;
}
