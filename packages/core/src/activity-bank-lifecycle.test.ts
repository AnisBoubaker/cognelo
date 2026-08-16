import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CurrentUser } from "@cognelo/contracts";

const transaction = vi.hoisted(() => ({
  activityBank: { delete: vi.fn() },
  bankActivity: { findFirst: vi.fn(), update: vi.fn() }
}));

const mockPrisma = vi.hoisted(() => ({
  $transaction: vi.fn(async (handler: (client: typeof transaction) => unknown) => handler(transaction)),
  activityBank: { delete: vi.fn(), findUnique: vi.fn() }
}));

vi.mock("@cognelo/db", () => ({ prisma: mockPrisma, Prisma: {} }));
vi.mock("@cognelo/activity-sdk", () => ({ getActivityDefinition: vi.fn() }));
vi.mock("./plugins", () => ({ assertActivityTypePluginEnabled: vi.fn() }));

const { deleteActivityBank } = await import("./subjects");

const teacher: CurrentUser = {
  id: "teacher-1", email: "teacher@example.test", name: null, firstName: null, lastName: null, roles: ["teacher"]
};

const source = {
  id: "bank-1",
  ownerId: teacher.id,
  subjectId: "subject-1",
  activities: [
    { id: "activity-1", position: 2, activityType: { key: "mcq" } },
    { id: "activity-2", position: 8, activityType: { key: "parsons" } }
  ]
};

describe("activity bank deletion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.$transaction.mockImplementation(async (handler: (client: typeof transaction) => unknown) => handler(transaction));
  });

  it("moves activities in order to a writable bank under the same subject before deletion", async () => {
    mockPrisma.activityBank.findUnique
      .mockResolvedValueOnce(source)
      .mockResolvedValueOnce(source)
      .mockResolvedValueOnce({ id: "bank-2", ownerId: teacher.id, subjectId: "subject-1" })
      .mockResolvedValueOnce({ id: "bank-2", ownerId: teacher.id, subjectId: "subject-1" });
    transaction.bankActivity.findFirst.mockResolvedValue({ position: 4 });

    await expect(deleteActivityBank(teacher, "bank-1", { action: "move", targetActivityBankId: "bank-2" })).resolves.toEqual({
      activityCount: 2,
      deletedActivities: []
    });
    expect(transaction.bankActivity.update).toHaveBeenNthCalledWith(1, { where: { id: "activity-1" }, data: { bankId: "bank-2", position: 5 } });
    expect(transaction.bankActivity.update).toHaveBeenNthCalledWith(2, { where: { id: "activity-2" }, data: { bankId: "bank-2", position: 6 } });
    expect(transaction.activityBank.delete).toHaveBeenCalledWith({ where: { id: "bank-1" } });
  });

  it("requires force before deleting a populated bank", async () => {
    mockPrisma.activityBank.findUnique.mockResolvedValue(source);
    await expect(deleteActivityBank(teacher, "bank-1", { action: "delete" })).rejects.toMatchObject({
      status: 409,
      code: "ACTIVITY_BANK_NOT_EMPTY",
      details: { activityCount: 2 }
    });
    expect(mockPrisma.activityBank.delete).not.toHaveBeenCalled();
  });

  it("returns deleted activities for plugin cleanup after forced deletion", async () => {
    mockPrisma.activityBank.findUnique.mockResolvedValue(source);
    await expect(deleteActivityBank(teacher, "bank-1", { action: "delete", force: true })).resolves.toEqual({
      activityCount: 2,
      deletedActivities: [
        { bankActivityId: "activity-1", activityTypeKey: "mcq" },
        { bankActivityId: "activity-2", activityTypeKey: "parsons" }
      ]
    });
    expect(mockPrisma.activityBank.delete).toHaveBeenCalledWith({ where: { id: "bank-1" } });
  });
});
