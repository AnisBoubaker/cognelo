import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CurrentUser } from "@cognelo/contracts";

const tx = vi.hoisted(() => ({
  activityBankFolder: {
    delete: vi.fn()
  },
  activityVersion: {
    create: vi.fn()
  },
  bankActivity: {
    create: vi.fn(),
    update: vi.fn()
  }
}));

const mockPrisma = vi.hoisted(() => ({
  $transaction: vi.fn(async (handler: (transaction: typeof tx) => unknown) => handler(tx)),
  activityBank: {
    create: vi.fn(),
    findMany: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn()
  },
  activityBankFolder: {
    create: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn()
  },
  activityType: {
    findUnique: vi.fn()
  },
  activityVersion: {
    findFirst: vi.fn()
  },
  bankActivity: {
    count: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn()
  },
  subject: {
    create: vi.fn(),
    findMany: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn()
  }
}));

vi.mock("@cognelo/db", () => ({
  prisma: mockPrisma,
  Prisma: {}
}));

vi.mock("@cognelo/activity-sdk", () => ({
  getActivityDefinition: vi.fn(() => ({ defaultConfig: { difficulty: "easy" } }))
}));

vi.mock("./plugins", () => ({
  assertActivityTypePluginEnabled: vi.fn()
}));

const {
  createActivityBank,
  createActivityBankFolder,
  createBankActivity,
  createSubject,
  getActivityBank,
  getSubject,
  listActivityBanks,
  listBankActivities,
  listSubjects,
  deleteActivityBankFolder,
  updateActivityBank,
  updateActivityBankFolder,
  updateBankActivityPlacement,
  updateBankActivity,
  updateSubject
} = await import("./subjects");

const adminUser: CurrentUser = {
  id: "admin-1",
  email: "admin@example.test",
  name: null,
  firstName: null,
  lastName: null,
  roles: ["admin"]
};

const teacherUser: CurrentUser = {
  id: "teacher-1",
  email: "teacher@example.test",
  name: null,
  firstName: null,
  lastName: null,
  roles: ["teacher"]
};

describe("subject and activity bank services", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.$transaction.mockImplementation(async (handler: (transaction: typeof tx) => unknown) => handler(tx));
    mockPrisma.activityBankFolder.findFirst.mockResolvedValue(null);
    mockPrisma.activityBankFolder.findMany.mockResolvedValue([]);
    mockPrisma.bankActivity.findFirst.mockResolvedValue(null);
  });

  it("lists, gets, creates, and updates subjects for managers", async () => {
    mockPrisma.subject.findMany.mockResolvedValue([{ id: "subject-1" }]);
    await expect(listSubjects(adminUser)).resolves.toEqual([{ id: "subject-1" }]);

    mockPrisma.subject.findUnique.mockResolvedValue({ id: "subject-1" });
    await expect(getSubject(adminUser, "subject-1")).resolves.toEqual({ id: "subject-1" });

    mockPrisma.subject.create.mockResolvedValue({ id: "subject-1" });
    await createSubject(adminUser, { title: "Programming", teachingLanguage: "fr", metadata: { code: "INF" } });
    expect(mockPrisma.subject.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ title: "Programming", teachingLanguage: "fr", metadata: { code: "INF" }, createdById: "admin-1" })
      })
    );

    mockPrisma.subject.update.mockResolvedValue({ id: "subject-1", title: "Updated" });
    await updateSubject(adminUser, "subject-1", { title: "Updated", teachingLanguage: "zh" });
    expect(mockPrisma.subject.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "subject-1" },
      data: expect.objectContaining({ teachingLanguage: "zh" })
    }));
  });

  it("filters activity banks by subject and lets admins assign bank owners", async () => {
    mockPrisma.activityBank.findMany.mockResolvedValue([]);
    await listActivityBanks(teacherUser, "subject-1");
    expect(mockPrisma.activityBank.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { subjectId: "subject-1" } }));

    mockPrisma.activityBank.create.mockResolvedValue({ id: "bank-1" });
    await createActivityBank(adminUser, {
      subjectId: "subject-1",
      title: "Bank",
      ownerId: "teacher-2"
    });
    expect(mockPrisma.activityBank.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ subjectId: "subject-1", title: "Bank", ownerId: "teacher-2" })
      })
    );
  });

  it("only lets bank owners or admins update activity banks", async () => {
    mockPrisma.activityBank.findUnique.mockResolvedValue({ id: "bank-1", ownerId: "other-user" });

    await expect(updateActivityBank(teacherUser, "bank-1", { title: "Nope" })).rejects.toMatchObject({
      status: 403,
      code: "FORBIDDEN"
    });

    mockPrisma.activityBank.findUnique.mockResolvedValue({ id: "bank-1", ownerId: "teacher-1" });
    mockPrisma.activityBank.update.mockResolvedValue({ id: "bank-1" });
    await updateActivityBank(teacherUser, "bank-1", { title: "Mine" });
    expect(mockPrisma.activityBank.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ title: "Mine", ownerId: undefined })
      })
    );
  });

  it("only changes a bank subject when the bank is empty", async () => {
    mockPrisma.activityBank.findUnique.mockResolvedValue({ id: "bank-1", ownerId: "teacher-1", subjectId: "subject-1" });
    mockPrisma.bankActivity.count.mockResolvedValue(1);

    await expect(updateActivityBank(teacherUser, "bank-1", { subjectId: "subject-2" })).rejects.toMatchObject({
      status: 409,
      code: "ACTIVITY_BANK_SUBJECT_LOCKED"
    });
    expect(mockPrisma.activityBank.update).not.toHaveBeenCalled();

    mockPrisma.bankActivity.count.mockResolvedValue(0);
    mockPrisma.activityBank.update.mockResolvedValue({ id: "bank-1", subjectId: "subject-2" });
    await updateActivityBank(teacherUser, "bank-1", { subjectId: "subject-2" });
    expect(mockPrisma.activityBank.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ subjectId: "subject-2" })
    }));
  });

  it("creates mutable draft bank activities without a version", async () => {
    mockPrisma.activityBank.findUnique.mockResolvedValue({ id: "bank-1", ownerId: "teacher-1" });
    mockPrisma.activityType.findUnique.mockResolvedValue({ id: "type-1", key: "coding-exercise", isEnabled: true });
    tx.bankActivity.create.mockResolvedValue({ id: "bank-activity-1" });
    tx.bankActivity.update.mockResolvedValue({ id: "bank-activity-1" });

    await createBankActivity(teacherUser, "bank-1", {
      activityTypeKey: "coding-exercise",
      title: "Exercise",
      config: { language: "python" }
    });

    expect(tx.bankActivity.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          config: { difficulty: "easy", language: "python" }
        })
      })
    );
    expect(tx.activityVersion.create).not.toHaveBeenCalled();
    expect(tx.bankActivity.update).toHaveBeenCalledWith(expect.objectContaining({ data: {} }));
  });

  it("creates the next immutable version when changed content is saved as published", async () => {
    mockPrisma.bankActivity.findUnique.mockResolvedValue({
      id: "bank-activity-1",
      bankId: "bank-1",
      title: "Old",
      description: "",
      lifecycle: "draft",
      config: { old: true },
      metadata: { source: "bank" },
      activityType: { id: "type-1", key: "coding-exercise" },
      knowledgeConcepts: [],
      versions: [{ versionNumber: 2 }]
    });
    mockPrisma.activityBank.findUnique.mockResolvedValue({ id: "bank-1", ownerId: "teacher-1" });
    mockPrisma.activityVersion.findFirst.mockResolvedValue({
      id: "version-2", versionNumber: 2, activityTypeId: "type-1", title: "Old", description: "", config: { old: true }, metadata: { source: "bank" }, knowledgeConcepts: []
    });
    tx.activityVersion.create.mockResolvedValue({ id: "version-3" });
    tx.bankActivity.update.mockResolvedValue({ id: "bank-activity-1" });

    await updateBankActivity(teacherUser, "bank-activity-1", {
      title: "New",
      config: { next: true },
      lifecycle: "published"
    });

    expect(tx.activityVersion.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          versionNumber: 3,
          title: "New",
          config: { difficulty: "easy", old: true, next: true }
        })
      })
    );
  });

  it("reuses the latest published version when publishing unchanged authored content", async () => {
    const snapshot = {
      id: "version-2", versionNumber: 2, activityTypeId: "type-1", title: "Same", description: "",
      config: { difficulty: "easy" }, metadata: {}, knowledgeConcepts: []
    };
    mockPrisma.bankActivity.findUnique.mockResolvedValue({
      id: "bank-activity-1", bankId: "bank-1", title: "Same", description: "", lifecycle: "draft",
      config: { difficulty: "easy" }, metadata: {}, activityType: { id: "type-1", key: "coding-exercise" }, knowledgeConcepts: [], versions: [{ versionNumber: 2 }]
    });
    mockPrisma.activityBank.findUnique.mockResolvedValue({ id: "bank-1", ownerId: "teacher-1" });
    mockPrisma.activityVersion.findFirst.mockResolvedValue(snapshot);
    tx.bankActivity.update.mockResolvedValue({ id: "bank-activity-1" });

    await updateBankActivity(teacherUser, "bank-activity-1", { lifecycle: "published" });

    expect(tx.activityVersion.create).not.toHaveBeenCalled();
    expect(tx.bankActivity.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ lifecycle: "published", currentVersionId: "version-2" }) }));
  });

  it("gets activity banks and lists bank activities with versions", async () => {
    mockPrisma.activityBank.findUnique.mockResolvedValue({ id: "bank-1", ownerId: "teacher-1", activities: [] });
    await expect(getActivityBank(teacherUser, "bank-1")).resolves.toMatchObject({ id: "bank-1" });

    mockPrisma.bankActivity.findMany.mockResolvedValue([{ id: "bank-activity-1" }]);
    await expect(listBankActivities(teacherUser, "bank-1")).resolves.toEqual([{ id: "bank-activity-1" }]);
    expect(mockPrisma.bankActivity.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          currentVersion: true,
          versions: { where: { lifecycle: "published" }, orderBy: { versionNumber: "desc" } }
        })
      })
    );
  });

  it("returns per-concept activity counts with an activity bank", async () => {
    mockPrisma.activityBank.findUnique.mockResolvedValueOnce({ id: "bank-1", ownerId: "teacher-1" }).mockResolvedValueOnce({
      id: "bank-1",
      ownerId: "teacher-1",
      subject: { knowledgeConcepts: [{ id: "concept-1" }, { id: "concept-2" }] },
      activities: [
        { id: "activity-1", knowledgeConcepts: [{ conceptId: "concept-1" }] },
        { id: "activity-2", knowledgeConcepts: [{ conceptId: "concept-1" }, { conceptId: "concept-2" }] }
      ]
    });

    await expect(getActivityBank(teacherUser, "bank-1")).resolves.toMatchObject({
      conceptActivityCounts: { "concept-1": 2, "concept-2": 1 }
    });
  });

  it("creates and renames nested activity bank folders", async () => {
    mockPrisma.activityBank.findUnique.mockResolvedValue({ id: "bank-1", ownerId: "teacher-1" });
    mockPrisma.activityBankFolder.findFirst.mockResolvedValue({ id: "folder-1", bankId: "bank-1", title: "Old" });
    mockPrisma.activityBankFolder.create.mockResolvedValue({ id: "folder-2", title: "New" });
    mockPrisma.activityBankFolder.update.mockResolvedValue({ id: "folder-1", title: "Renamed" });

    await createActivityBankFolder(teacherUser, "bank-1", { title: "New", parentId: "folder-1" });
    expect(mockPrisma.activityBankFolder.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ bankId: "bank-1", parentId: "folder-1", title: "New" })
    }));

    await updateActivityBankFolder(teacherUser, "bank-1", "folder-1", { title: "Renamed" });
    expect(mockPrisma.activityBankFolder.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ title: "Renamed" })
    }));
  });

  it("moves folder activities to the bank root when deleting their folder tree", async () => {
    mockPrisma.activityBank.findUnique.mockResolvedValue({ id: "bank-1", ownerId: "teacher-1" });
    mockPrisma.activityBankFolder.findFirst.mockResolvedValue({ id: "folder-1", bankId: "bank-1" });
    mockPrisma.activityBankFolder.findMany
      .mockResolvedValueOnce([{ id: "folder-2" }])
      .mockResolvedValueOnce([]);
    mockPrisma.bankActivity.findMany.mockResolvedValue([
      { id: "activity-1", folderId: "folder-1", position: 0 },
      { id: "activity-2", folderId: "folder-2", position: 0 }
    ]);

    await expect(deleteActivityBankFolder(teacherUser, "bank-1", "folder-1")).resolves.toEqual({ activityCount: 2 });
    expect(tx.bankActivity.update).toHaveBeenNthCalledWith(1, {
      where: { id: "activity-1" },
      data: { folderId: null, position: 0 }
    });
    expect(tx.bankActivity.update).toHaveBeenNthCalledWith(2, {
      where: { id: "activity-2" },
      data: { folderId: null, position: 1 }
    });
    expect(tx.activityBankFolder.delete).toHaveBeenCalledWith({ where: { id: "folder-1" } });
  });

  it("updates activity placement without changing authored content", async () => {
    mockPrisma.activityBank.findUnique.mockResolvedValue({ id: "bank-1", ownerId: "teacher-1" });
    mockPrisma.activityBankFolder.findFirst.mockResolvedValue({ id: "folder-1", bankId: "bank-1" });
    mockPrisma.bankActivity.findFirst.mockResolvedValue({ id: "activity-1", bankId: "bank-1" });
    mockPrisma.bankActivity.update.mockResolvedValue({ id: "activity-1", folderId: "folder-1", position: 2 });

    await updateBankActivityPlacement(teacherUser, "bank-1", "activity-1", { folderId: "folder-1", position: 2 });
    expect(mockPrisma.bankActivity.update).toHaveBeenCalledWith(expect.objectContaining({
      data: { folderId: "folder-1", position: 2 }
    }));
    expect(tx.activityVersion.create).not.toHaveBeenCalled();
  });
});
