import { beforeEach, describe, expect, it, vi } from "vitest";

const dbMocks = vi.hoisted(() => {
  const transaction = {
    pluginBankCodingExerciseHiddenTest: { deleteMany: vi.fn() },
    pluginBankCodingExerciseReferenceSolution: { deleteMany: vi.fn() }
  };
  return {
    prisma: {
      $transaction: vi.fn((callback: (tx: typeof transaction) => unknown) => callback(transaction)),
      pluginBankCodingExerciseHiddenTest: {},
      pluginBankCodingExerciseReferenceSolution: {}
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

vi.mock("./executions", () => ({
  getCodingExerciseReferenceSolution: vi.fn(),
  validateReferenceSolutionAgainstHiddenTests: vi.fn()
}));

const { deleteBankCodingExerciseData } = await import("./hidden-tests");

describe("deleteBankCodingExerciseData", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("removes bank-owned tests and reference solutions without touching course-owned rows", async () => {
    await deleteBankCodingExerciseData({ bankActivityId: "bank-activity-1" });

    expect(dbMocks.transaction.pluginBankCodingExerciseHiddenTest.deleteMany).toHaveBeenCalledWith({
      where: { bankActivityId: "bank-activity-1" }
    });
    expect(dbMocks.transaction.pluginBankCodingExerciseReferenceSolution.deleteMany).toHaveBeenCalledWith({
      where: { bankActivityId: "bank-activity-1" }
    });
  });
});
