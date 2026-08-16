import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CurrentUser } from "@cognelo/contracts";

const mockPrisma = vi.hoisted(() => ({
  activity: { findFirst: vi.fn(), update: vi.fn() }, activityAttempt: { count: vi.fn() }, activityVersion: { findFirst: vi.fn() },
  gradebookItem: { updateMany: vi.fn() }, courseMembership: { findMany: vi.fn() }
}));
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
      status: "diverged", mutationsAllowed: true, canWriteToBank: true
    });
  });

  it("blocks every mutation when any attempt exists", async () => {
    mockPrisma.activity.findFirst.mockResolvedValue(linkedActivity);
    mockPrisma.activityAttempt.count.mockResolvedValue(1);
    await expect(syncCourseActivityWithBank(admin, "course-1", "activity-1", { action: "retrieve_latest" }))
      .rejects.toMatchObject({ code: "ACTIVITY_BANK_SYNC_ATTEMPTS_LOCKED", status: 409 });
    expect(mockPrisma.activity.update).not.toHaveBeenCalled();
  });
});
