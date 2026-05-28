import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CurrentUser } from "@cognelo/contracts";

const fakePlugin = vi.hoisted(() => ({
  key: "placeholder",
  packageName: "@cognelo/plugin-placeholder",
  name: "Placeholder",
  version: "1.2.3",
  activities: [
    {
      key: "placeholder",
      name: "Placeholder activity",
      description: "Temporary activity"
    }
  ],
  db: {
    namespace: "placeholder",
    tables: ["plugin_placeholder_dummy"],
    notes: ["dummy table"],
    migrations: [
      {
        id: "init",
        statements: ['CREATE TABLE "plugin_placeholder_dummy" ("id" TEXT PRIMARY KEY)']
      }
    ]
  }
}));

const fakeContentTypePlugin = vi.hoisted(() => ({
  key: "content-placeholder",
  packageName: "@cognelo/plugin-content-placeholder",
  name: "Content placeholder",
  version: "2.0.0",
  contentTypes: [
    {
      key: "content-document",
      label: { default: "Document" },
      description: { default: "Document content" },
      defaultTitle: { default: "Untitled document" },
      icon: "document",
      createMode: "shell",
      embeddingSource: "text_body"
    }
  ],
  db: {
    namespace: "content_placeholder",
    tables: ["plugin_content_placeholder_dummy"],
    notes: ["dummy content table"],
    migrations: [
      {
        id: "init",
        statements: ['CREATE TABLE "plugin_content_placeholder_dummy" ("id" TEXT PRIMARY KEY)']
      }
    ]
  }
}));

const tx = vi.hoisted(() => ({
  $executeRawUnsafe: vi.fn(),
  $queryRaw: vi.fn(),
  activityPluginInstallation: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    upsert: vi.fn(),
    update: vi.fn()
  },
  activityPluginTableBackup: {
    create: vi.fn(),
    findMany: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn()
  },
  contentTypePluginInstallation: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    upsert: vi.fn(),
    update: vi.fn()
  },
  contentTypePluginTableBackup: {
    create: vi.fn(),
    findMany: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn()
  },
  activityType: {
    upsert: vi.fn(),
    updateMany: vi.fn()
  }
}));

const mockPrisma = vi.hoisted(() => ({
  $transaction: vi.fn(async (handler: (transaction: typeof tx) => unknown) => handler(tx)),
  activityPluginInstallation: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    upsert: vi.fn()
  },
  contentTypePluginInstallation: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    upsert: vi.fn()
  }
}));

vi.mock("@cognelo/db", () => ({
  prisma: mockPrisma,
  Prisma: {}
}));

vi.mock("@cognelo/activity-sdk", () => ({
  getActivityPlugin: vi.fn((key: string) => (key === fakePlugin.key ? fakePlugin : undefined)),
  getActivityPluginForActivityType: vi.fn((key: string) => (key === "placeholder" ? fakePlugin : undefined)),
  listActivityPlugins: vi.fn(() => [fakePlugin])
}));

vi.mock("@cognelo/content-type-sdk", () => ({
  getContentTypePlugin: vi.fn((key: string) => (key === fakeContentTypePlugin.key ? fakeContentTypePlugin : undefined)),
  getContentTypePluginForType: vi.fn((key: string) => (key === "content-document" ? fakeContentTypePlugin : undefined)),
  listContentTypeDefinitions: vi.fn(() => fakeContentTypePlugin.contentTypes),
  listContentTypePlugins: vi.fn(() => [fakeContentTypePlugin])
}));

const {
  assertActivityTypePluginEnabled,
  assertContentResourcePluginActive,
  assertContentTypePluginEnabled,
  ensureActivityPluginInstallations,
  ensureContentTypePluginInstallations,
  getEnabledActivityPluginKeys,
  getEnabledContentTypePluginKeys,
  listActiveContentTypeDefinitions,
  listContentTypePluginInstallations,
  listEnabledContentTypeDefinitions,
  listActivityPluginInstallations,
  updateActivityPluginInstallation,
  updateContentTypePluginInstallation
} = await import("./plugins");

const adminUser: CurrentUser = {
  id: "admin-1",
  email: "admin@example.test",
  name: null,
  firstName: null,
  lastName: null,
  roles: ["admin"]
};

const teacherUser: CurrentUser = {
  ...adminUser,
  id: "teacher-1",
  roles: ["teacher"]
};

describe("plugin lifecycle services", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fakePlugin.db.migrations = [
      {
        id: "init",
        statements: ['CREATE TABLE "plugin_placeholder_dummy" ("id" TEXT PRIMARY KEY)']
      }
    ];
    fakeContentTypePlugin.db.migrations = [
      {
        id: "init",
        statements: ['CREATE TABLE "plugin_content_placeholder_dummy" ("id" TEXT PRIMARY KEY)']
      }
    ];
    mockPrisma.$transaction.mockImplementation(async (handler: (transaction: typeof tx) => unknown) => handler(tx));
  });

  it("syncs newly discovered plugin manifests as inactive and disabled", async () => {
    mockPrisma.activityPluginInstallation.upsert.mockResolvedValue({ key: "placeholder" });

    await ensureActivityPluginInstallations();

    expect(mockPrisma.activityPluginInstallation.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { key: "placeholder" },
        create: expect.objectContaining({
          key: "placeholder",
          isActivated: false,
          isEnabled: false,
          metadata: expect.objectContaining({
            activityTypeKeys: ["placeholder"],
            databaseNamespace: "placeholder",
            databaseTables: ["plugin_placeholder_dummy"]
          })
        }),
        update: expect.objectContaining({
          version: "1.2.3"
        })
      })
    );
  });

  it("requires admin rights to list or update plugin installations", async () => {
    await expect(listActivityPluginInstallations(teacherUser)).rejects.toMatchObject({ status: 403, code: "FORBIDDEN" });
    await expect(updateActivityPluginInstallation(teacherUser, "placeholder", { isEnabled: true })).rejects.toMatchObject({
      status: 403,
      code: "FORBIDDEN"
    });
  });

  it("rejects enabling a plugin before activation", async () => {
    tx.activityPluginInstallation.findUnique.mockResolvedValue({ key: "placeholder", isActivated: false });

    await expect(updateActivityPluginInstallation(adminUser, "placeholder", { isEnabled: true })).rejects.toMatchObject({
      status: 400,
      code: "PLUGIN_NOT_ACTIVATED"
    });
  });

  it("activates a plugin by running its DDL when owned tables are missing", async () => {
    tx.activityPluginInstallation.upsert.mockResolvedValue({ key: "placeholder", isActivated: false });
    tx.$queryRaw.mockResolvedValueOnce([{ exists: false }]).mockResolvedValueOnce([{ exists: true }]);
    tx.activityPluginInstallation.update.mockResolvedValue({ key: "placeholder", isActivated: true, isEnabled: false });

    await expect(updateActivityPluginInstallation(adminUser, "placeholder", { action: "activate" })).resolves.toMatchObject({
      key: "placeholder",
      isActivated: true,
      isEnabled: false
    });

    expect(tx.$executeRawUnsafe).toHaveBeenCalledWith('CREATE TABLE "plugin_placeholder_dummy" ("id" TEXT PRIMARY KEY)');
    expect(tx.activityType.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { key: "placeholder" },
        create: expect.objectContaining({ key: "placeholder", isEnabled: false }),
        update: expect.objectContaining({ isEnabled: false })
      })
    );
  });

  it("requires a disabled plugin before deactivation", async () => {
    tx.activityPluginInstallation.findUnique.mockResolvedValue({ key: "placeholder", isActivated: true, isEnabled: true });

    await expect(updateActivityPluginInstallation(adminUser, "placeholder", { action: "deactivate" })).rejects.toMatchObject({
      status: 400,
      code: "PLUGIN_ENABLED"
    });

    expect(tx.activityType.updateMany).not.toHaveBeenCalled();
  });

  it("reports enabled plugin keys and rejects disabled activity types", async () => {
    mockPrisma.activityPluginInstallation.findMany.mockResolvedValue([{ key: "placeholder" }]);
    mockPrisma.activityPluginInstallation.findUnique.mockResolvedValue({ isActivated: false, isEnabled: true });

    await expect(getEnabledActivityPluginKeys()).resolves.toEqual(new Set(["placeholder"]));
    await expect(assertActivityTypePluginEnabled("placeholder")).rejects.toMatchObject({
      status: 400,
      code: "PLUGIN_DISABLED"
    });
  });

  it("disables an active plugin without touching owned tables", async () => {
    tx.activityPluginInstallation.findUnique.mockResolvedValue({ key: "placeholder", isActivated: true, isEnabled: true });
    tx.activityPluginInstallation.update.mockResolvedValue({ key: "placeholder", isActivated: true, isEnabled: false });

    await expect(updateActivityPluginInstallation(adminUser, "placeholder", { isEnabled: false })).resolves.toMatchObject({
      isEnabled: false
    });

    expect(tx.activityPluginInstallation.update).toHaveBeenCalledWith({
      where: { key: "placeholder" },
      data: { isEnabled: false }
    });
    expect(tx.activityType.updateMany).toHaveBeenCalledWith({
      where: { key: { in: ["placeholder"] } },
      data: { isEnabled: false }
    });
    expect(tx.$executeRawUnsafe).not.toHaveBeenCalled();
  });

  it("deactivates a disabled plugin by renaming owned tables into a backup", async () => {
    tx.activityPluginInstallation.findUnique.mockResolvedValue({ key: "placeholder", isActivated: true, isEnabled: false });
    tx.$queryRaw.mockResolvedValueOnce([{ exists: true }]).mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    tx.activityPluginTableBackup.create.mockResolvedValue({ id: "backup-1" });
    tx.activityPluginInstallation.update.mockResolvedValue({ key: "placeholder", isActivated: false, isEnabled: false });

    await expect(updateActivityPluginInstallation(adminUser, "placeholder", { action: "deactivate" })).resolves.toMatchObject({
      isActivated: false,
      isEnabled: false
    });

    expect(tx.activityPluginTableBackup.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          pluginKey: "placeholder",
          pluginVersion: "1.2.3",
          sourceTables: ["plugin_placeholder_dummy"],
          backupTables: [expect.objectContaining({ sourceTable: "plugin_placeholder_dummy", backupTable: expect.stringMatching(/^bak_/) })]
        })
      })
    );
    expect(tx.$executeRawUnsafe).toHaveBeenCalledWith(expect.stringMatching(/ALTER TABLE "public"\."plugin_placeholder_dummy" RENAME TO "bak_/));
  });

  it("restores a matching backup during activation", async () => {
    const backupId = "clx0000000000000000000000";
    tx.activityPluginInstallation.upsert.mockResolvedValue({ key: "placeholder", isActivated: false });
    tx.activityPluginTableBackup.findFirst.mockResolvedValue({
      id: backupId,
      backupTables: [{ sourceTable: "plugin_placeholder_dummy", backupTable: "bak_placeholder_0" }]
    });
    tx.$queryRaw.mockResolvedValueOnce([{ exists: false }]).mockResolvedValueOnce([{ exists: true }]).mockResolvedValueOnce([{ exists: true }]);
    tx.activityPluginInstallation.update.mockResolvedValue({ key: "placeholder", isActivated: true, isEnabled: false });

    await expect(updateActivityPluginInstallation(adminUser, "placeholder", { action: "activate", restoreBackupId: backupId })).resolves.toMatchObject({
      isActivated: true,
      isEnabled: false
    });

    expect(tx.$executeRawUnsafe).toHaveBeenCalledWith('ALTER TABLE "public"."bak_placeholder_0" RENAME TO "plugin_placeholder_dummy"');
    expect(tx.activityPluginTableBackup.update).toHaveBeenCalledWith({
      where: { id: backupId },
      data: { restoredAt: expect.any(Date) }
    });
  });

  it("fails activation when tables are missing and the plugin has no migrations or restorable backup", async () => {
    fakePlugin.db.migrations = [];
    tx.activityPluginInstallation.upsert.mockResolvedValue({ key: "placeholder", isActivated: false });
    tx.$queryRaw.mockResolvedValueOnce([{ exists: false }]);
    tx.activityPluginTableBackup.findMany.mockResolvedValue([{ id: "backup-1" }]);

    await expect(updateActivityPluginInstallation(adminUser, "placeholder", { action: "activate" })).rejects.toMatchObject({
      status: 409,
      code: "PLUGIN_TABLES_MISSING",
      details: {
        missingTables: ["plugin_placeholder_dummy"],
        backups: [{ id: "backup-1" }]
      }
    });
  });

  it("syncs newly discovered content type plugin manifests as inactive and disabled", async () => {
    mockPrisma.contentTypePluginInstallation.upsert.mockResolvedValue({ key: "content-placeholder" });

    await ensureContentTypePluginInstallations();

    expect(mockPrisma.contentTypePluginInstallation.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { key: "content-placeholder" },
        create: expect.objectContaining({
          key: "content-placeholder",
          isActivated: false,
          isEnabled: false,
          metadata: expect.objectContaining({
            contentTypeKeys: ["content-document"],
            databaseNamespace: "content_placeholder",
            databaseTables: ["plugin_content_placeholder_dummy"]
          })
        }),
        update: expect.objectContaining({
          version: "2.0.0"
        })
      })
    );
  });

  it("requires admin rights to list or update content type plugin installations", async () => {
    await expect(listContentTypePluginInstallations(teacherUser)).rejects.toMatchObject({ status: 403, code: "FORBIDDEN" });
    await expect(updateContentTypePluginInstallation(teacherUser, "content-placeholder", { isEnabled: true })).rejects.toMatchObject({
      status: 403,
      code: "FORBIDDEN"
    });
  });

  it("activates and enables content type plugins independently from activity plugins", async () => {
    tx.contentTypePluginInstallation.upsert.mockResolvedValue({ key: "content-placeholder", isActivated: false });
    tx.$queryRaw.mockResolvedValueOnce([{ exists: false }]).mockResolvedValueOnce([{ exists: true }]);
    tx.contentTypePluginInstallation.update.mockResolvedValueOnce({
      key: "content-placeholder",
      isActivated: true,
      isEnabled: false
    });

    await expect(updateContentTypePluginInstallation(adminUser, "content-placeholder", { action: "activate" })).resolves.toMatchObject({
      key: "content-placeholder",
      isActivated: true,
      isEnabled: false
    });

    expect(tx.$executeRawUnsafe).toHaveBeenCalledWith('CREATE TABLE "plugin_content_placeholder_dummy" ("id" TEXT PRIMARY KEY)');
    expect(tx.activityType.upsert).not.toHaveBeenCalledWith(expect.objectContaining({ where: { key: "content-document" } }));

    tx.contentTypePluginInstallation.findUnique.mockResolvedValue({ key: "content-placeholder", isActivated: true, isEnabled: false });
    tx.contentTypePluginInstallation.update.mockResolvedValueOnce({
      key: "content-placeholder",
      isActivated: true,
      isEnabled: true
    });

    await expect(updateContentTypePluginInstallation(adminUser, "content-placeholder", { isEnabled: true })).resolves.toMatchObject({
      isEnabled: true
    });

    expect(tx.contentTypePluginInstallation.update).toHaveBeenCalledWith({
      where: { key: "content-placeholder" },
      data: { isEnabled: true }
    });
  });

  it("reports enabled content type plugin keys and definitions", async () => {
    mockPrisma.contentTypePluginInstallation.findMany.mockResolvedValue([{ key: "content-placeholder" }]);
    mockPrisma.contentTypePluginInstallation.findUnique.mockResolvedValue({ isActivated: false, isEnabled: true });

    await expect(getEnabledContentTypePluginKeys()).resolves.toEqual(new Set(["content-placeholder"]));
    await expect(listEnabledContentTypeDefinitions()).resolves.toMatchObject([{ key: "content-document" }]);
    await expect(assertContentTypePluginEnabled("content-document")).rejects.toMatchObject({
      status: 400,
      code: "PLUGIN_DISABLED"
    });
  });

  it("allows active disabled content type plugins to serve existing resources", async () => {
    mockPrisma.contentTypePluginInstallation.findUnique.mockResolvedValue({ isActivated: true, isEnabled: false });

    await expect(assertContentResourcePluginActive("content-placeholder")).resolves.toBeUndefined();
  });

  it("lists active content type definitions even when creation is disabled", async () => {
    mockPrisma.contentTypePluginInstallation.findMany.mockResolvedValue([{ key: "content-placeholder" }]);

    await expect(listActiveContentTypeDefinitions()).resolves.toMatchObject([{ key: "content-document" }]);
  });

  it("deactivates disabled content type plugins by backing up owned tables", async () => {
    tx.contentTypePluginInstallation.findUnique.mockResolvedValue({ key: "content-placeholder", isActivated: true, isEnabled: false });
    tx.$queryRaw.mockResolvedValueOnce([{ exists: true }]).mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    tx.contentTypePluginTableBackup.create.mockResolvedValue({ id: "content-backup-1" });
    tx.contentTypePluginInstallation.update.mockResolvedValue({ key: "content-placeholder", isActivated: false, isEnabled: false });

    await expect(updateContentTypePluginInstallation(adminUser, "content-placeholder", { action: "deactivate" })).resolves.toMatchObject({
      isActivated: false,
      isEnabled: false
    });

    expect(tx.contentTypePluginTableBackup.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          pluginKey: "content-placeholder",
          pluginVersion: "2.0.0",
          sourceTables: ["plugin_content_placeholder_dummy"],
          backupTables: [expect.objectContaining({ sourceTable: "plugin_content_placeholder_dummy", backupTable: expect.stringMatching(/^bak_/) })]
        })
      })
    );
  });
});
