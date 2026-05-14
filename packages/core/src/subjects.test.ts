import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CurrentUser } from "@cognelo/contracts";

const mockPrisma = vi.hoisted(() => ({
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

const { deleteBankActivity } = await import("./subjects");
const { AppError } = await import("./errors");

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
    } satisfies Partial<InstanceType<typeof AppError>>);

    expect(mockPrisma.bankActivity.delete).not.toHaveBeenCalled();
  });

  it("deletes a used bank activity when force is confirmed", async () => {
    mockPrisma.activity.findMany.mockResolvedValue([{ courseId: "course-1" }]);

    await expect(deleteBankActivity(adminUser, "bank-1", "bank-activity-1", { force: true })).resolves.toEqual({
      bankActivityId: "bank-activity-1",
      activityTypeKey: "coding-exercise",
      courseCount: 1
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
});
