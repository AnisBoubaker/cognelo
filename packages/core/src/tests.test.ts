import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CurrentUser } from "@cognelo/contracts";

const tx = vi.hoisted(() => ({
  activity: { create: vi.fn(), update: vi.fn(), deleteMany: vi.fn(), delete: vi.fn() },
  test: { create: vi.fn(), update: vi.fn(), findUniqueOrThrow: vi.fn() },
  courseContentItem: { count: vi.fn(), create: vi.fn(), findFirst: vi.fn(), updateMany: vi.fn() }
}));

const db = vi.hoisted(() => ({
  $transaction: vi.fn(async (handler: (transaction: typeof tx) => unknown) => handler(tx)),
  activityType: { findUnique: vi.fn() },
  test: { findFirst: vi.fn(), findUniqueOrThrow: vi.fn() },
  testItem: { create: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
  activity: { delete: vi.fn() },
  activityVersion: { findFirst: vi.fn() },
  bankActivity: { findUnique: vi.fn() }
}));

const authorization = vi.hoisted(() => ({ assertCanManageCourse: vi.fn(), assertCanViewCourse: vi.fn() }));
const plugins = vi.hoisted(() => ({ ensureCoreActivityTypes: vi.fn() }));
const activities = vi.hoisted(() => ({ createActivity: vi.fn() }));

vi.mock("@cognelo/db", () => ({ prisma: db, Prisma: {} }));
vi.mock("./authorization", () => authorization);
vi.mock("./plugins", () => plugins);
vi.mock("./activities", () => activities);
vi.mock("@cognelo/activity-sdk", () => ({
  getActivityDefinition: vi.fn(() => ({ grading: { supportsAttempts: true, supportsAutoGrading: true } })),
  getActivityProviderForActivityType: vi.fn(() => ({ kind: "plugin", key: "mcq" }))
}));

const { createTest, createTestItem } = await import("./tests");

const teacher: CurrentUser = {
  id: "teacher-1",
  email: "teacher@example.test",
  name: null,
  firstName: null,
  lastName: null,
  roles: ["teacher"]
};

describe("Test authoring services", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.$transaction.mockImplementation(async (handler: (transaction: typeof tx) => unknown) => handler(tx));
    tx.courseContentItem.count.mockResolvedValue(0);
  });

  it("creates a core Test shell and normalized Test row", async () => {
    db.activityType.findUnique.mockResolvedValue({ id: "type-test", key: "test", providerKind: "core" });
    tx.activity.create.mockResolvedValue({ id: "activity-test", title: "Midterm" });
    tx.test.create.mockResolvedValue({ id: "test-1" });
    tx.test.findUniqueOrThrow.mockResolvedValue({ id: "test-1", activityId: "activity-test", items: [] });

    await createTest(teacher, "course-1", { title: "Midterm", contentPlacement: { isVisible: true } });

    expect(plugins.ensureCoreActivityTypes).toHaveBeenCalled();
    expect(tx.activity.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ activityTypeId: "type-test", courseId: "course-1", title: "Midterm", createdById: "teacher-1" })
    });
    expect(tx.test.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ courseId: "course-1", activityId: "activity-test", settings: expect.objectContaining({ navigationMode: "free" }) })
    });
    expect(tx.courseContentItem.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ activityId: "activity-test", kind: "activity", titleSnapshot: "Midterm", isVisible: false })
    });
  });

  it("creates a contained local plugin activity as a Test item", async () => {
    db.test.findFirst.mockResolvedValue({ id: "test-1", _count: { items: 2 } });
    activities.createActivity.mockResolvedValue({
      id: "child-1",
      title: "Question set",
      activityType: { key: "mcq", name: "Multiple choice", description: "" }
    });
    db.testItem.create.mockResolvedValue({ id: "item-1", activityId: "child-1" });

    await createTestItem(teacher, "course-1", "test-activity-1", {
      source: "local",
      activityTypeKey: "mcq",
      title: "Question set"
    });

    expect(activities.createActivity).toHaveBeenCalledWith(teacher, "course-1", expect.objectContaining({
      activityTypeKey: "mcq",
      title: "Question set",
      position: 2
    }));
    expect(db.testItem.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ testId: "test-1", activityId: "child-1", position: 2 })
    }));
  });
});
