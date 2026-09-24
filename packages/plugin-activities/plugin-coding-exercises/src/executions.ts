import { getServerEnv } from "@cognelo/config";
import { AppError } from "@cognelo/core";
import { z } from "zod";
import {
  buildCodingExerciseSource,
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

const codingExerciseStudentSourceSchema = z
  .string()
  .max(60000)
  .refine((sourceCode) => sourceCode.trim().length > 0, "Enter code before running or submitting.");

export const codingExerciseRunInputSchema = z.object({
  sourceCode: codingExerciseStudentSourceSchema,
  stdin: z.string().max(12000).optional().default(""),
  expectedOutput: z.string().max(12000).optional().default(""),
  testCode: z.string().max(40000).optional().default(""),
  outputMatchMode: codingExerciseOutputMatchModeSchema.optional().default("exact"),
  containsLinesOrderMatters: z.boolean().optional().default(false),
  compareOutput: z.boolean().optional().default(true)
});

export type CodingExerciseRunInput = z.input<typeof codingExerciseRunInputSchema>;

export const codingExerciseSubmitInputSchema = z.object({
  sourceCode: codingExerciseStudentSourceSchema
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
  return {
    id: test.id,
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
}) {
  const env = getServerEnv();
  const config = parseCodingExerciseConfig(params.activityConfig);
  const input = codingExerciseRunInputSchema.parse(params.input);
  const outputMatcher = toOutputMatcher(input);
  if (input.compareOutput) {
    assertValidOutputMatcher(input.expectedOutput, outputMatcher);
  }
  const privateConfig = await getCodingExercisePrivateConfig({ activityId: params.activityId });
  const runtime = await resolveJudge0Language(config.language);
  const sourceCode = buildCodingExerciseSource({
    config,
    privateConfig,
    studentSourceCode: input.sourceCode,
    testCode: input.compareOutput ? input.testCode : ""
  });

  const pendingExecution = await codingExerciseExecutionClient.pluginCodingExerciseExecution.create({
    data: {
      activityId: params.activityId,
      userId: params.userId,
      kind: "run",
      status: "pending",
      languageKey: runtime.languageKey,
      judge0LanguageId: runtime.languageId,
      sourceCode: input.sourceCode,
      stdin: input.stdin,
      expectedOutput: input.expectedOutput,
      resultSummary: {
        judge0LanguageName: runtime.languageName,
        executionMode: config.executionMode,
        phase: "pending"
      } as Prisma.InputJsonValue
    }
  });

  try {
    const result = await runJudge0Submission({
      languageId: runtime.languageId,
      sourceCode,
      stdin: input.stdin,
      expectedOutput: input.compareOutput ? getJudge0ExpectedOutput(input.expectedOutput, outputMatcher) : undefined,
      cpuTimeLimit: Math.min(Math.max(Math.round(config.maxEditorSeconds / 60), 1), 5),
      wallTimeLimit: 10,
      memoryLimitKb: 128000,
      enablePerProcessAndThreadTimeLimit: env.JUDGE0_ENABLE_PER_PROCESS_AND_THREAD_LIMITS,
      enablePerProcessAndThreadMemoryLimit: env.JUDGE0_ENABLE_PER_PROCESS_AND_THREAD_LIMITS
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
  if (!params.userIds.length) return [];
  const executions = await codingExerciseExecutionClient.pluginCodingExerciseExecution.findMany({
    where: { activityId: params.activityId, userId: { in: params.userIds }, kind: "submit" },
    orderBy: [{ createdAt: "desc" }]
  });
  const seen = new Set<string>();
  return executions.flatMap((execution) => {
    const record = toCodingExerciseExecutionRecord(execution);
    if (isCodingExerciseOperationalFailure(record)) return [];
    if (seen.has(execution.userId)) return [];
    seen.add(execution.userId);
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
  const input = codingExerciseSubmitInputSchema.parse(params.input);
  const privateConfig = await getCodingExercisePrivateConfig({ activityId: params.activityId });
  const runtime = await resolveJudge0Language(config.language);
  const hiddenTests = await prisma.pluginCodingExerciseHiddenTest.findMany({
    where: { activityId: params.activityId, isEnabled: true },
    orderBy: [{ orderIndex: "asc" }, { createdAt: "asc" }]
  });
  const normalizedHiddenTests = hiddenTests.map((hiddenTest) => toHiddenTestCase(hiddenTest));

  if (!normalizedHiddenTests.length) {
    throw new AppError(400, "HIDDEN_TESTS_REQUIRED", "This coding exercise does not have any enabled hidden tests yet.");
  }

  const pendingExecution = await codingExerciseExecutionClient.pluginCodingExerciseExecution.create({
    data: {
      activityId: params.activityId,
      userId: params.userId,
      kind: "submit",
      status: "pending",
      languageKey: runtime.languageKey,
      judge0LanguageId: runtime.languageId,
      sourceCode: input.sourceCode,
      stdin: "",
      expectedOutput: "",
      resultSummary: {
        judge0LanguageName: runtime.languageName,
        executionMode: config.executionMode,
        phase: "pending",
        testCount: normalizedHiddenTests.length
      } as Prisma.InputJsonValue
    }
  });

  try {
    const evaluated = await executeHiddenTests({ config, privateConfig, runtime, hiddenTests: normalizedHiddenTests, sourceCode: input.sourceCode });
    const updatedExecution = await codingExerciseExecutionClient.pluginCodingExerciseExecution.update({
      where: { id: pendingExecution.id },
      data: {
        status: evaluated.summary.accepted ? "completed" : "failed",
        judge0Token: evaluated.latestToken,
        stdout: evaluated.latestStdout,
        stderr: evaluated.latestStderr,
        compileOutput: evaluated.latestCompileOutput,
        message: evaluated.firstFailureMessage,
        timeSeconds: evaluated.latestTime,
        memoryKb: evaluated.latestMemory ?? undefined,
        judge0StatusId: evaluated.latestStatusId ?? undefined,
        judge0StatusLabel: evaluated.latestStatusLabel ?? undefined,
        resultSummary: evaluated.summary as Prisma.InputJsonValue
      }
    });

    return toCodingExerciseExecutionRecord(updatedExecution);
  } catch (error) {
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

async function executeHiddenTests(input: {
  config: ReturnType<typeof parseCodingExerciseConfig>;
  privateConfig: CodingExercisePrivateConfig;
  runtime: Awaited<ReturnType<typeof resolveJudge0Language>>;
  hiddenTests: HiddenTestCase[];
  sourceCode: string;
}) {
  const env = getServerEnv();
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
    const sourceCode = buildCodingExerciseSource({
      config,
      privateConfig,
      studentSourceCode: input.sourceCode,
      testCode: hiddenTest.testCode
    });
    const result = await runJudge0Submission({
      languageId: runtime.languageId,
      sourceCode,
      stdin: hiddenTest.stdin,
      expectedOutput: getJudge0ExpectedOutput(hiddenTest.expectedOutput, hiddenTest),
      cpuTimeLimit: Math.min(Math.max(Math.round(config.maxEditorSeconds / 60), 1), 5),
      wallTimeLimit: 10,
      memoryLimitKb: 128000,
      enablePerProcessAndThreadTimeLimit: env.JUDGE0_ENABLE_PER_PROCESS_AND_THREAD_LIMITS,
      enablePerProcessAndThreadMemoryLimit: env.JUDGE0_ENABLE_PER_PROCESS_AND_THREAD_LIMITS
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
  }

  return {
    summary: {
      judge0LanguageName: runtime.languageName,
      executionMode: config.executionMode,
      phase: "finished",
      accepted: earnedWeight === totalWeight,
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
    orderBy: [{ createdAt: "desc" }, { id: "desc" }]
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
  const config = parseCodingExerciseConfig(input.activityConfig);
  const privateConfig = await getCodingExercisePrivateConfig({ activityId: input.activityId });
  const runtime = await resolveJudge0Language(config.language);
  const hiddenTests = (await prisma.pluginCodingExerciseHiddenTest.findMany({
    where: { activityId: input.activityId, isEnabled: true },
    orderBy: [{ orderIndex: "asc" }, { createdAt: "asc" }]
  })).map(toHiddenTestCase);
  if (!hiddenTests.length) {
    throw new AppError(400, "HIDDEN_TESTS_REQUIRED", "This coding exercise does not have any enabled hidden tests yet.");
  }
  const evaluation = await prisma.pluginCodingExerciseTestEvaluation.create({
    data: {
      activityId: input.activityId,
      executionId: input.executionId,
      actorUserId: input.actorUserId,
      status: "pending",
      resultSummary: { phase: "pending", testCount: hiddenTests.length },
      configSnapshot: { activityConfig: config, privateConfig, hiddenTests } as Prisma.InputJsonValue
    }
  });
  try {
    const result = await executeHiddenTests({ config, privateConfig, runtime, hiddenTests, sourceCode: execution.sourceCode });
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
}) {
  const config = parseCodingExerciseConfig(params.activityConfig);
  const sampleTests = params.sampleTests.map((test) => withReferenceValidationFingerprint({
    id: test.id,
    name: test.title.trim() || test.id,
    stdin: test.input,
    expectedOutput: test.output,
    testCode: test.testCode,
    outputMatchMode: test.outputMatchMode,
    containsLinesOrderMatters: test.containsLinesOrderMatters,
    weight: 1
  }, config, params.privateConfig, params.sourceCode));
  const enabledHiddenTests = params.hiddenTests
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
    const env = getServerEnv();
    runtime = await resolveJudge0Language(config.language);
    const executionParams = {
      config,
      privateConfig: params.privateConfig,
      languageId: runtime.languageId,
      sourceCode: params.sourceCode,
      cpuTimeLimit: Math.min(Math.max(Math.round(config.maxEditorSeconds / 60), 1), 5),
      env
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
  env: ReturnType<typeof getServerEnv>;
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
    const composedSourceCode = buildCodingExerciseSource({
      config: params.config,
      privateConfig: params.privateConfig,
      studentSourceCode: params.sourceCode,
      testCode: testCase.testCode
    });
    const result = await runJudge0Submission({
      languageId: params.languageId,
      sourceCode: composedSourceCode,
      stdin: testCase.stdin,
      expectedOutput: getJudge0ExpectedOutput(testCase.expectedOutput, testCase),
      cpuTimeLimit: params.cpuTimeLimit,
      wallTimeLimit: 10,
      memoryLimitKb: 128000,
      enablePerProcessAndThreadTimeLimit: params.env.JUDGE0_ENABLE_PER_PROCESS_AND_THREAD_LIMITS,
      enablePerProcessAndThreadMemoryLimit: params.env.JUDGE0_ENABLE_PER_PROCESS_AND_THREAD_LIMITS
    });

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
  const resultSummary = summary.value as Record<string, unknown>;
  return {
    id: execution.id,
    activityId: execution.activityId,
    userId: execution.userId,
    kind: execution.kind,
    status: execution.status,
    languageKey: execution.languageKey,
    judge0LanguageId: execution.judge0LanguageId,
    sourceCode: execution.sourceCode,
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
