import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CurrentUser } from "@cognelo/contracts";

vi.mock("./media-assets", () => ({ reconcileMediaAssetReferences: vi.fn() }));

const mockPrisma = vi.hoisted(() => {
  const transaction = {
    activity: { update: vi.fn() },
    activityVersion: { create: vi.fn() },
    bankActivity: { update: vi.fn() },
    gradebookItem: { updateMany: vi.fn() }
  };
  return {
    activity: { findFirst: vi.fn(), update: vi.fn() },
    activityBank: { findUnique: vi.fn() },
    activityAttempt: { count: vi.fn() },
    activityVersion: { findFirst: vi.fn() },
    gradebookItem: { updateMany: vi.fn() },
    courseMembership: { findMany: vi.fn() },
    transaction,
    $transaction: vi.fn(async (callback: (tx: typeof transaction) => unknown) => callback(transaction))
  };
});
vi.mock("@cognelo/db", () => ({ prisma: mockPrisma, Prisma: {} }));
vi.mock("@cognelo/activity-sdk", () => ({
  getActivityDefinition: vi.fn(), getActivityPluginForActivityType: vi.fn(), isCoreActivityType: vi.fn(() => false), listActivityDefinitions: vi.fn(() => [])
}));
vi.mock("./plugins", () => ({ assertActivityTypeAvailable: vi.fn(), ensureCoreActivityTypes: vi.fn(), getEnabledActivityPluginKeys: vi.fn() }));

const { getCourseActivityBankSyncStatus, syncCourseActivityWithBank } = await import("./activities");
const admin: CurrentUser = { id: "admin-1", email: "admin@example.test", name: null, firstName: null, lastName: null, roles: ["admin"] };
const originalVersion = {
  id: "version-1", versionNumber: 1, bankActivityId: "bank-activity-1", activityTypeId: "type-1", title: "Quiz", description: "Loops",
  lifecycle: "published", config: { questions: [] }, metadata: {}, knowledgeConcepts: []
};
const linkedActivity = {
  id: "activity-1", courseId: "course-1", bankActivityId: "bank-activity-1", activityVersionId: "version-1", activityTypeId: "type-1",
  title: "Quiz", description: "Loops", lifecycle: "draft", config: { questions: [] }, metadata: { activityVersionNumber: 1 },
  activityType: { key: "mcq" }, bankActivity: { bankId: "bank-1", bank: { ownerId: "owner-1" } }, activityVersion: originalVersion, knowledgeConcepts: []
};

describe("course activity bank sync", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("reports divergence when both copies changed", async () => {
    mockPrisma.activity.findFirst.mockResolvedValue({ ...linkedActivity, title: "Local quiz" });
    mockPrisma.activityVersion.findFirst.mockResolvedValue({ ...originalVersion, id: "version-2", versionNumber: 2 });
    mockPrisma.activityAttempt.count.mockResolvedValue(0);
    await expect(getCourseActivityBankSyncStatus(admin, "course-1", "activity-1")).resolves.toMatchObject({
      status: "diverged", retrievalAllowed: true, canWriteToBank: true
    });
  });

  it("reports that bank retrieval is locked when any attempt exists", async () => {
    mockPrisma.activity.findFirst.mockResolvedValue(linkedActivity);
    mockPrisma.activityVersion.findFirst.mockResolvedValue(originalVersion);
    mockPrisma.activityAttempt.count.mockResolvedValue(1);
    await expect(getCourseActivityBankSyncStatus(admin, "course-1", "activity-1")).resolves.toMatchObject({
      attemptCount: 1, retrievalAllowed: false, canWriteToBank: true
    });
  });

  it.each(["retrieve_original", "retrieve_latest"] as const)("blocks %s when any attempt exists", async (action) => {
    mockPrisma.activity.findFirst.mockResolvedValue(linkedActivity);
    mockPrisma.activityAttempt.count.mockResolvedValue(1);
    await expect(syncCourseActivityWithBank(admin, "course-1", "activity-1", { action }))
      .rejects.toMatchObject({ code: "ACTIVITY_BANK_SYNC_ATTEMPTS_LOCKED", status: 409 });
    expect(mockPrisma.activity.update).not.toHaveBeenCalled();
  });

  it("publishes a changed course copy as a new bank version after attempts exist", async () => {
    const courseActivity = { ...linkedActivity, title: "Local quiz" };
    const publishedVersion = { ...originalVersion, id: "version-2", versionNumber: 2, title: "Local quiz" };
    mockPrisma.activity.findFirst.mockResolvedValue(courseActivity);
    mockPrisma.activityBank.findUnique.mockResolvedValue({ id: "bank-1", ownerId: "owner-1" });
    mockPrisma.activityAttempt.count.mockResolvedValue(1);
    mockPrisma.activityVersion.findFirst
      .mockResolvedValueOnce({ versionNumber: 1 })
      .mockResolvedValueOnce(originalVersion);
    mockPrisma.transaction.activityVersion.create.mockResolvedValue(publishedVersion);
    mockPrisma.transaction.bankActivity.update.mockResolvedValue({});
    mockPrisma.transaction.activity.update.mockResolvedValue({
      ...courseActivity,
      activityVersionId: publishedVersion.id,
      activityVersion: publishedVersion
    });

    await expect(
      syncCourseActivityWithBank(admin, "course-1", "activity-1", { action: "publish_to_bank" })
    ).resolves.toMatchObject({ action: "publish_to_bank", version: { id: "version-2", versionNumber: 2 } });

    expect(mockPrisma.activityAttempt.count).not.toHaveBeenCalled();
    expect(mockPrisma.transaction.activityVersion.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ bankActivityId: "bank-activity-1", title: "Local quiz", versionNumber: 2 })
    }));
    expect(mockPrisma.transaction.bankActivity.update).toHaveBeenCalled();
  });
});
