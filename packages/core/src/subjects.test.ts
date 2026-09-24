import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CurrentUser } from "@cognelo/contracts";

vi.mock("./media-assets", () => ({ reconcileMediaAssetReferences: vi.fn() }));
import type { AppError } from "./errors";

const transaction = vi.hoisted(() => ({
  bankActivity: { delete: vi.fn(), deleteMany: vi.fn() }
}));

const mockPrisma = vi.hoisted(() => ({
  $transaction: vi.fn(async (handler: (client: typeof transaction) => unknown) => handler(transaction)),
  activity: {
    findMany: vi.fn()
  },
  activityBank: {
    findUnique: vi.fn()
  },
  bankActivity: {
    delete: vi.fn(),
    findUnique: vi.fn()
  }
}));

vi.mock("@cognelo/db", () => ({
  prisma: mockPrisma,
  Prisma: {}
}));

vi.mock("@cognelo/activity-sdk", () => ({
  getActivityDefinition: vi.fn()
}));

vi.mock("./plugins", () => ({
  assertActivityTypePluginEnabled: vi.fn()
}));

const { deleteBankActivity, updateBankActivity } = await import("./subjects");

const adminUser: CurrentUser = {
  id: "user-admin",
  email: "admin@example.test",
  name: null,
  firstName: null,
  lastName: null,
  roles: ["admin"]
};

describe("deleteBankActivity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.$transaction.mockImplementation(async (handler: (client: typeof transaction) => unknown) => handler(transaction));
    mockPrisma.activityBank.findUnique.mockResolvedValue({ id: "bank-1", ownerId: "owner-1" });
    mockPrisma.bankActivity.findUnique.mockResolvedValue({
      id: "bank-activity-1",
      bankId: "bank-1",
      activityType: { key: "coding-exercise" }
    });
    mockPrisma.bankActivity.delete.mockResolvedValue({
      id: "bank-activity-1",
      activityType: { key: "coding-exercise" }
    });
  });

  it("blocks deletion of a used bank activity until forced", async () => {
    mockPrisma.activity.findMany.mockResolvedValue([{ courseId: "course-1" }, { courseId: "course-2" }]);

    await expect(deleteBankActivity(adminUser, "bank-1", "bank-activity-1", {})).rejects.toMatchObject({
      status: 409,
      code: "BANK_ACTIVITY_IN_USE",
      details: { courseCount: 2 }
    } satisfies Partial<AppError>);

    expect(mockPrisma.bankActivity.delete).not.toHaveBeenCalled();
  });

  it("deletes a used bank activity when force is confirmed", async () => {
    mockPrisma.activity.findMany.mockResolvedValue([{ courseId: "course-1" }]);

    await expect(deleteBankActivity(adminUser, "bank-1", "bank-activity-1", { force: true })).resolves.toEqual({
      bankActivityId: "bank-activity-1",
      activityTypeKey: "coding-exercise",
      courseCount: 1,
      deletedActivities: [{ bankActivityId: "bank-activity-1", activityTypeKey: "coding-exercise" }]
    });

    expect(mockPrisma.bankActivity.delete).toHaveBeenCalledWith({
      where: { id: "bank-activity-1" },
      include: { activityType: true }
    });
  });

  it("rejects deletion when the activity does not belong to the bank", async () => {
    mockPrisma.bankActivity.findUnique.mockResolvedValue({
      id: "bank-activity-1",
      bankId: "other-bank",
      activityType: { key: "coding-exercise" }
    });

    await expect(deleteBankActivity(adminUser, "bank-1", "bank-activity-1", { force: true })).rejects.toMatchObject({
      status: 404,
      code: "NOT_FOUND"
    });
  });

  it("deletes a reusable Test and all of its independently owned child activities", async () => {
    mockPrisma.bankActivity.findUnique.mockResolvedValue({
      id: "test-shell-1",
      bankId: "bank-1",
      activityType: { key: "test" },
      bankTestDefinition: {
        items: [
          { activity: { id: "owned-child-1", activityType: { key: "coding-exercise" } } },
          { activity: { id: "owned-child-2", activityType: { key: "mcq" } } }
        ]
      }
    });
    mockPrisma.activity.findMany.mockResolvedValue([{ courseId: "course-1" }]);
    transaction.bankActivity.delete.mockResolvedValue({ id: "test-shell-1", activityType: { key: "test" } });

    await expect(deleteBankActivity(adminUser, "bank-1", "test-shell-1", { force: true })).resolves.toMatchObject({
      courseCount: 1,
      deletedActivities: [
        { bankActivityId: "owned-child-1", activityTypeKey: "coding-exercise" },
        { bankActivityId: "owned-child-2", activityTypeKey: "mcq" },
        { bankActivityId: "test-shell-1", activityTypeKey: "test" }
      ]
    });
    expect(transaction.bankActivity.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ["owned-child-1", "owned-child-2"] } }
    });
  });
});

describe("updateBankActivity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.activityBank.findUnique.mockResolvedValue({ id: "bank-1", ownerId: "owner-1" });
  });

  it("requires the compound authoring route for reusable Test shells", async () => {
    mockPrisma.bankActivity.findUnique.mockResolvedValue({
      id: "test-shell-1",
      bankId: "bank-1",
      activityType: { id: "type-test", key: "test" },
      bankTestDefinition: { id: "bank-test-1" }
    });

    await expect(updateBankActivity(adminUser, "test-shell-1", { title: "Changed Test" })).rejects.toMatchObject({
      status: 400,
      code: "BANK_TEST_UPDATE_ROUTE_REQUIRED"
    });
  });
});
