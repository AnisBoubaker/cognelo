import { beforeEach, describe, expect, it, vi } from "vitest";

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
    get hiddenTests() {
      return state.hiddenTests;
    },
    set hiddenTests(value: MockHiddenTest[]) {
      state.hiddenTests = value;
    },
    executions: state.executions,
    prisma: {
    pluginCodingExerciseExecution: {
      create: vi.fn((args: { data: Record<string, unknown> }) =>
        Promise.resolve({
          id: "execution-1",
          activityId: args.data.activityId,
          userId: args.data.userId,
          kind: args.data.kind,
          status: args.data.status,
          languageKey: args.data.languageKey,
          judge0LanguageId: args.data.judge0LanguageId,
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
  listRecentCodingExerciseExecutions,
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

    await expect(
      validateReferenceSolutionAgainstHiddenTests({
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
        privateConfig: { hiddenSupportCode: "", templateSource: "{{ STUDENT_CODE }}", templatePrefix: "", templateSuffix: "", templateVisibleLineNumbers: [] }
      })
    ).resolves.toMatchObject({
      accepted: true,
      sampleTests: { passedCount: 1 },
      hiddenTests: { earnedWeight: 3, totalWeight: 3 }
    });
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
        privateConfig: { hiddenSupportCode: "", templateSource: "{{ STUDENT_CODE }}", templatePrefix: "", templateSuffix: "", templateVisibleLineNumbers: [] }
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
});
