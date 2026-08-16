import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CurrentUser } from "@cognelo/contracts";

const transaction = vi.hoisted(() => ({
  activity: { create: vi.fn() },
  courseContentItem: { create: vi.fn() }
}));
const mockPrisma = vi.hoisted(() => ({
  $transaction: vi.fn(async (handler: (client: typeof transaction) => unknown) => handler(transaction)),
  activity: { findFirst: vi.fn() },
  courseContentItem: { count: vi.fn(), findFirst: vi.fn() }
}));

vi.mock("@cognelo/db", () => ({ prisma: mockPrisma, Prisma: {} }));
vi.mock("@cognelo/activity-sdk", () => ({
  getActivityDefinition: vi.fn(), getActivityPluginForActivityType: vi.fn(), isCoreActivityType: vi.fn(() => false), listActivityDefinitions: vi.fn(() => [])
}));
vi.mock("./plugins", () => ({ assertActivityTypeAvailable: vi.fn(), ensureCoreActivityTypes: vi.fn(), getEnabledActivityPluginKeys: vi.fn() }));

const { duplicateCourseActivity } = await import("./activities");
const admin: CurrentUser = { id: "admin-1", email: "admin@example.test", name: null, firstName: null, lastName: null, roles: ["admin"] };

describe("duplicateCourseActivity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.$transaction.mockImplementation(async (handler: (client: typeof transaction) => unknown) => handler(transaction));
  });

  it("preserves bank-version traceability and places the copy in the same folder", async () => {
    mockPrisma.activity.findFirst
      .mockResolvedValueOnce({
        id: "activity-1", courseId: "course-1", bankActivityId: "bank-activity-1", activityVersionId: "version-3",
        activityTypeId: "type-1", activityType: { key: "mcq" }, title: "Quiz", description: "Loops", lifecycle: "published",
        config: { choices: [] }, metadata: { activityVersionNumber: 3, allGroupsAssignment: { enabled: true } }, position: 2,
        knowledgeConcepts: [{ conceptId: "concept-1", selectsAllSkills: true, selectedSkills: [], selectedSkillIds: [] }], testDefinition: null
      })
      .mockResolvedValueOnce({ position: 7 });
    mockPrisma.courseContentItem.findFirst.mockResolvedValue({ parentId: "folder-1", isVisible: false, metadata: { color: "blue" } });
    mockPrisma.courseContentItem.count.mockResolvedValue(4);
    transaction.activity.create.mockResolvedValue({ id: "activity-2", activityType: { key: "mcq" } });

    await duplicateCourseActivity(admin, "course-1", "activity-1", { title: "Quiz (copy)", contentItemId: "content-1" });

    expect(transaction.activity.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({
      bankActivityId: "bank-activity-1", activityVersionId: "version-3", title: "Quiz (copy)", lifecycle: "draft", position: 8,
      metadata: { activityVersionNumber: 3 }
    }) }));
    expect(transaction.courseContentItem.create).toHaveBeenCalledWith({ data: {
      courseId: "course-1", parentId: "folder-1", kind: "activity", titleSnapshot: "Quiz (copy)", position: 4,
      isVisible: false, activityId: "activity-2", metadata: { color: "blue" }
    } });
  });
});
