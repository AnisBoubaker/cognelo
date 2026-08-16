import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CurrentUser } from "@cognelo/contracts";

const tx = vi.hoisted(() => ({
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
  activityType: {
    findUnique: vi.fn()
  },
  bankActivity: {
    count: vi.fn(),
    findMany: vi.fn(),
    findUnique: vi.fn()
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
  createBankActivity,
  createSubject,
  getActivityBank,
  getSubject,
  listActivityBanks,
  listBankActivities,
  listSubjects,
  updateActivityBank,
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

  it("creates bank activities with a first version and merged default config", async () => {
    mockPrisma.activityBank.findUnique.mockResolvedValue({ id: "bank-1", ownerId: "teacher-1" });
    mockPrisma.activityType.findUnique.mockResolvedValue({ id: "type-1", key: "coding-exercise", isEnabled: true });
    tx.bankActivity.create.mockResolvedValue({ id: "bank-activity-1" });
    tx.activityVersion.create.mockResolvedValue({ id: "version-1" });
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
    expect(tx.activityVersion.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ versionNumber: 1 })
      })
    );
  });

  it("updates bank activities by creating a next version", async () => {
    mockPrisma.bankActivity.findUnique.mockResolvedValue({
      id: "bank-activity-1",
      bankId: "bank-1",
      title: "Old",
      description: "",
      lifecycle: "draft",
      config: { old: true },
      metadata: { source: "bank" },
      activityType: { id: "type-1", key: "coding-exercise" },
      versions: [{ versionNumber: 2 }]
    });
    mockPrisma.activityBank.findUnique.mockResolvedValue({ id: "bank-1", ownerId: "teacher-1" });
    tx.activityVersion.create.mockResolvedValue({ id: "version-3" });
    tx.bankActivity.update.mockResolvedValue({ id: "bank-activity-1" });

    await updateBankActivity(teacherUser, "bank-activity-1", {
      title: "New",
      config: { next: true }
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

  it("gets activity banks and lists bank activities with versions", async () => {
    mockPrisma.activityBank.findUnique.mockResolvedValue({ id: "bank-1", ownerId: "teacher-1", activities: [] });
    await expect(getActivityBank(teacherUser, "bank-1")).resolves.toMatchObject({ id: "bank-1" });

    mockPrisma.bankActivity.findMany.mockResolvedValue([{ id: "bank-activity-1" }]);
    await expect(listBankActivities(teacherUser, "bank-1")).resolves.toEqual([{ id: "bank-activity-1" }]);
    expect(mockPrisma.bankActivity.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          currentVersion: true,
          versions: { orderBy: { versionNumber: "desc" } }
        })
      })
    );
  });
});
