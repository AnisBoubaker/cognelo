import { beforeEach, describe, expect, it, vi } from "vitest";

const dbMocks = vi.hoisted(() => {
  const transaction = {
    pluginBankWebDesignExerciseReferenceBundle: { deleteMany: vi.fn() },
    pluginBankWebDesignExerciseTest: { deleteMany: vi.fn() }
  };
  return {
    prisma: {
      $transaction: vi.fn((callback: (tx: typeof transaction) => unknown) => callback(transaction))
    },
    transaction
  };
});

vi.mock("./db-client", () => ({
  prisma: dbMocks.prisma,
  Prisma: {}
}));

vi.mock("@cognelo/core", () => ({
  AppError: class AppError extends Error {},
  assertCanManageActivityBank: vi.fn(),
  assertCanManageCourse: vi.fn()
}));

vi.mock("./runner", () => ({
  captureWebDesignScreenshotInRunner: vi.fn(),
  runWebDesignTestsInRunner: vi.fn()
}));

const { deleteBankWebDesignExerciseData } = await import("./tests");

describe("deleteBankWebDesignExerciseData", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("removes bank-owned reference bundles and tests without touching course-owned rows", async () => {
    await deleteBankWebDesignExerciseData({ bankActivityId: "bank-activity-1" });

    expect(dbMocks.transaction.pluginBankWebDesignExerciseTest.deleteMany).toHaveBeenCalledWith({
      where: { bankActivityId: "bank-activity-1" }
    });
    expect(dbMocks.transaction.pluginBankWebDesignExerciseReferenceBundle.deleteMany).toHaveBeenCalledWith({
      where: { bankActivityId: "bank-activity-1" }
    });
  });
});
