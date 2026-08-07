import { beforeEach, describe, expect, it, vi } from "vitest";

const dbMocks = vi.hoisted(() => {
  const now = new Date("2026-05-14T12:00:00.000Z");
  const courseTests = [
    {
      id: "course-test-1",
      name: "Heading",
      kind: "sample",
      testCode: "await expect(page.locator('h1')).toHaveText('Hello');",
      isEnabled: true,
      weight: 1,
      orderIndex: 0,
      metadata: { stable: true },
      validationSummary: { status: "completed" },
      createdAt: now,
      updatedAt: now
    }
  ];
  const bankTests = [
    {
      id: "bank-test-1",
      name: "Card",
      kind: "hidden",
      testCode: "await expect(page.locator('.card')).toBeVisible();",
      isEnabled: true,
      weight: 2,
      orderIndex: 0,
      metadata: {},
      validationSummary: { status: "completed" },
      createdAt: now,
      updatedAt: now
    }
  ];
  const courseBundle = {
    files: [{ id: "index", path: "index.html", language: "html", starterCode: "<h1>Hello</h1>", isEditable: true, orderIndex: 0 }],
    validationSummary: { status: "completed" } as Record<string, unknown>,
    createdAt: now,
    updatedAt: now
  };
  const bankBundle = {
    files: [{ id: "index", path: "index.html", language: "html", starterCode: "<main class='card'></main>", isEditable: true, orderIndex: 0 }],
    validationSummary: { status: "completed" } as Record<string, unknown>,
    createdAt: now,
    updatedAt: now
  };
  const transaction = {
    pluginWebDesignExerciseTest: {
      deleteMany: vi.fn(),
      createMany: vi.fn()
    },
    pluginWebDesignExerciseReferenceBundle: {
      deleteMany: vi.fn(),
      create: vi.fn(),
      upsert: vi.fn()
    },
    pluginBankWebDesignExerciseTest: {
      deleteMany: vi.fn(),
      createMany: vi.fn()
    },
    pluginBankWebDesignExerciseReferenceBundle: {
      upsert: vi.fn()
    }
  };

  return {
    now,
    courseTests,
    bankTests,
    courseBundle,
    bankBundle,
    transaction,
    prisma: {
      $transaction: vi.fn(async (callback: (tx: typeof transaction) => unknown) => callback(transaction)),
      pluginWebDesignExerciseReferenceBundle: {
        findUnique: vi.fn(() => Promise.resolve(courseBundle))
      },
      pluginWebDesignExerciseTest: {
        findMany: vi.fn(() => Promise.resolve(courseTests))
      },
      pluginBankWebDesignExerciseReferenceBundle: {
        findUnique: vi.fn(() => Promise.resolve(bankBundle))
      },
      pluginBankWebDesignExerciseTest: {
        findMany: vi.fn(() => Promise.resolve(bankTests))
      }
    }
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

const runnerMocks = vi.hoisted(() => ({
  captureWebDesignScreenshotInRunner: vi.fn(() =>
    Promise.resolve({
      imageDataUrl: "data:image/png;base64,abc",
      durationMs: 42,
      viewport: { width: 1280, height: 720 }
    })
  ),
  runWebDesignTestsInRunner: vi.fn(() =>
    Promise.resolve({
      status: "completed",
      score: 3,
      maxScore: 3,
      durationMs: 25,
      tests: [
        { id: "sample-1", name: "Heading", status: "passed", score: 1, weight: 1, durationMs: 10 },
        { id: "hidden-1", name: "Card", status: "passed", score: 2, weight: 2, durationMs: 15 }
      ]
    })
  )
}));

vi.mock("./db-client", () => ({
  prisma: dbMocks.prisma,
  Prisma: {}
}));

vi.mock("@cognelo/core", () => coreMocks);

vi.mock("./runner", () => runnerMocks);

const {
  copyBankWebDesignExerciseTestsToCourseActivity,
  getBankWebDesignExpectedResult,
  getWebDesignExpectedResult,
  listBankWebDesignExerciseTests,
  listWebDesignExerciseTests,
  replaceBankWebDesignExerciseTests,
  replaceWebDesignExerciseTests
} = await import("./tests");

const referenceFiles = [{ id: "index", path: "index.html", language: "html", starterCode: "<h1>Hello</h1>", isEditable: true, orderIndex: 0 }];
const testsInput = {
  shouldCaptureExpectedResult: true,
  referenceFiles,
  tests: [
    {
      id: "sample-1",
      name: "Heading",
      kind: "sample",
      testCode: "await expect(page.locator('h1')).toHaveText('Hello');",
      isEnabled: true,
      weight: 1,
      metadata: { visibleToStudents: true }
    },
    {
      id: "hidden-1",
      name: "Card",
      kind: "hidden",
      testCode: "await expect(page.locator('.card')).toBeVisible();",
      isEnabled: true,
      weight: 2,
      metadata: {}
    }
  ]
};

describe("web design exercise test persistence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lists course and bank tests with their reference bundles", async () => {
    await expect(listWebDesignExerciseTests({ activityId: "activity-1" })).resolves.toMatchObject({
      referenceBundle: { files: [{ path: "index.html" }] },
      tests: [{ id: "course-test-1", kind: "sample" }]
    });
    await expect(listBankWebDesignExerciseTests({ bankActivityId: "bank-activity-1" })).resolves.toMatchObject({
      referenceBundle: { files: [{ path: "index.html" }] },
      tests: [{ id: "bank-test-1", kind: "hidden" }]
    });
  });

  it("replaces course tests and stores expected result bundles", async () => {
    await replaceWebDesignExerciseTests({
      activityId: "activity-1",
      courseId: "course-1",
      activityConfig: { prompt: "Match this picture {{ EXPECTED_RESULT }}", files: referenceFiles },
      user: { id: "teacher-1", role: "teacher" } as never,
      input: testsInput
    });

    expect(dbMocks.transaction.pluginWebDesignExerciseTest.deleteMany).toHaveBeenCalledWith({
      where: { activityId: "activity-1" }
    });
    expect(dbMocks.transaction.pluginWebDesignExerciseTest.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({ id: "sample-1", activityId: "activity-1", kind: "sample", orderIndex: 0 }),
        expect.objectContaining({ id: "hidden-1", activityId: "activity-1", kind: "hidden", orderIndex: 1 })
      ]
    });
    expect(dbMocks.transaction.pluginWebDesignExerciseReferenceBundle.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { activityId: "activity-1" },
        create: expect.objectContaining({
          activityId: "activity-1",
          validationSummary: expect.objectContaining({
            expectedResult: expect.objectContaining({ imageDataUrl: "data:image/png;base64,abc" })
          })
        })
      })
    );
  });

  it("replaces bank tests without writing course-scoped rows", async () => {
    await replaceBankWebDesignExerciseTests({
      activityBankId: "bank-1",
      bankActivityId: "bank-activity-1",
      activityConfig: { prompt: "Match this picture {{ EXPECTED_RESULT }}", files: referenceFiles },
      user: { id: "teacher-1", role: "teacher" } as never,
      input: testsInput
    });

    expect(dbMocks.transaction.pluginBankWebDesignExerciseTest.deleteMany).toHaveBeenCalledWith({
      where: { bankActivityId: "bank-activity-1" }
    });
    expect(dbMocks.transaction.pluginBankWebDesignExerciseTest.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({ id: "sample-1", bankActivityId: "bank-activity-1", kind: "sample", orderIndex: 0 }),
        expect.objectContaining({ id: "hidden-1", bankActivityId: "bank-activity-1", kind: "hidden", orderIndex: 1 })
      ]
    });
    expect(dbMocks.transaction.pluginWebDesignExerciseTest.createMany).not.toHaveBeenCalled();
  });

  it("rejects duplicate test ids before writing", async () => {
    await expect(
      replaceWebDesignExerciseTests({
        activityId: "activity-1",
        courseId: "course-1",
        activityConfig: { prompt: "Build a card", files: referenceFiles },
        user: { id: "teacher-1", role: "teacher" } as never,
        input: { ...testsInput, tests: [testsInput.tests[0], { ...testsInput.tests[1], id: "sample-1" }] }
      })
    ).rejects.toMatchObject({ code: "WEB_DESIGN_TEST_DUPLICATE_ID" });
    expect(dbMocks.transaction.pluginWebDesignExerciseTest.deleteMany).not.toHaveBeenCalled();
  });

  it("copies bank tests and reference bundles to a course activity", async () => {
    await copyBankWebDesignExerciseTestsToCourseActivity({ bankActivityId: "bank-activity-1", activityId: "activity-1" });

    expect(dbMocks.transaction.pluginWebDesignExerciseReferenceBundle.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        activityId: "activity-1",
        files: dbMocks.bankBundle.files,
        validationSummary: dbMocks.bankBundle.validationSummary
      })
    });
    expect(dbMocks.transaction.pluginWebDesignExerciseTest.createMany).toHaveBeenCalledWith({
      data: [expect.objectContaining({ activityId: "activity-1", name: "Card", kind: "hidden" })]
    });
  });

  it("reads stored expected result images for course and bank scopes", async () => {
    dbMocks.prisma.pluginWebDesignExerciseReferenceBundle.findUnique.mockResolvedValueOnce({
      ...dbMocks.courseBundle,
      validationSummary: { expectedResult: { imageDataUrl: "data:image/png;base64,course" } } as Record<string, unknown>
    });
    dbMocks.prisma.pluginBankWebDesignExerciseReferenceBundle.findUnique.mockResolvedValueOnce({
      ...dbMocks.bankBundle,
      validationSummary: { expectedResult: { imageDataUrl: "data:image/png;base64,bank" } } as Record<string, unknown>
    });

    await expect(
      getWebDesignExpectedResult({ activityId: "activity-1", activityConfig: { prompt: "Match {{ EXPECTED_RESULT }}", files: referenceFiles } })
    ).resolves.toEqual({ imageDataUrl: "data:image/png;base64,course" });
    await expect(
      getBankWebDesignExpectedResult({
        bankActivityId: "bank-activity-1",
        activityConfig: { prompt: "Match {{ EXPECTED_RESULT }}", files: referenceFiles }
      })
    ).resolves.toEqual({ imageDataUrl: "data:image/png;base64,bank" });
  });
});
