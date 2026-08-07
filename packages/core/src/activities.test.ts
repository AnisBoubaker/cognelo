import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CurrentUser } from "@cognelo/contracts";

const tx = vi.hoisted(() => ({
  activity: {
    create: vi.fn(),
    update: vi.fn()
  },
  courseContentItem: {
    count: vi.fn(),
    create: vi.fn(),
    findFirst: vi.fn()
  },
  gradebookItem: {
    updateMany: vi.fn()
  }
}));

const mockPrisma = vi.hoisted(() => ({
  $transaction: vi.fn(async (handler: (transaction: typeof tx) => unknown) => handler(tx)),
  activity: {
    create: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn()
  },
  activityType: {
    findUnique: vi.fn()
  },
  activityVersion: {
    findUnique: vi.fn()
  },
  bankActivity: {
    findUnique: vi.fn()
  },
  course: {
    findUnique: vi.fn()
  },
  activityAttempt: {
    count: vi.fn()
  }
}));

const authMocks = vi.hoisted(() => ({
  assertCanManageCourse: vi.fn(),
  assertCanViewCourse: vi.fn()
}));

const pluginMocks = vi.hoisted(() => ({
  assertActivityTypeAvailable: vi.fn(),
  getEnabledActivityPluginKeys: vi.fn()
}));

vi.mock("@cognelo/db", () => ({
  prisma: mockPrisma,
  Prisma: {}
}));

vi.mock("@cognelo/activity-sdk", () => ({
  getActivityDefinition: vi.fn(() => ({ defaultConfig: { attempts: 3 } })),
  getActivityPluginForActivityType: vi.fn(),
  isCoreActivityType: vi.fn((key: string) => key === "test"),
  listActivityDefinitions: vi.fn()
}));

vi.mock("./authorization", () => authMocks);
vi.mock("./plugins", () => pluginMocks);

const { createActivity, deleteActivity } = await import("./activities");
const { updateActivity } = await import("./activities");

const teacherUser: CurrentUser = {
  id: "teacher-1",
  email: "teacher@example.test",
  name: null,
  firstName: null,
  lastName: null,
  roles: ["teacher"]
};

describe("activity services", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.$transaction.mockImplementation(async (handler: (transaction: typeof tx) => unknown) => handler(tx));
    tx.activity.create.mockImplementation((...args) => mockPrisma.activity.create(...args));
    tx.activity.update.mockImplementation((...args) => mockPrisma.activity.update(...args));
    tx.courseContentItem.count.mockResolvedValue(0);
    mockPrisma.activityAttempt.count.mockResolvedValue(0);
  });

  it("creates a local course activity only for enabled activity types", async () => {
    mockPrisma.activityType.findUnique.mockResolvedValue({ id: "type-1", key: "placeholder", isEnabled: true });
    mockPrisma.activity.create.mockResolvedValue({ id: "activity-1" });

    await createActivity(teacherUser, "course-1", {
      activityTypeKey: "placeholder",
      title: "Local activity",
      config: { color: "blue" }
    });

    expect(pluginMocks.assertActivityTypeAvailable).toHaveBeenCalledWith("placeholder");
    expect(mockPrisma.activity.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          courseId: "course-1",
          activityTypeId: "type-1",
          title: "Local activity",
          config: { attempts: 3, color: "blue" },
          createdById: "teacher-1"
        })
      })
    );
  });

  it("creates a course content item when activity creation includes placement", async () => {
    mockPrisma.activityType.findUnique.mockResolvedValue({ id: "type-1", key: "placeholder", isEnabled: true });
    tx.activity.create.mockResolvedValue({ id: "activity-1", title: "Local activity" });
    tx.courseContentItem.findFirst.mockResolvedValue({ id: "folder-1" });

    await createActivity(teacherUser, "course-1", {
      activityTypeKey: "placeholder",
      title: "Local activity",
      contentPlacement: {
        parentId: "folder-1",
        isVisible: false
      }
    });

    expect(tx.courseContentItem.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        courseId: "course-1",
        parentId: "folder-1",
        kind: "activity",
        titleSnapshot: "Local activity",
        isVisible: false,
        activityId: "activity-1"
      })
    });
  });

  it("rejects local creation when the activity type is not available", async () => {
    mockPrisma.activityType.findUnique.mockResolvedValue({ id: "type-1", key: "placeholder", isEnabled: false });

    await expect(
      createActivity(teacherUser, "course-1", {
        activityTypeKey: "placeholder",
        title: "Local activity"
      })
    ).rejects.toMatchObject({ status: 400, code: "UNKNOWN_ACTIVITY_TYPE" });

    expect(mockPrisma.activity.create).not.toHaveBeenCalled();
  });

  it("requires core activities to use their dedicated creation flow", async () => {
    await expect(
      createActivity(teacherUser, "course-1", {
        activityTypeKey: "test",
        title: "Midterm"
      })
    ).rejects.toMatchObject({ status: 400, code: "CORE_ACTIVITY_CREATION_ROUTE_REQUIRED" });

    expect(mockPrisma.activityType.findUnique).not.toHaveBeenCalled();
    expect(mockPrisma.activity.create).not.toHaveBeenCalled();
  });

  it("copies a bank activity version into a course activity with a bank version link", async () => {
    mockPrisma.course.findUnique.mockResolvedValue({ id: "course-1", subjectId: "subject-1" });
    mockPrisma.bankActivity.findUnique.mockResolvedValue({
      currentVersion: {
        id: "version-1",
        bankActivityId: "bank-activity-1",
        activityTypeId: "type-1",
        title: "Bank title",
        description: "Bank description",
        lifecycle: "published",
        config: { prompt: "Solve it" },
        metadata: { source: "bank" },
        versionNumber: 4,
        activityType: { key: "coding-exercise" },
        bankActivity: {
          bank: { subjectId: "subject-1" }
        }
      }
    });
    mockPrisma.activity.create.mockResolvedValue({
      id: "activity-1",
      bankActivityId: "bank-activity-1",
      activityVersionId: "version-1"
    });

    await createActivity(teacherUser, "course-1", {
      bankActivityId: "bank-activity-1",
      activityTypeKey: "coding-exercise",
      title: "Copied title",
      metadata: { local: true }
    });

    expect(pluginMocks.assertActivityTypeAvailable).toHaveBeenCalledWith("coding-exercise");
    expect(mockPrisma.activity.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          courseId: "course-1",
          bankActivityId: "bank-activity-1",
          activityVersionId: "version-1",
          activityTypeId: "type-1",
          title: "Copied title",
          description: "Bank description",
          config: { prompt: "Solve it" },
          metadata: { source: "bank", local: true, activityVersionNumber: 4 }
        })
      })
    );
  });

  it("rejects copying a bank activity from another subject", async () => {
    mockPrisma.course.findUnique.mockResolvedValue({ id: "course-1", subjectId: "subject-1" });
    mockPrisma.bankActivity.findUnique.mockResolvedValue({
      currentVersion: {
        id: "version-1",
        bankActivityId: "bank-activity-1",
        lifecycle: "published",
        activityType: { key: "coding-exercise" },
        bankActivity: {
          bank: { subjectId: "other-subject" }
        }
      }
    });

    await expect(
      createActivity(teacherUser, "course-1", {
        bankActivityId: "bank-activity-1",
        activityTypeKey: "coding-exercise",
        title: "Copied title"
      })
    ).rejects.toMatchObject({ status: 400, code: "ACTIVITY_BANK_SUBJECT_MISMATCH" });

    expect(mockPrisma.activity.create).not.toHaveBeenCalled();
  });

  it("rejects copying unpublished bank activity versions into a course", async () => {
    mockPrisma.course.findUnique.mockResolvedValue({ id: "course-1", subjectId: "subject-1" });
    mockPrisma.bankActivity.findUnique.mockResolvedValue({
      currentVersion: {
        id: "version-1",
        bankActivityId: "bank-activity-1",
        lifecycle: "draft",
        activityType: { key: "coding-exercise" },
        bankActivity: {
          bank: { subjectId: "subject-1" }
        }
      }
    });

    await expect(
      createActivity(teacherUser, "course-1", {
        bankActivityId: "bank-activity-1",
        activityTypeKey: "coding-exercise",
        title: "Copied title"
      })
    ).rejects.toMatchObject({ status: 400, code: "BANK_ACTIVITY_NOT_PUBLISHED" });

    expect(mockPrisma.activity.create).not.toHaveBeenCalled();
  });

  it("syncs assigned gradebook item titles when a course activity is renamed", async () => {
    mockPrisma.activity.findFirst.mockResolvedValue({
      id: "activity-1",
      title: "Old title",
      activityType: { key: "placeholder" },
      config: {}
    });
    tx.activity.update.mockResolvedValue({
      id: "activity-1",
      title: "TP1"
    });

    await updateActivity(teacherUser, "course-1", "activity-1", { title: "TP1" });

    expect(tx.activity.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "activity-1" },
        data: expect.objectContaining({ title: "TP1" })
      })
    );
    expect(tx.gradebookItem.updateMany).toHaveBeenCalledWith({
      where: { courseId: "course-1", activityId: "activity-1" },
      data: { titleSnapshot: "TP1" }
    });
  });

  it("locks contained child configuration after its Test has an attempt", async () => {
    mockPrisma.activity.findFirst.mockResolvedValue({
      id: "child-activity-1",
      title: "Question set",
      activityType: { key: "mcq" },
      config: {},
      testItem: { test: { activityId: "test-activity-1" } }
    });
    mockPrisma.activityAttempt.count.mockResolvedValue(1);

    await expect(
      updateActivity(teacherUser, "course-1", "child-activity-1", { config: { source: "changed" } })
    ).rejects.toMatchObject({ status: 409, code: "TEST_STRUCTURE_LOCKED" });

    expect(tx.activity.update).not.toHaveBeenCalled();
  });

  it("deletes only course-local activity IDs that belong to the course", async () => {
    mockPrisma.activity.findFirst.mockResolvedValue(null);

    await expect(deleteActivity(teacherUser, "course-1", "activity-1")).rejects.toMatchObject({
      status: 404,
      code: "NOT_FOUND"
    });
  });

  it("prevents direct deletion of an activity owned by a Test", async () => {
    mockPrisma.activity.findFirst.mockResolvedValue({
      id: "child-activity-1",
      courseId: "course-1",
      testItem: { id: "test-item-1" }
    });

    await expect(deleteActivity(teacherUser, "course-1", "child-activity-1")).rejects.toMatchObject({
      status: 409,
      code: "TEST_ITEM_ACTIVITY_OWNED"
    });
  });
});
