import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CurrentUser } from "@cognelo/contracts";

const tx = vi.hoisted(() => ({
  activity: { create: vi.fn(), update: vi.fn() },
  activityVersion: { create: vi.fn(), findFirst: vi.fn() },
  bankActivity: { create: vi.fn(), update: vi.fn(), delete: vi.fn() },
  bankTest: { create: vi.fn(), update: vi.fn(), findUniqueOrThrow: vi.fn() },
  bankTestItem: { create: vi.fn(), update: vi.fn() },
  bankTestVersion: { create: vi.fn() },
  courseContentItem: { count: vi.fn(), create: vi.fn(), findFirst: vi.fn() },
  test: { create: vi.fn(), findUniqueOrThrow: vi.fn() },
  testItem: { create: vi.fn() }
}));

const db = vi.hoisted(() => ({
  $transaction: vi.fn(async (handler: (transaction: typeof tx) => unknown) => handler(tx)),
  activityBank: { findUnique: vi.fn() },
  activityBankFolder: { findFirst: vi.fn() },
  activityType: { findUnique: vi.fn() },
  activityVersion: { findFirst: vi.fn() },
  bankActivity: { findFirst: vi.fn(), findUnique: vi.fn() },
  bankTest: { findFirst: vi.fn(), findUnique: vi.fn() },
  bankTestItem: { findFirst: vi.fn() },
  bankTestVersion: { findUnique: vi.fn() },
  course: { findUnique: vi.fn() },
  test: { findFirst: vi.fn() }
}));

const authorization = vi.hoisted(() => ({ assertCanManageCourse: vi.fn() }));
const subjects = vi.hoisted(() => ({ assertCanManageActivityBank: vi.fn(), assertCanViewActivityBank: vi.fn() }));
const plugins = vi.hoisted(() => ({ assertActivityTypeAvailable: vi.fn(), ensureCoreActivityTypes: vi.fn() }));
const media = vi.hoisted(() => ({ reconcileMediaAssetReferences: vi.fn() }));

vi.mock("@cognelo/db", () => ({ prisma: db, Prisma: {} }));
vi.mock("./authorization", () => authorization);
vi.mock("./subjects", () => subjects);
vi.mock("./plugins", () => plugins);
vi.mock("./media-assets", () => media);
vi.mock("@cognelo/activity-sdk", () => ({
  getActivityDefinition: vi.fn(() => ({ defaultConfig: {} })),
  getActivityProviderForActivityType: vi.fn((key: string) => key === "test" ? { kind: "core", key } : { kind: "plugin", key })
}));

const { createBankTestFromCourse, createBankTestItem, createCourseTestFromBankVersion, deleteBankTestItem, linkCourseTestToPublishedBankCopy, updateBankTest } = await import("./bank-tests");

const teacher: CurrentUser = {
  id: "teacher-1",
  email: "teacher@example.test",
  name: null,
  firstName: null,
  lastName: null,
  roles: ["teacher"]
};

describe("reusable bank Test services", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.$transaction.mockImplementation(async (handler: (transaction: typeof tx) => unknown) => handler(tx));
    tx.courseContentItem.count.mockResolvedValue(0);
  });

  it("copies a published bank activity into an independently owned bank Test child", async () => {
    db.bankTest.findFirst.mockResolvedValue({
      id: "bank-test-1",
      bankActivityId: "test-shell-1",
      activity: { bank: { subjectId: "subject-1" } },
      _count: { items: 0 }
    });
    db.activityVersion.findFirst.mockResolvedValue({
      id: "source-version-2",
      bankActivityId: "source-activity-1",
      activityTypeId: "type-coding",
      title: "Factorial",
      description: "Implement factorial",
      lifecycle: "published",
      config: { prompt: "Factorial" },
      metadata: {},
      activityType: { key: "coding-exercise" },
      knowledgeConcepts: [],
      bankActivity: { bank: { subjectId: "subject-1" } }
    });
    tx.bankActivity.create.mockResolvedValue({
      id: "owned-child-1",
      title: "Factorial",
      description: "Implement factorial",
      config: { prompt: "Factorial" },
      activityType: { key: "coding-exercise" }
    });
    tx.bankTestItem.create.mockResolvedValue({ id: "item-1", bankActivityId: "owned-child-1" });

    const result = await createBankTestItem(teacher, "bank-1", "test-shell-1", {
      source: "bank",
      bankActivityId: "source-activity-1",
      activityVersionId: "source-version-2"
    });

    expect(tx.bankActivity.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        bankId: "bank-1",
        title: "Factorial",
        lifecycle: "draft"
      })
    }));
    expect(tx.bankTestItem.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ bankTestId: "bank-test-1", bankActivityId: "owned-child-1" })
    }));
    expect(result.sourceBankActivityId).toBe("source-activity-1");
    expect(result.activity.id).not.toBe("source-activity-1");
  });

  it("archives a removed child so existing published Test versions keep their snapshot", async () => {
    db.bankTestItem.findFirst.mockResolvedValue({
      id: "item-1",
      bankActivityId: "owned-child-1",
      activity: { activityType: { key: "coding-exercise" } }
    });

    await deleteBankTestItem(teacher, "bank-1", "test-shell-1", "item-1");

    expect(tx.bankTestItem.update).toHaveBeenCalledWith({
      where: { id: "item-1" },
      data: { removedAt: expect.any(Date) }
    });
    expect(tx.bankActivity.update).toHaveBeenNthCalledWith(1, {
      where: { id: "owned-child-1" },
      data: { lifecycle: "archived" }
    });
    expect(tx.bankActivity.update).toHaveBeenNthCalledWith(2, {
      where: { id: "test-shell-1" },
      data: { lifecycle: "draft" }
    });
    expect(tx.bankActivity.delete).not.toHaveBeenCalled();
  });

  it("publishes a Test as a shell version plus an ordered immutable composition snapshot", async () => {
    db.bankTest.findFirst.mockResolvedValue({
      id: "bank-test-1",
      bankActivityId: "test-shell-1",
      settings: { navigationMode: "free", randomizeItems: false, allowResume: true, timeLimitMinutes: null },
      activity: { id: "test-shell-1", bankId: "bank-1" }
    });
    tx.bankActivity.update.mockResolvedValue({
      id: "test-shell-1",
      title: "Reusable midterm",
      description: "Instructions",
      lifecycle: "draft",
      config: {},
      metadata: { coreActivity: "test" }
    });
    tx.bankTest.findUniqueOrThrow.mockResolvedValue({
      id: "bank-test-1",
      bankActivityId: "test-shell-1",
      settings: { navigationMode: "free", randomizeItems: false, allowResume: true, timeLimitMinutes: null },
      activity: {
        id: "test-shell-1",
        activityTypeId: "type-test",
        title: "Reusable midterm",
        description: "Instructions",
        config: {},
        metadata: { coreActivity: "test" },
        activityType: { key: "test" }
      },
      items: [{
        id: "item-1",
        position: 0,
        pointsPossible: 5,
        isRequired: true,
        metadata: {},
        activity: {
          id: "owned-child-1",
          activityTypeId: "type-mcq",
          title: "Question 1",
          description: "",
          config: { source: "## Q" },
          metadata: {},
          knowledgeConcepts: []
        }
      }],
      versions: []
    });
    tx.activityVersion.findFirst.mockResolvedValue(null);
    tx.activityVersion.create
      .mockResolvedValueOnce({ id: "child-version-1", title: "Question 1", description: "", config: {}, knowledgeConcepts: [] })
      .mockResolvedValueOnce({ id: "shell-version-1", title: "Reusable midterm", description: "Instructions", config: {} });
    tx.bankTestVersion.create.mockResolvedValue({ id: "bank-test-version-1" });

    await updateBankTest(teacher, "bank-1", "test-shell-1", { lifecycle: "published" });

    expect(tx.bankTestVersion.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        bankTestId: "bank-test-1",
        activityVersionId: "shell-version-1",
        items: {
          create: [expect.objectContaining({
            sourceBankTestItemId: "item-1",
            activityVersionId: "child-version-1",
            position: 0,
            pointsPossible: 5
          })]
        }
      })
    });
    expect(tx.bankActivity.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "test-shell-1" },
      data: { lifecycle: "published", currentVersionId: "shell-version-1" }
    }));
  });

  it("reuses the current Test version when the shell and composition are unchanged", async () => {
    const settings = { navigationMode: "free", randomizeItems: false, allowResume: true, timeLimitMinutes: null };
    const activity = {
      id: "test-shell-1",
      activityTypeId: "type-test",
      title: "Reusable midterm",
      description: "Instructions",
      config: {},
      metadata: { coreActivity: "test" },
      activityType: { key: "test" }
    };
    const child = {
      id: "owned-child-1",
      activityTypeId: "type-mcq",
      title: "Question 1",
      description: "",
      config: { source: "## Q" },
      metadata: {},
      knowledgeConcepts: []
    };
    const composition = {
      id: "bank-test-1",
      bankActivityId: "test-shell-1",
      settings,
      activity,
      items: [{
        id: "item-1",
        position: 0,
        pointsPossible: 5,
        isRequired: true,
        metadata: {},
        activity: child
      }],
      versions: [{
        id: "bank-test-version-1",
        activityVersionId: "shell-version-1",
        settings,
        activityVersion: {
          id: "shell-version-1",
          bankActivityId: "test-shell-1",
          versionNumber: 1,
          createdAt: new Date(),
          activityTypeId: activity.activityTypeId,
          title: activity.title,
          description: activity.description,
          config: activity.config,
          metadata: activity.metadata
        },
        items: [{
          sourceBankTestItemId: "item-1",
          position: 0,
          pointsPossible: 5,
          isRequired: true,
          metadata: {},
          activityVersion: {
            id: "child-version-1",
            bankActivityId: "owned-child-1",
            versionNumber: 1,
            createdAt: new Date(),
            activityTypeId: child.activityTypeId,
            title: child.title,
            description: child.description,
            config: child.config,
            metadata: child.metadata,
            knowledgeConcepts: []
          }
        }]
      }]
    };
    db.bankTest.findFirst.mockResolvedValue({
      id: "bank-test-1",
      bankActivityId: "test-shell-1",
      settings,
      activity: { id: "test-shell-1", bankId: "bank-1" }
    });
    tx.bankActivity.update.mockResolvedValue(activity);
    tx.bankTest.findUniqueOrThrow.mockResolvedValue(composition);

    await updateBankTest(teacher, "bank-1", "test-shell-1", { lifecycle: "published" });

    expect(tx.activityVersion.create).not.toHaveBeenCalled();
    expect(tx.bankTestVersion.create).not.toHaveBeenCalled();
    expect(tx.bankActivity.update).toHaveBeenCalledWith({
      where: { id: "test-shell-1" },
      data: { lifecycle: "published", currentVersionId: "shell-version-1" }
    });
  });

  it("deep-copies a published bank Test and every snapshotted child into a course", async () => {
    db.course.findUnique.mockResolvedValue({ subjectId: "subject-1" });
    db.activityVersion.findFirst.mockResolvedValue({
      id: "shell-version-2",
      bankActivityId: "test-shell-1",
      activityTypeId: "type-test",
      title: "Reusable midterm",
      description: "Instructions",
      lifecycle: "published",
      versionNumber: 2,
      config: {},
      metadata: {},
      activityType: { key: "test" },
      knowledgeConcepts: [],
      bankActivity: { bank: { subjectId: "subject-1" } }
    });
    db.bankTestVersion.findUnique.mockResolvedValue({
      id: "bank-test-version-2",
      settings: { navigationMode: "free", randomizeItems: false, allowResume: true, timeLimitMinutes: 60 },
      activityVersion: {
        id: "shell-version-2",
        bankActivityId: "test-shell-1",
        activityTypeId: "type-test",
        title: "Reusable midterm",
        description: "Instructions",
        versionNumber: 2,
        config: {},
        metadata: {}
      },
      test: { activity: { bank: { subjectId: "subject-1" } } },
      items: [{
        id: "version-item-1",
        position: 0,
        pointsPossible: 5,
        isRequired: true,
        metadata: {},
        activityVersion: {
          id: "child-version-3",
          bankActivityId: "owned-child-1",
          activityTypeId: "type-mcq",
          versionNumber: 3,
          title: "Question 1",
          description: "",
          config: { source: "## Q" },
          metadata: {},
          activityType: { key: "mcq", name: "MCQ", description: "" },
          knowledgeConcepts: []
        }
      }]
    });
    tx.activity.create
      .mockResolvedValueOnce({ id: "course-test-shell", title: "Reusable midterm", description: "Instructions", config: {} })
      .mockResolvedValueOnce({
        id: "course-child-1",
        title: "Question 1",
        description: "",
        lifecycle: "draft",
        config: { source: "## Q" },
        metadata: { activityVersionNumber: 3 },
        activityType: { key: "mcq", name: "MCQ", description: "" }
      });
    tx.test.create.mockResolvedValue({ id: "course-test-1" });
    tx.test.findUniqueOrThrow.mockResolvedValue({ id: "course-test-1", activityId: "course-test-shell", items: [] });

    const result = await createCourseTestFromBankVersion(teacher, "course-1", {
      bankActivityId: "test-shell-1",
      activityVersionId: "shell-version-2",
      contentPlacement: { isVisible: true }
    });

    expect(tx.activity.create).toHaveBeenNthCalledWith(1, { data: expect.objectContaining({
      bankActivityId: "test-shell-1",
      activityVersionId: "shell-version-2",
      title: "Reusable midterm"
    }) });
    expect(tx.activity.create).toHaveBeenNthCalledWith(2, expect.objectContaining({ data: expect.objectContaining({
      bankActivityId: "owned-child-1",
      activityVersionId: "child-version-3",
      title: "Question 1"
    }) }));
    expect(tx.testItem.create).toHaveBeenCalledWith({ data: expect.objectContaining({ activityId: "course-child-1", pointsPossible: 5 }) });
    expect(result.activityCopies).toEqual([expect.objectContaining({ bankActivityId: "owned-child-1", activityVersionId: "child-version-3" })]);
  });

  it("copies a course Test into a new independent bank draft and can link the course graph to its published versions", async () => {
    db.course.findUnique.mockResolvedValue({ subjectId: "subject-1" });
    db.activityBank.findUnique.mockResolvedValue({ subjectId: "subject-1" });
    db.bankActivity.findFirst.mockResolvedValue(null);
    db.test.findFirst
      .mockResolvedValueOnce({
        id: "course-test-1",
        settings: { navigationMode: "free" },
        activity: {
          id: "course-shell-1",
          bankActivityId: null,
          activityVersionId: null,
          activityTypeId: "type-test",
          title: "Course midterm",
          description: "Instructions",
          lifecycle: "draft",
          config: {},
          metadata: { coreActivity: "test" },
          knowledgeConcepts: [],
          activityType: { key: "test", name: "Test", description: "" }
        },
        items: [{
          id: "course-item-1",
          activityId: "course-child-1",
          position: 0,
          pointsPossible: 4,
          isRequired: true,
          metadata: {},
          activity: {
            id: "course-child-1",
            activityTypeId: "type-mcq",
            title: "Question",
            description: "",
            lifecycle: "draft",
            config: { source: "## Q" },
            metadata: {},
            knowledgeConcepts: [],
            activityType: { key: "mcq", name: "MCQ", description: "" }
          }
        }]
      })
      .mockResolvedValueOnce({
        id: "course-test-1",
        activity: { id: "course-shell-1", metadata: { coreActivity: "test" } },
        items: [{ activityId: "course-child-1", activity: { id: "course-child-1", metadata: {} } }]
      });
    tx.bankActivity.create
      .mockResolvedValueOnce({ id: "bank-shell-1", title: "Course midterm", description: "Instructions", config: {} })
      .mockResolvedValueOnce({ id: "bank-child-1", title: "Question", description: "", config: {}, activityType: { key: "mcq" } });
    tx.bankTest.create.mockResolvedValue({ id: "bank-test-1" });
    tx.bankTest.findUniqueOrThrow.mockResolvedValue({ id: "bank-test-1", bankActivityId: "bank-shell-1", activity: { id: "bank-shell-1" }, items: [] });

    const draft = await createBankTestFromCourse(teacher, "course-1", "course-shell-1", { activityBankId: "bank-1" });

    expect(tx.bankActivity.create).toHaveBeenNthCalledWith(2, expect.objectContaining({ data: expect.objectContaining({
      bankId: "bank-1",
      title: "Question",
      lifecycle: "draft"
    }) }));
    expect(draft.activityCopies).toEqual([expect.objectContaining({
      sourceActivity: expect.objectContaining({ id: "course-child-1" }),
      bankActivity: expect.objectContaining({ id: "bank-child-1" })
    })]);

    await linkCourseTestToPublishedBankCopy(teacher, "course-1", "course-shell-1", {
      bankActivityId: "bank-shell-1",
      activityVersionId: "bank-shell-version-1",
      versionNumber: 1,
      items: [{
        sourceActivityId: "course-child-1",
        bankActivityId: "bank-child-1",
        activityVersionId: "bank-child-version-1",
        versionNumber: 1
      }]
    });

    expect(tx.activity.update).toHaveBeenNthCalledWith(1, expect.objectContaining({
      where: { id: "course-shell-1" },
      data: expect.objectContaining({ bankActivityId: "bank-shell-1", activityVersionId: "bank-shell-version-1" })
    }));
    expect(tx.activity.update).toHaveBeenNthCalledWith(2, expect.objectContaining({
      where: { id: "course-child-1" },
      data: expect.objectContaining({ bankActivityId: "bank-child-1", activityVersionId: "bank-child-version-1" })
    }));
  });
});
