import { beforeEach, describe, expect, it, vi } from "vitest";

const dbMocks = vi.hoisted(() => {
  const courseRows = [
    {
      id: "row-2",
      name: "Second",
      stdin: "2",
      expectedOutput: "4",
      isEnabled: true,
      weight: 2,
      orderIndex: 1,
      metadata: { stableId: "hidden-2", testCode: "print(double(2))" },
      createdAt: new Date("2026-05-14T12:00:00.000Z"),
      updatedAt: new Date("2026-05-14T12:00:00.000Z")
    }
  ];
  const bankRows = [
    {
      id: "bank-row-1",
      name: "Bank hidden",
      stdin: "1",
      expectedOutput: "2",
      isEnabled: true,
      weight: 1,
      orderIndex: 0,
      metadata: { stableId: "bank-hidden-1", testCode: "print(double(1))" },
      createdAt: new Date("2026-05-14T12:00:00.000Z"),
      updatedAt: new Date("2026-05-14T12:00:00.000Z")
    }
  ];
  const bankReference = {
    sourceCode: "def double(n): return n * 2",
    privateConfig: { templateSource: "{{ STUDENT_CODE }}\n{{ TEST_CODE }}" },
    validationSummary: { accepted: true },
    createdAt: new Date("2026-05-14T12:00:00.000Z"),
    updatedAt: new Date("2026-05-14T12:00:00.000Z")
  };
  const transaction = {
    pluginCodingExerciseHiddenTest: {
      deleteMany: vi.fn(),
      createMany: vi.fn()
    },
    pluginCodingExerciseReferenceSolution: {
      deleteMany: vi.fn(),
      create: vi.fn(),
      upsert: vi.fn()
    },
    pluginBankCodingExerciseHiddenTest: {
      deleteMany: vi.fn(),
      createMany: vi.fn()
    },
    pluginBankCodingExerciseReferenceSolution: {
      deleteMany: vi.fn(),
      upsert: vi.fn()
    }
  };

  return {
    courseRows,
    bankRows,
    bankReference,
    prisma: {
      $transaction: vi.fn(async (callback: (tx: typeof transaction) => unknown) => callback(transaction)),
      pluginCodingExerciseHiddenTest: {
        findMany: vi.fn(() => Promise.resolve(courseRows))
      },
      pluginCodingExerciseReferenceSolution: {
        deleteMany: vi.fn(),
        create: vi.fn(),
        upsert: vi.fn()
      },
      pluginBankCodingExerciseHiddenTest: {
        findMany: vi.fn(() => Promise.resolve(bankRows))
      },
      pluginBankCodingExerciseReferenceSolution: {
        findUnique: vi.fn(() => Promise.resolve(bankReference))
      }
    },
    transaction
  };
});

const coreMocks = vi.hoisted(() => ({
  assertActivityAuthoringMutable: vi.fn(),
  assertCanManageActivityBank: vi.fn(),
  assertCanManageCourse: vi.fn(),
  AppError: class AppError extends Error {
    constructor(
      public status: number,
      public code: string,
      message: string,
      public details?: unknown
    ) {
      super(message);
    }
  }
}));

const executionMocks = vi.hoisted(() => ({
  getCodingExerciseReferenceSolution: vi.fn(() =>
    Promise.resolve({
      sourceCode: "def double(n): return n * 2",
      privateConfig: { templateSource: "{{ STUDENT_CODE }}\n{{ TEST_CODE }}" },
      validationSummary: { accepted: true },
      createdAt: "2026-05-14T12:00:00.000Z",
      updatedAt: "2026-05-14T12:00:00.000Z"
    })
  ),
  validateReferenceSolutionAgainstHiddenTests: vi.fn(() =>
    Promise.resolve({
      accepted: true,
      sampleTests: { tests: [] },
      hiddenTests: { tests: [] }
    })
  )
}));

vi.mock("./db-client", () => ({
  prisma: dbMocks.prisma,
  Prisma: {}
}));

vi.mock("@cognelo/core", () => coreMocks);

vi.mock("./executions", () => executionMocks);

const {
  copyBankCodingExerciseDataToCourseActivity,
  listBankCodingExerciseHiddenTests,
  listCodingExerciseHiddenTests,
  replaceBankCodingExerciseHiddenTests,
  replaceCodingExerciseHiddenTests
} = await import("./hidden-tests");

const hiddenInput = {
  referenceSolution: "def double(n): return n * 2",
  privateConfig: {
    templateSource: "{{ STUDENT_CODE }}\n{{ TEST_CODE }}"
  },
  tests: [
    {
      id: "hidden-1",
      name: "First",
      stdin: "1",
      expectedOutput: "2",
      testCode: "print(double(1))",
      isEnabled: true,
      weight: 1
    },
    {
      id: "hidden-2",
      name: "Second",
      stdin: "2",
      expectedOutput: "4",
      testCode: "print(double(2))",
      isEnabled: true,
      weight: 2
    }
  ]
};

describe("coding exercise hidden test persistence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lists course and bank hidden tests with separate reference solution storage", async () => {
    await expect(listCodingExerciseHiddenTests({ activityId: "course-activity-1" })).resolves.toMatchObject({
      tests: [{ id: "hidden-2", testCode: "print(double(2))" }],
      referenceSolution: { sourceCode: "def double(n): return n * 2" }
    });
    await expect(listBankCodingExerciseHiddenTests({ bankActivityId: "bank-activity-1" })).resolves.toMatchObject({
      tests: [{ id: "bank-hidden-1", testCode: "print(double(1))" }],
      referenceSolution: { sourceCode: "def double(n): return n * 2" }
    });

    expect(executionMocks.getCodingExerciseReferenceSolution).toHaveBeenCalledWith({ activityId: "course-activity-1" });
    expect(dbMocks.prisma.pluginBankCodingExerciseReferenceSolution.findUnique).toHaveBeenCalledWith({
      where: { bankActivityId: "bank-activity-1" }
    });
  });

  it("replaces course hidden tests atomically and preserves submitted order", async () => {
    await replaceCodingExerciseHiddenTests({
      activityId: "course-activity-1",
      courseId: "course-1",
      activityConfig: { prompt: "Write a function.", language: "python" },
      user: { id: "teacher-1", role: "teacher" } as never,
      input: hiddenInput
    });

    expect(dbMocks.transaction.pluginCodingExerciseHiddenTest.deleteMany).toHaveBeenCalledWith({
      where: { activityId: "course-activity-1" }
    });
    expect(dbMocks.transaction.pluginCodingExerciseHiddenTest.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({ activityId: "course-activity-1", name: "First", orderIndex: 0 }),
        expect.objectContaining({ activityId: "course-activity-1", name: "Second", orderIndex: 1 })
      ]
    });
    expect(dbMocks.transaction.pluginCodingExerciseReferenceSolution.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { activityId: "course-activity-1" },
        create: expect.objectContaining({ activityId: "course-activity-1" })
      })
    );
  });

  it("replaces bank hidden tests atomically without writing course reference rows", async () => {
    await replaceBankCodingExerciseHiddenTests({
      activityBankId: "bank-1",
      bankActivityId: "bank-activity-1",
      activityConfig: { prompt: "Write a function.", language: "python" },
      user: { id: "teacher-1", role: "teacher" } as never,
      input: hiddenInput
    });

    expect(dbMocks.transaction.pluginBankCodingExerciseHiddenTest.deleteMany).toHaveBeenCalledWith({
      where: { bankActivityId: "bank-activity-1" }
    });
    expect(dbMocks.transaction.pluginBankCodingExerciseHiddenTest.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({ bankActivityId: "bank-activity-1", name: "First", orderIndex: 0 }),
        expect.objectContaining({ bankActivityId: "bank-activity-1", name: "Second", orderIndex: 1 })
      ]
    });
    expect(dbMocks.transaction.pluginBankCodingExerciseReferenceSolution.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { bankActivityId: "bank-activity-1" },
        create: expect.objectContaining({ bankActivityId: "bank-activity-1" })
      })
    );
    expect(dbMocks.transaction.pluginCodingExerciseReferenceSolution.upsert).not.toHaveBeenCalled();
  });

  it("copies bank tests, reference solution, and private config to one course activity", async () => {
    await copyBankCodingExerciseDataToCourseActivity({
      bankActivityId: "bank-activity-1",
      activityId: "course-activity-1"
    });

    expect(dbMocks.transaction.pluginCodingExerciseHiddenTest.deleteMany).toHaveBeenCalledWith({
      where: { activityId: "course-activity-1" }
    });
    expect(dbMocks.transaction.pluginCodingExerciseHiddenTest.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          activityId: "course-activity-1",
          name: "Bank hidden",
          metadata: expect.objectContaining({ stableId: "bank-hidden-1" })
        })
      ]
    });
    expect(dbMocks.transaction.pluginCodingExerciseReferenceSolution.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        activityId: "course-activity-1",
        sourceCode: "def double(n): return n * 2",
        privateConfig: { templateSource: "{{ STUDENT_CODE }}\n{{ TEST_CODE }}" }
      })
    });
  });
});
