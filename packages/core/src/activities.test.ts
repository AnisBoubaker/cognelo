import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CurrentUser } from "@cognelo/contracts";

const mockPrisma = vi.hoisted(() => ({
  activity: {
    create: vi.fn(),
    findFirst: vi.fn()
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
  }
}));

const authMocks = vi.hoisted(() => ({
  assertCanManageCourse: vi.fn(),
  assertCanViewCourse: vi.fn()
}));

const pluginMocks = vi.hoisted(() => ({
  assertActivityTypePluginEnabled: vi.fn(),
  getEnabledActivityPluginKeys: vi.fn()
}));

vi.mock("@cognelo/db", () => ({
  prisma: mockPrisma,
  Prisma: {}
}));

vi.mock("@cognelo/activity-sdk", () => ({
  getActivityDefinition: vi.fn(() => ({ defaultConfig: { attempts: 3 } })),
  getActivityPluginForActivityType: vi.fn(),
  listActivityDefinitions: vi.fn()
}));

vi.mock("./authorization", () => authMocks);
vi.mock("./plugins", () => pluginMocks);

const { createActivity, deleteActivity } = await import("./activities");

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
  });

  it("creates a local course activity only for enabled activity types", async () => {
    mockPrisma.activityType.findUnique.mockResolvedValue({ id: "type-1", key: "placeholder", isEnabled: true });
    mockPrisma.activity.create.mockResolvedValue({ id: "activity-1" });

    await createActivity(teacherUser, "course-1", {
      activityTypeKey: "placeholder",
      title: "Local activity",
      config: { color: "blue" }
    });

    expect(pluginMocks.assertActivityTypePluginEnabled).toHaveBeenCalledWith("placeholder");
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

    expect(pluginMocks.assertActivityTypePluginEnabled).toHaveBeenCalledWith("coding-exercise");
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

  it("deletes only course-local activity IDs that belong to the course", async () => {
    mockPrisma.activity.findFirst.mockResolvedValue(null);

    await expect(deleteActivity(teacherUser, "course-1", "activity-1")).rejects.toMatchObject({
      status: 404,
      code: "NOT_FOUND"
    });
  });
});
