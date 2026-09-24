import { beforeEach, describe, expect, it, vi } from "vitest";
import { MAX_EXECUTION_OUTPUT_BYTES } from "./execution-output";

type MockHiddenTest = {
  id: string;
  name: string;
  stdin: string;
  expectedOutput: string;
  isEnabled: boolean;
  weight: number;
  orderIndex: number;
  metadata: Record<string, unknown>;
};

const dbMocks = vi.hoisted(() => {
  const now = new Date("2026-05-14T12:00:00.000Z");
  const executionRow = (overrides: Record<string, unknown> = {}) => ({
    id: "execution-1",
    activityId: "activity-1",
    userId: "student-1",
    kind: "run",
    status: "pending",
    languageKey: "python",
    judge0LanguageId: 71,
    sourceCode: "print(1)",
    judge0Token: null,
    stdin: "",
    expectedOutput: "",
    stdout: null,
    stderr: null,
    compileOutput: null,
    message: null,
    timeSeconds: null,
    memoryKb: null,
    judge0StatusId: null,
    judge0StatusLabel: null,
    resultSummary: {},
    createdAt: now,
    updatedAt: now,
    ...overrides
  });
  const state = {
    executions: [] as Array<Record<string, unknown>>,
    hiddenTests: [
      {
        id: "hidden-1",
        name: "Passes sample shape",
        stdin: "1",
        expectedOutput: "2",
        isEnabled: true,
        weight: 2,
        orderIndex: 0,
        metadata: { testCode: "" }
      },
      {
        id: "hidden-2",
        name: "Handles another value",
        stdin: "2",
        expectedOutput: "4",
        isEnabled: true,
        weight: 3,
        orderIndex: 1,
        metadata: { testCode: "" }
      }
    ] as MockHiddenTest[]
  };

  return {
    executionRow,
    get hiddenTests() {
      return state.hiddenTests;
    },
    set hiddenTests(value: MockHiddenTest[]) {
      state.hiddenTests = value;
    },
    executions: state.executions,
    prisma: {
    pluginCodingExerciseExecution: {
      findFirst: vi.fn(() => Promise.resolve(executionRow({
        kind: "submit",
        status: "completed",
        resultSummary: { phase: "finished", earnedWeight: 1, totalWeight: 2 }
      }))),
      create: vi.fn((args: { data: Record<string, unknown> }) =>
        Promise.resolve({
          id: "execution-1",
          activityId: args.data.activityId,
          userId: args.data.userId,
          kind: args.data.kind,
          status: args.data.status,
          languageKey: args.data.languageKey,
          judge0LanguageId: args.data.judge0LanguageId,
          sourceCode: args.data.sourceCode,
          judge0Token: null,
          stdin: args.data.stdin ?? "",
          expectedOutput: args.data.expectedOutput ?? "",
          stdout: null,
          stderr: null,
          compileOutput: null,
          message: null,
          timeSeconds: null,
          memoryKb: null,
          judge0StatusId: null,
          judge0StatusLabel: null,
          resultSummary: args.data.resultSummary,
          createdAt: now,
          updatedAt: now
        })
      ),
      update: vi.fn((args: { data: Record<string, unknown> }) =>
        Promise.resolve(
          executionRow({
            kind: args.data.resultSummary && typeof args.data.resultSummary === "object" && "testCount" in args.data.resultSummary ? "submit" : "run",
            status: args.data.status,
            judge0Token: args.data.judge0Token ?? null,
            stdout: args.data.stdout ?? null,
            stderr: args.data.stderr ?? null,
            compileOutput: args.data.compileOutput ?? null,
            message: args.data.message ?? null,
            timeSeconds: args.data.timeSeconds ?? null,
            memoryKb: args.data.memoryKb ?? null,
            judge0StatusId: args.data.judge0StatusId ?? null,
            judge0StatusLabel: args.data.judge0StatusLabel ?? null,
            resultSummary: args.data.resultSummary
          })
        )
      ),
      findMany: vi.fn(() => Promise.resolve([executionRow({ id: "recent-1", status: "completed" })]))
    },
    pluginCodingExerciseReferenceSolution: {
      findUnique: vi.fn(() =>
        Promise.resolve({
          sourceCode: "print('reference')",
          privateConfig: { templateSource: "{{ STUDENT_CODE }}" },
          validationSummary: { accepted: true },
          createdAt: now,
          updatedAt: now
        })
      )
    },
    pluginCodingExerciseHiddenTest: {
      findMany: vi.fn(() => Promise.resolve(state.hiddenTests))
    },
    pluginCodingExerciseTestEvaluation: {
      create: vi.fn(() => Promise.resolve({ id: "test-evaluation-1" })),
      update: vi.fn((args: { data: Record<string, unknown> }) => Promise.resolve({
        id: "test-evaluation-1",
        resultSummary: args.data.resultSummary
      })),
      findFirst: vi.fn(() => Promise.resolve(null))
    }
    }
  };
});

const judge0Mocks = vi.hoisted(() => ({
  resolveJudge0Language: vi.fn(() =>
    Promise.resolve({
      languageKey: "python",
      languageId: 71,
      languageName: "Python"
    })
  ),
  runJudge0Submission: vi.fn()
}));

vi.mock("@cognelo/config", () => ({
  getServerEnv: () => ({
    JUDGE0_ENABLE_PER_PROCESS_AND_THREAD_LIMITS: false
  })
}));

vi.mock("@cognelo/core", () => ({
  AppError: class AppError extends Error {
    constructor(
      public status: number,
      public code: string,
      message: string
    ) {
      super(message);
    }
  }
}));

vi.mock("./db-client", () => ({
  prisma: dbMocks.prisma,
  Prisma: {}
}));

vi.mock("./judge0", () => judge0Mocks);

const {
  listCodingExerciseAttemptHistory,
  listRecentCodingExerciseExecutions,
  listCodingExerciseReviewExecutions,
  getLatestCodingExerciseTestResult,
  regradeCodingExerciseTests,
  runCodingExercise,
  submitCodingExercise,
  validateReferenceSolutionAgainstHiddenTests
} = await import("./executions");

const activityConfig = {
  prompt: "Write a small function.",
  language: "python",
  executionMode: "template",
  maxEditorSeconds: 1800
};

describe("coding exercise executions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMocks.hiddenTests = [
      {
        id: "hidden-1",
        name: "Passes sample shape",
        stdin: "1",
        expectedOutput: "2",
        isEnabled: true,
        weight: 2,
        orderIndex: 0,
        metadata: { testCode: "" }
      },
      {
        id: "hidden-2",
        name: "Handles another value",
        stdin: "2",
        expectedOutput: "4",
        isEnabled: true,
        weight: 3,
        orderIndex: 1,
        metadata: { testCode: "" }
      }
    ];
  });

  it("rejects blank learner source before runtime lookup, persistence, or Judge0 execution", async () => {
    await expect(
      runCodingExercise({
        activityId: "activity-1",
        userId: "student-1",
        activityConfig,
        input: { sourceCode: " \n\t" }
      })
    ).rejects.toMatchObject({ name: "ZodError" });
    await expect(
      submitCodingExercise({
        activityId: "activity-1",
        userId: "student-1",
        activityConfig,
        input: { sourceCode: " \n\t" }
      })
    ).rejects.toMatchObject({ name: "ZodError" });

    expect(judge0Mocks.resolveJudge0Language).not.toHaveBeenCalled();
    expect(judge0Mocks.runJudge0Submission).not.toHaveBeenCalled();
    expect(dbMocks.prisma.pluginCodingExerciseExecution.create).not.toHaveBeenCalled();
  });

  it("persists a successful sample run", async () => {
    judge0Mocks.runJudge0Submission.mockResolvedValueOnce({
      token: "token-1",
      stdout: "2",
      stderr: null,
      compile_output: null,
      message: null,
      time: "0.01",
      memory: 512,
      status: { id: 3, description: "Accepted" }
    });

    await expect(
      runCodingExercise({
        activityId: "activity-1",
        userId: "student-1",
        activityConfig,
        input: {
          sourceCode: "print(2)", stdin: "1", expectedOutput: "2", testCode: "",
          outputMatchMode: "exact", containsLinesOrderMatters: false
        }
      })
    ).resolves.toMatchObject({
      status: "completed",
      judge0Token: "token-1",
      stdout: "2",
      resultSummary: { accepted: true, phase: "finished" }
    });
  });

  it("compares full output but saves and returns only a bounded prefix", async () => {
    const hugeOutput = `pass\n${"x\n".repeat(100_000)}`;
    judge0Mocks.runJudge0Submission.mockResolvedValueOnce({
      token: "large-output-token",
      stdout: hugeOutput,
      status: { id: 3, description: "Accepted" }
    });

    const execution = await runCodingExercise({
      activityId: "activity-1",
      userId: "student-1",
      activityConfig,
      input: { sourceCode: "print('pass')", expectedOutput: "pass", outputMatchMode: "contains_lines" }
    });

    expect(execution.resultSummary).toMatchObject({ accepted: true, outputTruncated: true });
    expect(execution.outputTruncated).toBe(true);
    expect(Buffer.byteLength(execution.stdout ?? "", "utf8")).toBe(MAX_EXECUTION_OUTPUT_BYTES);
    const update = dbMocks.prisma.pluginCodingExerciseExecution.update.mock.calls[0]?.[0];
    expect(Buffer.byteLength(String(update?.data.stdout ?? ""), "utf8")).toBe(MAX_EXECUTION_OUTPUT_BYTES);
  });

  it("runs personalized input without comparing stdout", async () => {
    dbMocks.prisma.pluginCodingExerciseReferenceSolution.findUnique.mockResolvedValueOnce({
      sourceCode: "print('reference')",
      privateConfig: { templateSource: "{{ STUDENT_CODE }}\n{{ TEST_CODE }}" },
      validationSummary: { accepted: true },
      createdAt: new Date("2026-05-14T12:00:00.000Z"),
      updatedAt: new Date("2026-05-14T12:00:00.000Z")
    });
    judge0Mocks.runJudge0Submission.mockResolvedValueOnce({
      token: "token-personalized",
      stdout: "Any program output is allowed.\n",
      stderr: null,
      compile_output: null,
      message: null,
      time: "0.01",
      memory: 512,
      status: { id: 3, description: "Accepted" }
    });

    await expect(
      runCodingExercise({
        activityId: "activity-1",
        userId: "student-1",
        activityConfig,
        input: {
          sourceCode: "print('anything')",
          stdin: "custom input",
          testCode: "raise Exception('sample harness must not run')",
          compareOutput: false
        }
      })
    ).resolves.toMatchObject({
      status: "completed",
      stdout: "Any program output is allowed.\n",
      resultSummary: { accepted: true, outputCompared: false }
    });
    expect(judge0Mocks.runJudge0Submission).toHaveBeenCalledWith(
      expect.objectContaining({
        expectedOutput: undefined,
        sourceCode: "print('anything')\n"
      })
    );
  });

  it("compares contained lines after Judge0 successfully executes the program", async () => {
    judge0Mocks.runJudge0Submission.mockResolvedValueOnce({
      token: "token-contains",
      stdout: "Age: Poids: Temperature:\nTemperature: 38.7 degC\nAge saisi: 3 ans\nPoids: 12.5 kg\n",
      status: { id: 3, description: "Accepted" }
    });

    await expect(
      runCodingExercise({
        activityId: "activity-1",
        userId: "student-1",
        activityConfig,
        input: {
          sourceCode: "print('recap')",
          stdin: "3\n12.5\n38.7",
          expectedOutput: "Age saisi: 3 ans\nPoids: 12.5 kg\nTemperature: 38.7 degC",
          testCode: "",
          outputMatchMode: "contains_lines",
          containsLinesOrderMatters: false
        }
      })
    ).resolves.toMatchObject({
      status: "completed",
      resultSummary: { accepted: true, outputMatchMode: "contains_lines" }
    });
    expect(judge0Mocks.runJudge0Submission).toHaveBeenCalledWith(
      expect.objectContaining({ expectedOutput: undefined })
    );
  });

  it("records a Cognelo regex mismatch after a successful Judge0 execution", async () => {
    judge0Mocks.runJudge0Submission.mockResolvedValueOnce({
      token: "token-regex",
      stdout: "Poids: 12x5 kg\n",
      status: { id: 3, description: "Accepted" }
    });

    await expect(
      runCodingExercise({
        activityId: "activity-1",
        userId: "student-1",
        activityConfig,
        input: {
          sourceCode: "print('wrong')",
          stdin: "",
          expectedOutput: "Poids: 12\\.5 kg",
          testCode: "",
          outputMatchMode: "regex",
          containsLinesOrderMatters: false
        }
      })
    ).resolves.toMatchObject({
      status: "failed",
      message: "Program output did not match the expected regular expression.",
      judge0StatusLabel: "Accepted",
      resultSummary: { accepted: false, outputMatchMode: "regex" }
    });
  });

  it("persists sample run failures and runtime errors", async () => {
    judge0Mocks.runJudge0Submission.mockResolvedValueOnce({
      token: "token-2",
      stdout: "",
      stderr: "Traceback",
      compile_output: null,
      message: "Runtime error",
      time: "0.02",
      memory: 1024,
      status: { id: 11, description: "Runtime Error (NZEC)" }
    });

    await expect(
      runCodingExercise({
        activityId: "activity-1",
        userId: "student-1",
        activityConfig,
        input: {
          sourceCode: "raise Exception()", stdin: "", expectedOutput: "", testCode: "",
          outputMatchMode: "exact", containsLinesOrderMatters: false
        }
      })
    ).resolves.toMatchObject({
      status: "failed",
      stderr: "Traceback",
      message: "Runtime error",
      judge0StatusLabel: "Runtime Error (NZEC)",
      resultSummary: { accepted: false }
    });
  });

  it("submits hidden tests and records weighted pass/fail details", async () => {
    judge0Mocks.runJudge0Submission
      .mockResolvedValueOnce({
        token: "token-pass",
        stdout: "2",
        stderr: null,
        compile_output: null,
        message: null,
        time: "0.01",
        memory: 512,
        status: { id: 3, description: "Accepted" }
      })
      .mockResolvedValueOnce({
        token: "token-fail",
        stdout: "5",
        stderr: null,
        compile_output: null,
        message: "Wrong Answer",
        time: "0.01",
        memory: 512,
        status: { id: 4, description: "Wrong Answer" }
      });

    await expect(
      submitCodingExercise({
        activityId: "activity-1",
        userId: "student-1",
        activityConfig,
        input: { sourceCode: "print('student')" }
      })
    ).resolves.toMatchObject({
      status: "failed",
      message: "Wrong Answer",
      resultSummary: {
        accepted: false,
        testCount: 2,
        passedCount: 1,
        earnedWeight: 2,
        totalWeight: 5
      }
    });
  });

  it("bounds hidden-test output and diagnostics in the saved submission", async () => {
    const hugeOutput = "result\n".repeat(100_000);
    judge0Mocks.runJudge0Submission.mockResolvedValue({
      token: "large-submission-token",
      stdout: hugeOutput,
      stderr: hugeOutput,
      message: hugeOutput,
      status: { id: 11, description: "Runtime Error (NZEC)" }
    });

    const execution = await submitCodingExercise({
      activityId: "activity-1",
      userId: "student-1",
      activityConfig,
      input: { sourceCode: "print('result')" }
    });

    expect(execution.outputTruncated).toBe(true);
    expect(execution.resultSummary).toMatchObject({ outputTruncated: true });
    expect(Buffer.byteLength(execution.stdout ?? "", "utf8")).toBeLessThanOrEqual(MAX_EXECUTION_OUTPUT_BYTES);
    const update = dbMocks.prisma.pluginCodingExerciseExecution.update.mock.calls[0]?.[0];
    expect(Buffer.byteLength(String(update?.data.stdout ?? ""), "utf8")).toBeLessThanOrEqual(MAX_EXECUTION_OUTPUT_BYTES);
    const savedSummary = update?.data.resultSummary as { tests: Array<{ message: string }> };
    expect(savedSummary.tests[0]?.message.length).toBeLessThan(hugeOutput.length);
  });

  it("grades hidden contains-lines tests in Cognelo after Judge0 accepts execution", async () => {
    dbMocks.hiddenTests = [
      {
        id: "hidden-contains",
        name: "Contains recap lines",
        stdin: "3\n12.5\n38.7",
        expectedOutput: "Age saisi: 3 ans\nPoids: 12.5 kg\nTemperature: 38.7 degC",
        isEnabled: true,
        weight: 4,
        orderIndex: 0,
        metadata: {
          testCode: "",
          outputMatchMode: "contains_lines",
          containsLinesOrderMatters: true
        }
      }
    ];
    judge0Mocks.runJudge0Submission.mockResolvedValueOnce({
      token: "token-hidden-contains",
      stdout: "Age: Poids: Temperature:\nAge saisi: 3 ans\nPoids: 12.5 kg\nTemperature: 38.7 degC\n",
      status: { id: 3, description: "Accepted" }
    });

    await expect(
      submitCodingExercise({
        activityId: "activity-1",
        userId: "student-1",
        activityConfig,
        input: { sourceCode: "print('student')" }
      })
    ).resolves.toMatchObject({
      status: "completed",
      resultSummary: {
        accepted: true,
        testCount: 1,
        passedCount: 1,
        earnedWeight: 4,
        totalWeight: 4,
        tests: [
          expect.objectContaining({
            passed: true,
            outputMatchMode: "contains_lines",
            containsLinesOrderMatters: true
          })
        ]
      }
    });
    expect(judge0Mocks.runJudge0Submission).toHaveBeenCalledWith(
      expect.objectContaining({ expectedOutput: undefined })
    );
  });

  it("validates reference solutions against sample and hidden tests with mocked Judge0", async () => {
    judge0Mocks.runJudge0Submission
      .mockResolvedValueOnce({ token: "s1", stdout: "2", status: { id: 3, description: "Accepted" } })
      .mockResolvedValueOnce({ token: "h1", stdout: "4", status: { id: 3, description: "Accepted" } });

    const validationInput: Parameters<typeof validateReferenceSolutionAgainstHiddenTests>[0] = {
      activityConfig,
      sourceCode: "print('reference')",
      sampleTests: [{
        id: "sample-1", title: "Sample", input: "1", output: "2", testCode: "",
        outputMatchMode: "exact", containsLinesOrderMatters: false
      }],
      hiddenTests: [
        {
          id: "hidden-1",
          name: "Hidden",
          stdin: "2",
          expectedOutput: "4",
          testCode: "",
          outputMatchMode: "exact",
          containsLinesOrderMatters: false,
          isEnabled: true,
          weight: 3,
          orderIndex: 0
        }
      ],
      privateConfig: { hiddenSupportCode: "", templateSource: "{{ STUDENT_CODE }}", templatePrefix: "", templateSuffix: "", templateVisibleLineNumbers: [], aiFeedback: { enabled: false, gradingEnabled: false, instructions: "", testWeightPercent: 60, aiWeightPercent: 40, criteria: [] } }
    };
    const initialValidation = await validateReferenceSolutionAgainstHiddenTests(validationInput);
    expect(initialValidation).toMatchObject({
      accepted: true,
      executedTestCount: 2,
      reusedTestCount: 0,
      sampleTests: { passedCount: 1 },
      hiddenTests: { earnedWeight: 3, totalWeight: 3 }
    });
    expect(judge0Mocks.runJudge0Submission).toHaveBeenCalledTimes(2);

    judge0Mocks.runJudge0Submission.mockClear();
    judge0Mocks.resolveJudge0Language.mockClear();
    const unchangedValidation = await validateReferenceSolutionAgainstHiddenTests({
      ...validationInput,
      hiddenTests: [{ ...validationInput.hiddenTests[0]!, name: "Renamed hidden test", weight: 5 }],
      previousValidationSummary: initialValidation
    });
    expect(unchangedValidation).toMatchObject({
      accepted: true,
      executedTestCount: 0,
      reusedTestCount: 2,
      hiddenTests: {
        earnedWeight: 5,
        totalWeight: 5,
        tests: [expect.objectContaining({ name: "Renamed hidden test", weight: 5 })]
      }
    });
    expect(judge0Mocks.resolveJudge0Language).not.toHaveBeenCalled();
    expect(judge0Mocks.runJudge0Submission).not.toHaveBeenCalled();

    judge0Mocks.runJudge0Submission.mockResolvedValueOnce({
      token: "h2",
      stdout: "6",
      status: { id: 3, description: "Accepted" }
    });
    const dirtyValidation = await validateReferenceSolutionAgainstHiddenTests({
      ...validationInput,
      hiddenTests: [{ ...validationInput.hiddenTests[0]!, expectedOutput: "6" }],
      previousValidationSummary: unchangedValidation
    });
    expect(dirtyValidation).toMatchObject({
      accepted: true,
      executedTestCount: 1,
      reusedTestCount: 1,
      sampleTests: { executedTestCount: 0, reusedTestCount: 1 },
      hiddenTests: { executedTestCount: 1, reusedTestCount: 0 }
    });
    expect(judge0Mocks.runJudge0Submission).toHaveBeenCalledTimes(1);

    judge0Mocks.runJudge0Submission.mockClear();
    judge0Mocks.runJudge0Submission
      .mockResolvedValueOnce({ token: "s2", stdout: "2", status: { id: 3, description: "Accepted" } })
      .mockResolvedValueOnce({ token: "h3", stdout: "6", status: { id: 3, description: "Accepted" } });
    const referenceChangedValidation = await validateReferenceSolutionAgainstHiddenTests({
      ...validationInput,
      sourceCode: "print('updated reference')",
      hiddenTests: [{ ...validationInput.hiddenTests[0]!, expectedOutput: "6" }],
      previousValidationSummary: dirtyValidation
    });
    expect(referenceChangedValidation).toMatchObject({ executedTestCount: 2, reusedTestCount: 0 });
    expect(judge0Mocks.runJudge0Submission).toHaveBeenCalledTimes(2);
  });

  it("bounds reference-validation output before it can be saved in the validation summary", async () => {
    const hugeOutput = "x".repeat(100_000);
    judge0Mocks.runJudge0Submission.mockResolvedValueOnce({
      token: "large-reference-token",
      stdout: hugeOutput,
      status: { id: 3, description: "Accepted" }
    });

    const validation = await validateReferenceSolutionAgainstHiddenTests({
      activityConfig,
      sourceCode: "print('reference')",
      sampleTests: [{
        id: "sample-1", title: "Sample", input: "", output: "x", testCode: "",
        outputMatchMode: "contains_lines", containsLinesOrderMatters: false
      }],
      hiddenTests: [],
      privateConfig: { hiddenSupportCode: "", templateSource: "{{ STUDENT_CODE }}", templatePrefix: "", templateSuffix: "", templateVisibleLineNumbers: [], aiFeedback: { enabled: false, gradingEnabled: false, instructions: "", testWeightPercent: 60, aiWeightPercent: 40, criteria: [] } }
    });

    expect(validation.sampleTests.tests[0]?.outputTruncated).toBe(true);
    expect(Buffer.byteLength(validation.sampleTests.tests[0]?.stdout ?? "", "utf8")).toBe(MAX_EXECUTION_OUTPUT_BYTES);
  });

  it("returns failed reference validation summaries when Judge0 rejects a test", async () => {
    judge0Mocks.runJudge0Submission.mockResolvedValueOnce({
      token: "h1",
      stdout: "",
      stderr: "boom",
      status: { id: 11, description: "Runtime Error (NZEC)" }
    });

    await expect(
      validateReferenceSolutionAgainstHiddenTests({
        activityConfig,
        sourceCode: "raise Exception()",
        sampleTests: [],
        hiddenTests: [
          {
            id: "hidden-1",
            name: "Hidden",
            stdin: "",
            expectedOutput: "",
            testCode: "",
            outputMatchMode: "exact",
            containsLinesOrderMatters: false,
            isEnabled: true,
            weight: 1,
            orderIndex: 0
          }
        ],
        privateConfig: { hiddenSupportCode: "", templateSource: "{{ STUDENT_CODE }}", templatePrefix: "", templateSuffix: "", templateVisibleLineNumbers: [], aiFeedback: { enabled: false, gradingEnabled: false, instructions: "", testWeightPercent: 60, aiWeightPercent: 40, criteria: [] } }
      })
    ).resolves.toMatchObject({
      accepted: false,
      hiddenTests: {
        passedCount: 0,
        tests: [expect.objectContaining({ stderr: "boom", passed: false })]
      }
    });
  });

  it("lists recent executions for one activity and user", async () => {
    await expect(listRecentCodingExerciseExecutions({ activityId: "activity-1", userId: "student-1", limit: 3 })).resolves.toEqual([
      expect.objectContaining({ id: "recent-1", status: "completed" })
    ]);
    expect(dbMocks.prisma.pluginCodingExerciseExecution.findMany).toHaveBeenCalledWith({
      where: { activityId: "activity-1", userId: "student-1" },
      orderBy: [{ createdAt: "desc" }],
      take: 3
    });
  });

  it("bounds oversized historical output and nested diagnostics in browser-facing records", async () => {
    const hugeOutput = "line\n".repeat(100_000);
    dbMocks.prisma.pluginCodingExerciseExecution.findMany.mockResolvedValueOnce([
      dbMocks.executionRow({
        id: "legacy-large-run",
        stdout: hugeOutput,
        resultSummary: { tests: [{ message: hugeOutput }] }
      })
    ]);

    const [execution] = await listRecentCodingExerciseExecutions({ activityId: "activity-1", userId: "student-1" });
    expect(execution.outputTruncated).toBe(true);
    expect(Buffer.byteLength(execution.stdout ?? "", "utf8")).toBeLessThanOrEqual(MAX_EXECUTION_OUTPUT_BYTES);
    expect(String((execution.resultSummary.tests as Array<{ message: string }>)[0]?.message).length).toBeLessThan(hugeOutput.length);
  });

  it("reruns current hidden tests without creating another student submission", async () => {
    dbMocks.hiddenTests = [{
      id: "corrected-test",
      name: "Corrected expected output",
      stdin: "3",
      expectedOutput: "6",
      isEnabled: true,
      weight: 4,
      orderIndex: 0,
      metadata: { testCode: "" }
    }];
    judge0Mocks.runJudge0Submission.mockResolvedValue({
      token: "regrade-token",
      stdout: "6",
      status: { id: 3, description: "Accepted" }
    });

    await expect(regradeCodingExerciseTests({
      activityId: "activity-1",
      executionId: "execution-1",
      actorUserId: "teacher-1",
      activityConfig
    })).resolves.toMatchObject({
      testEvaluationId: "test-evaluation-1",
      resultSummary: { earnedWeight: 4, totalWeight: 4, testCount: 1 }
    });
    expect(dbMocks.prisma.pluginCodingExerciseExecution.create).not.toHaveBeenCalled();
    expect(dbMocks.prisma.pluginCodingExerciseTestEvaluation.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        executionId: "execution-1",
        actorUserId: "teacher-1",
        configSnapshot: expect.objectContaining({
          hiddenTests: [expect.objectContaining({ id: "corrected-test", expectedOutput: "6" })]
        })
      })
    }));
  });

  it("uses the latest successful regrade result, falling back to the original submission", async () => {
    const originalResultSummary = { earnedWeight: 1, totalWeight: 2 };
    await expect(getLatestCodingExerciseTestResult({
      activityId: "activity-1", executionId: "execution-1", originalResultSummary
    })).resolves.toMatchObject({ resultSummary: originalResultSummary, testEvaluationId: null });
    dbMocks.prisma.pluginCodingExerciseTestEvaluation.findFirst.mockResolvedValueOnce({
      id: "test-evaluation-2",
      resultSummary: { earnedWeight: 3, totalWeight: 3 }
    } as never);
    await expect(getLatestCodingExerciseTestResult({
      activityId: "activity-1", executionId: "execution-1", originalResultSummary
    })).resolves.toMatchObject({ resultSummary: { earnedWeight: 3, totalWeight: 3 }, testEvaluationId: "test-evaluation-2" });
  });

  it("ignores operational failures when selecting each learner's latest review submission", async () => {
    dbMocks.prisma.pluginCodingExerciseExecution.findMany.mockResolvedValueOnce([
      dbMocks.executionRow({
        id: "student-1-infrastructure-error",
        userId: "student-1",
        kind: "submit",
        status: "failed",
        judge0StatusId: 13,
        resultSummary: { phase: "finished", tests: [{ statusId: 13 }] },
        createdAt: new Date("2026-05-14T12:06:00.000Z")
      }),
      dbMocks.executionRow({
        id: "student-1-completed",
        userId: "student-1",
        kind: "submit",
        status: "completed",
        resultSummary: { phase: "finished" },
        createdAt: new Date("2026-05-14T12:05:00.000Z")
      }),
      dbMocks.executionRow({
        id: "student-2-completed",
        userId: "student-2",
        kind: "submit",
        status: "completed",
        resultSummary: { phase: "finished" },
        createdAt: new Date("2026-05-14T12:04:00.000Z")
      })
    ]);

    await expect(
      listCodingExerciseReviewExecutions({ activityId: "activity-1", userIds: ["student-1", "student-2"] })
    ).resolves.toEqual([
      expect.objectContaining({ id: "student-1-completed", userId: "student-1" }),
      expect.objectContaining({ id: "student-2-completed", userId: "student-2" })
    ]);
  });

  it("groups every completed submission with the runs that preceded it", async () => {
    dbMocks.prisma.pluginCodingExerciseExecution.findMany.mockResolvedValueOnce([
      dbMocks.executionRow({ id: "run-1", createdAt: new Date("2026-05-14T12:01:00.000Z") }),
      dbMocks.executionRow({ id: "run-2", createdAt: new Date("2026-05-14T12:02:00.000Z") }),
      dbMocks.executionRow({ id: "submit-1", kind: "submit", status: "completed", sourceCode: "first", createdAt: new Date("2026-05-14T12:03:00.000Z") }),
      dbMocks.executionRow({ id: "run-3", createdAt: new Date("2026-05-14T12:04:00.000Z") }),
      dbMocks.executionRow({
        id: "submit-current-infrastructure-error",
        kind: "submit",
        status: "failed",
        sourceCode: "retry-me",
        resultSummary: { phase: "failed-before-result" },
        createdAt: new Date("2026-05-14T12:04:15.000Z")
      }),
      dbMocks.executionRow({
        id: "submit-legacy-infrastructure-error",
        kind: "submit",
        status: "failed",
        sourceCode: "retry-me-too",
        judge0StatusId: 13,
        resultSummary: { phase: "finished", tests: [{ statusId: 13 }] },
        createdAt: new Date("2026-05-14T12:04:30.000Z")
      }),
      dbMocks.executionRow({ id: "submit-2", kind: "submit", status: "failed", sourceCode: "second", createdAt: new Date("2026-05-14T12:05:00.000Z") }),
      dbMocks.executionRow({ id: "run-current", createdAt: new Date("2026-05-14T12:06:00.000Z") })
    ]);

    await expect(listCodingExerciseAttemptHistory({ activityId: "activity-1", userId: "student-1" })).resolves.toEqual({
      currentRuns: [expect.objectContaining({ id: "run-current" })],
      attempts: [
        {
          submission: expect.objectContaining({ id: "submit-2", sourceCode: "second" }),
          runs: [expect.objectContaining({ id: "run-3" })]
        },
        {
          submission: expect.objectContaining({ id: "submit-1", sourceCode: "first" }),
          runs: [expect.objectContaining({ id: "run-1" }), expect.objectContaining({ id: "run-2" })]
        }
      ]
    });
    expect(dbMocks.prisma.pluginCodingExerciseExecution.findMany).toHaveBeenCalledWith({
      where: { activityId: "activity-1", userId: "student-1" },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }]
    });
  });
});
