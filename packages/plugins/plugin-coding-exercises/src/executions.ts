import { Prisma, prisma } from "@cognelo/db";
import { getServerEnv } from "@cognelo/config";
import { AppError } from "@cognelo/core";
import { z } from "zod";
import { parseCodingExerciseConfig, type CodingExerciseSampleTest } from "./coding-exercises";
import { resolveJudge0Language, runJudge0Submission } from "./judge0";

type CodingExerciseExecutionRow = {
  id: string;
  activityId: string;
  userId: string;
  kind: "run" | "submit";
  status: "pending" | "completed" | "failed";
  languageKey: string;
  judge0LanguageId: number;
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
      validationSummary: unknown;
      createdAt: Date;
      updatedAt: Date;
    } | null>;
  };
};

export const codingExerciseRunInputSchema = z.object({
  sourceCode: z.string().min(1).max(60000),
  stdin: z.string().max(12000).optional().default(""),
  expectedOutput: z.string().max(12000).optional().default("")
});

export type CodingExerciseRunInput = z.infer<typeof codingExerciseRunInputSchema>;

export const codingExerciseSubmitInputSchema = z.object({
  sourceCode: z.string().min(1).max(60000)
});

type HiddenTestCase = {
  id: string;
  name: string;
  stdin: string;
  expectedOutput: string;
  isEnabled: boolean;
  weight: number;
  orderIndex: number;
};

type ReferenceValidationTestCase = {
  id: string;
  name: string;
  stdin: string;
  expectedOutput: string;
  weight: number;
};

type ReferenceSolutionValidationRecord = {
  sourceCode: string;
  validationSummary: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export async function runCodingExercise(params: {
  activityId: string;
  userId: string;
  activityConfig: unknown;
  input: CodingExerciseRunInput;
}) {
  const env = getServerEnv();
  const config = parseCodingExerciseConfig(params.activityConfig);
  const input = codingExerciseRunInputSchema.parse(params.input);
  const runtime = await resolveJudge0Language(config.language);

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
        phase: "pending"
      } as Prisma.InputJsonValue
    }
  });

  try {
    const result = await runJudge0Submission({
      languageId: runtime.languageId,
      sourceCode: input.sourceCode,
      stdin: input.stdin,
      expectedOutput: input.expectedOutput,
      cpuTimeLimit: Math.min(Math.max(Math.round(config.maxEditorSeconds / 60), 1), 5),
      wallTimeLimit: 10,
      memoryLimitKb: 128000,
      enablePerProcessAndThreadTimeLimit: env.JUDGE0_ENABLE_PER_PROCESS_AND_THREAD_LIMITS,
      enablePerProcessAndThreadMemoryLimit: env.JUDGE0_ENABLE_PER_PROCESS_AND_THREAD_LIMITS
    });

    const normalizedExecution = await codingExerciseExecutionClient.pluginCodingExerciseExecution.update({
      where: { id: pendingExecution.id },
      data: {
        status: result.status?.id === 3 ? "completed" : "failed",
        judge0Token: result.token,
        stdout: result.stdout,
        stderr: result.stderr,
        compileOutput: result.compile_output,
        message: result.message,
        timeSeconds: result.time,
        memoryKb: result.memory ?? undefined,
        judge0StatusId: result.status?.id,
        judge0StatusLabel: result.status?.description,
        resultSummary: {
          judge0LanguageName: runtime.languageName,
          accepted: result.status?.id === 3,
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
          phase: "failed-before-result"
        } as Prisma.InputJsonValue,
        message: error instanceof Error ? error.message : "Unknown Judge0 execution failure."
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

export async function submitCodingExercise(params: {
  activityId: string;
  userId: string;
  activityConfig: unknown;
  input: z.infer<typeof codingExerciseSubmitInputSchema>;
}) {
  const env = getServerEnv();
  const config = parseCodingExerciseConfig(params.activityConfig);
  const input = codingExerciseSubmitInputSchema.parse(params.input);
  const runtime = await resolveJudge0Language(config.language);
  const hiddenTests = await prisma.pluginCodingExerciseHiddenTest.findMany({
    where: { activityId: params.activityId, isEnabled: true },
    orderBy: [{ orderIndex: "asc" }, { createdAt: "asc" }]
  });

  if (!hiddenTests.length) {
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
        phase: "pending",
        testCount: hiddenTests.length
      } as Prisma.InputJsonValue
    }
  });

  try {
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

    for (const hiddenTest of hiddenTests as HiddenTestCase[]) {
      totalWeight += hiddenTest.weight;
      const result = await runJudge0Submission({
        languageId: runtime.languageId,
        sourceCode: input.sourceCode,
        stdin: hiddenTest.stdin,
        expectedOutput: hiddenTest.expectedOutput,
        cpuTimeLimit: Math.min(Math.max(Math.round(config.maxEditorSeconds / 60), 1), 5),
        wallTimeLimit: 10,
        memoryLimitKb: 128000,
        enablePerProcessAndThreadTimeLimit: env.JUDGE0_ENABLE_PER_PROCESS_AND_THREAD_LIMITS,
        enablePerProcessAndThreadMemoryLimit: env.JUDGE0_ENABLE_PER_PROCESS_AND_THREAD_LIMITS
      });

      const passed = result.status?.id === 3;
      if (passed) {
        earnedWeight += hiddenTest.weight;
      } else if (!firstFailureMessage) {
        firstFailureMessage = result.message ?? result.stderr ?? result.compile_output ?? result.status?.description ?? "Hidden test failed.";
      }

      latestToken = result.token;
      latestStdout = result.stdout ?? null;
      latestStderr = result.stderr ?? null;
      latestCompileOutput = result.compile_output ?? null;
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
        message: result.message ?? result.stderr ?? result.compile_output ?? null,
        timeSeconds: result.time ?? null,
        memoryKb: result.memory ?? null
      });
    }

    const accepted = earnedWeight === totalWeight;
    const updatedExecution = await codingExerciseExecutionClient.pluginCodingExerciseExecution.update({
      where: { id: pendingExecution.id },
      data: {
        status: accepted ? "completed" : "failed",
        judge0Token: latestToken,
        stdout: latestStdout,
        stderr: latestStderr,
        compileOutput: latestCompileOutput,
        message: firstFailureMessage,
        timeSeconds: latestTime,
        memoryKb: latestMemory ?? undefined,
        judge0StatusId: latestStatusId ?? undefined,
        judge0StatusLabel: latestStatusLabel ?? undefined,
        resultSummary: {
          judge0LanguageName: runtime.languageName,
          phase: "finished",
          accepted,
          testCount: hiddenTests.length,
          passedCount: testResults.filter((test) => test.passed).length,
          earnedWeight,
          totalWeight,
          tests: testResults
        } as Prisma.InputJsonValue
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
        message: error instanceof Error ? error.message : "Unknown Judge0 submission failure."
      }
    });

    if (error instanceof AppError) {
      throw error;
    }

    throw new AppError(502, "JUDGE0_SUBMISSION_FAILED", "The remote code execution service could not complete the submission.");
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

export async function validateReferenceSolutionAgainstHiddenTests(params: {
  activityConfig: unknown;
  sourceCode: string;
  sampleTests: CodingExerciseSampleTest[];
  hiddenTests: HiddenTestCase[];
}) {
  const config = parseCodingExerciseConfig(params.activityConfig);
  const sampleTests = params.sampleTests.map((test) => ({
    id: test.id,
    name: test.explanation.trim() || test.id,
    stdin: test.input,
    expectedOutput: test.output,
    weight: 1
  }));
  const enabledHiddenTests = params.hiddenTests
    .filter((test) => test.isEnabled)
    .map((test) => ({
      id: test.id,
      name: test.name,
      stdin: test.stdin,
      expectedOutput: test.expectedOutput,
      weight: test.weight
    }));
  const allTestsCount = sampleTests.length + enabledHiddenTests.length;

  if (!allTestsCount) {
    return {
      accepted: true,
      judge0LanguageName: null,
      validatedAt: new Date().toISOString(),
      sampleTests: {
        testCount: 0,
        passedCount: 0,
        tests: []
      },
      hiddenTests: {
        testCount: 0,
        passedCount: 0,
        earnedWeight: 0,
        totalWeight: 0,
        tests: []
      }
    };
  }

  if (!params.sourceCode.trim()) {
    throw new AppError(
      400,
      "REFERENCE_SOLUTION_REQUIRED",
      "Add a reference solution before saving tests so the test suite can be validated."
    );
  }

  const env = getServerEnv();
  const runtime = await resolveJudge0Language(config.language);
  const sampleValidation = await validateReferenceSolutionTestGroup({
    tests: sampleTests,
    languageId: runtime.languageId,
    sourceCode: params.sourceCode,
    cpuTimeLimit: Math.min(Math.max(Math.round(config.maxEditorSeconds / 60), 1), 5),
    env
  });
  const hiddenValidation = await validateReferenceSolutionTestGroup({
    tests: enabledHiddenTests,
    languageId: runtime.languageId,
    sourceCode: params.sourceCode,
    cpuTimeLimit: Math.min(Math.max(Math.round(config.maxEditorSeconds / 60), 1), 5),
    env
  });

  return {
    accepted: sampleValidation.accepted && hiddenValidation.accepted,
    judge0LanguageName: runtime.languageName,
    validatedAt: new Date().toISOString(),
    sampleTests: sampleValidation,
    hiddenTests: hiddenValidation
  };
}

async function validateReferenceSolutionTestGroup(params: {
  tests: ReferenceValidationTestCase[];
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
      earnedWeight: 0,
      totalWeight: 0,
      tests: []
    };
  }

  const testResults = [];
  let totalWeight = 0;
  let earnedWeight = 0;

  for (const testCase of params.tests) {
    totalWeight += testCase.weight;
    const result = await runJudge0Submission({
      languageId: params.languageId,
      sourceCode: params.sourceCode,
      stdin: testCase.stdin,
      expectedOutput: testCase.expectedOutput,
      cpuTimeLimit: params.cpuTimeLimit,
      wallTimeLimit: 10,
      memoryLimitKb: 128000,
      enablePerProcessAndThreadTimeLimit: params.env.JUDGE0_ENABLE_PER_PROCESS_AND_THREAD_LIMITS,
      enablePerProcessAndThreadMemoryLimit: params.env.JUDGE0_ENABLE_PER_PROCESS_AND_THREAD_LIMITS
    });

    const passed = result.status?.id === 3;
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
      stdout: result.stdout ?? null,
      stderr: result.stderr ?? null,
      compileOutput: result.compile_output ?? null,
      message: result.message ?? null,
      timeSeconds: result.time ?? null,
      memoryKb: result.memory ?? null
    });
  }

  return {
    accepted: earnedWeight === totalWeight,
    testCount: params.tests.length,
    passedCount: testResults.filter((test) => test.passed).length,
    earnedWeight,
    totalWeight,
    tests: testResults
  };
}

function normalizeResultSummary(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function toCodingExerciseExecutionRecord(execution: CodingExerciseExecutionRow) {
  return {
    id: execution.id,
    activityId: execution.activityId,
    userId: execution.userId,
    kind: execution.kind,
    status: execution.status,
    languageKey: execution.languageKey,
    judge0LanguageId: execution.judge0LanguageId,
    judge0Token: execution.judge0Token,
    stdin: execution.stdin ?? "",
    expectedOutput: execution.expectedOutput ?? "",
    stdout: execution.stdout,
    stderr: execution.stderr,
    compileOutput: execution.compileOutput,
    message: execution.message,
    timeSeconds: execution.timeSeconds,
    memoryKb: execution.memoryKb,
    judge0StatusId: execution.judge0StatusId,
    judge0StatusLabel: execution.judge0StatusLabel,
    resultSummary: normalizeResultSummary(execution.resultSummary),
    createdAt: execution.createdAt.toISOString(),
    updatedAt: execution.updatedAt.toISOString()
  };
}

function toReferenceSolutionRecord(referenceSolution: {
  sourceCode: string;
  validationSummary: unknown;
  createdAt: Date;
  updatedAt: Date;
}): ReferenceSolutionValidationRecord {
  return {
    sourceCode: referenceSolution.sourceCode,
    validationSummary: normalizeResultSummary(referenceSolution.validationSummary),
    createdAt: referenceSolution.createdAt.toISOString(),
    updatedAt: referenceSolution.updatedAt.toISOString()
  };
}
