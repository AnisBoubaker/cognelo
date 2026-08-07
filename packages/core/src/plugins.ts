import { createHash } from "node:crypto";
import {
  getActivityPlugin,
  getActivityPluginForActivityType,
  getActivityProviderForActivityType,
  listCoreActivityDefinitions,
  listActivityPlugins
} from "@cognelo/activity-sdk";
import { getContentTypePlugin, getContentTypePluginForType, listContentTypeDefinitions, listContentTypePlugins } from "@cognelo/content-type-sdk";
import { ActivityPluginInstallationUpdateSchema, ContentTypePluginInstallationUpdateSchema } from "@cognelo/contracts";
import type { CurrentUser } from "@cognelo/contracts";
import { Prisma, prisma } from "@cognelo/db";
import { isAdmin } from "./authorization";
import { AppError, forbidden, notFound } from "./errors";

type ActivityPluginManifest = ReturnType<typeof listActivityPlugins>[number];
type ContentTypePluginManifest = ReturnType<typeof listContentTypePlugins>[number];
type PluginTransaction = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

function pluginMetadata(plugin: ActivityPluginManifest) {
  return {
    activityTypeKeys: plugin.activities.map((activity) => activity.key),
    databaseNamespace: plugin.db.namespace,
    databaseTables: plugin.db.tables,
    databaseNotes: plugin.db.notes ?? []
  };
}

function pluginVersion(plugin: ActivityPluginManifest) {
  return plugin.version ?? "0.1.0";
}

export async function ensureCoreActivityTypes() {
  const activityTypes = [];
  for (const definition of listCoreActivityDefinitions()) {
    activityTypes.push(
      await prisma.activityType.upsert({
        where: { key: definition.key },
        update: {
          name: definition.name,
          description: definition.description,
          providerKind: "core",
          providerKey: definition.provider.key,
          metadata: { researchReady: true, core: definition.provider.key },
          isEnabled: definition.isEnabledByDefault ?? true
        },
        create: {
          key: definition.key,
          name: definition.name,
          description: definition.description,
          providerKind: "core",
          providerKey: definition.provider.key,
          metadata: { researchReady: true, core: definition.provider.key },
          isEnabled: definition.isEnabledByDefault ?? true
        }
      })
    );
  }
  return activityTypes;
}

function contentTypePluginMetadata(plugin: ContentTypePluginManifest) {
  return {
    contentTypeKeys: plugin.contentTypes.map((contentType) => contentType.key),
    databaseNamespace: plugin.db.namespace,
    databaseTables: plugin.db.tables,
    databaseNotes: plugin.db.notes ?? []
  };
}

function contentTypePluginVersion(plugin: ContentTypePluginManifest) {
  return plugin.version ?? "0.1.0";
}

export async function ensureActivityPluginInstallations() {
  const installed = [];
  for (const plugin of listActivityPlugins()) {
    installed.push(
      await prisma.activityPluginInstallation.upsert({
        where: { key: plugin.key },
        update: {
          packageName: plugin.packageName,
          name: plugin.name,
          version: pluginVersion(plugin),
          metadata: pluginMetadata(plugin) as Prisma.InputJsonValue
        },
        create: {
          key: plugin.key,
          packageName: plugin.packageName,
          name: plugin.name,
          version: pluginVersion(plugin),
          metadata: pluginMetadata(plugin) as Prisma.InputJsonValue,
          isActivated: false,
          isEnabled: false
        }
      })
    );
  }
  return installed;
}

export async function listActivityPluginInstallations(user: CurrentUser) {
  if (!isAdmin(user)) {
    throw forbidden();
  }
  await ensureActivityPluginInstallations();
  return prisma.activityPluginInstallation.findMany({
    include: { tableBackups: { where: { restoredAt: null }, orderBy: { createdAt: "desc" } } },
    orderBy: { name: "asc" }
  });
}

export async function updateActivityPluginInstallation(user: CurrentUser, pluginKey: string, input: unknown) {
  if (!isAdmin(user)) {
    throw forbidden();
  }

  const plugin = getActivityPlugin(pluginKey);
  if (!plugin) {
    throw notFound("Activity plugin");
  }

  const data = ActivityPluginInstallationUpdateSchema.parse(input);
  if ("action" in data) {
    if (data.action === "activate") {
      return activateActivityPlugin(plugin, data.restoreBackupId ?? null);
    }
    return deactivateActivityPlugin(plugin);
  }
  return setActivityPluginEnabled(plugin, data.isEnabled);
}

export async function getEnabledActivityPluginKeys() {
  await ensureActivityPluginInstallations();
  const installations = await prisma.activityPluginInstallation.findMany({
    where: { isActivated: true, isEnabled: true },
    select: { key: true }
  });
  return new Set(installations.map((installation) => installation.key));
}

export async function isActivityTypePluginEnabled(activityTypeKey: string) {
  const plugin = getActivityPluginForActivityType(activityTypeKey);
  if (!plugin) {
    return false;
  }
  const installation = await prisma.activityPluginInstallation.findUnique({ where: { key: plugin.key } });
  return Boolean(installation?.isActivated && installation.isEnabled);
}

export async function assertActivityTypePluginEnabled(activityTypeKey: string) {
  if (await isActivityTypePluginEnabled(activityTypeKey)) {
    return;
  }
  throw new AppError(400, "PLUGIN_DISABLED", "The activity plugin for this activity type is disabled.");
}

export async function isActivityTypeAvailable(activityTypeKey: string) {
  const provider = getActivityProviderForActivityType(activityTypeKey);
  if (provider?.kind === "core") {
    return true;
  }
  return isActivityTypePluginEnabled(activityTypeKey);
}

export async function assertActivityTypeAvailable(activityTypeKey: string) {
  if (await isActivityTypeAvailable(activityTypeKey)) {
    return;
  }
  throw new AppError(400, "ACTIVITY_TYPE_UNAVAILABLE", "This activity type is not available.");
}

export async function ensureContentTypePluginInstallations() {
  const installed = [];
  for (const plugin of listContentTypePlugins()) {
    installed.push(await upsertContentTypePluginManifest(prisma, plugin));
  }
  return installed;
}

export async function listContentTypePluginInstallations(user: CurrentUser) {
  if (!isAdmin(user)) {
    throw forbidden();
  }
  await ensureContentTypePluginInstallations();
  return prisma.contentTypePluginInstallation.findMany({
    include: { tableBackups: { where: { restoredAt: null }, orderBy: { createdAt: "desc" } } },
    orderBy: { name: "asc" }
  });
}

export async function updateContentTypePluginInstallation(user: CurrentUser, pluginKey: string, input: unknown) {
  if (!isAdmin(user)) {
    throw forbidden();
  }

  const plugin = getContentTypePlugin(pluginKey);
  if (!plugin) {
    throw notFound("Content type plugin");
  }

  const data = ContentTypePluginInstallationUpdateSchema.parse(input);
  if ("action" in data) {
    if (data.action === "activate") {
      return activateContentTypePlugin(plugin, data.restoreBackupId ?? null);
    }
    return deactivateContentTypePlugin(plugin);
  }
  return setContentTypePluginEnabled(plugin, data.isEnabled);
}

export async function getEnabledContentTypePluginKeys() {
  await ensureContentTypePluginInstallations();
  const installations = await prisma.contentTypePluginInstallation.findMany({
    where: { isActivated: true, isEnabled: true },
    select: { key: true }
  });
  return new Set(installations.map((installation) => installation.key));
}

export async function listEnabledContentTypeDefinitions() {
  const enabledPluginKeys = await getEnabledContentTypePluginKeys();
  return listContentTypeDefinitions().filter((definition) => {
    const plugin = getContentTypePluginForType(definition.key);
    return plugin ? enabledPluginKeys.has(plugin.key) : false;
  });
}

export async function listActiveContentTypeDefinitions() {
  await ensureContentTypePluginInstallations();
  const installations = await prisma.contentTypePluginInstallation.findMany({
    where: { isActivated: true },
    select: { key: true }
  });
  const activePluginKeys = new Set(installations.map((installation) => installation.key));
  return listContentTypeDefinitions().filter((definition) => {
    const plugin = getContentTypePluginForType(definition.key);
    return plugin ? activePluginKeys.has(plugin.key) : false;
  });
}

export async function isContentTypePluginEnabled(contentTypeKey: string) {
  const plugin = getContentTypePluginForType(contentTypeKey);
  if (!plugin) {
    return false;
  }
  const installation = await prisma.contentTypePluginInstallation.findUnique({ where: { key: plugin.key } });
  return Boolean(installation?.isActivated && installation.isEnabled);
}

export async function isContentTypePluginActive(pluginKey: string) {
  const installation = await prisma.contentTypePluginInstallation.findUnique({ where: { key: pluginKey } });
  return Boolean(installation?.isActivated);
}

export async function assertContentTypePluginEnabled(contentTypeKey: string) {
  if (await isContentTypePluginEnabled(contentTypeKey)) {
    return;
  }
  throw new AppError(400, "PLUGIN_DISABLED", "The content type plugin for this content type is disabled.");
}

export async function assertContentResourcePluginActive(pluginKey: string) {
  if (await isContentTypePluginActive(pluginKey)) {
    return;
  }
  throw new AppError(400, "PLUGIN_INACTIVE", "The content type plugin for this content resource is inactive.");
}

async function setActivityPluginEnabled(plugin: ActivityPluginManifest, isEnabled: boolean) {
  return prisma.$transaction(async (transaction) => {
    const installation = await transaction.activityPluginInstallation.findUnique({ where: { key: plugin.key } });
    if (!installation?.isActivated) {
      throw new AppError(400, "PLUGIN_NOT_ACTIVATED", "Activate this plugin before changing whether it is enabled.");
    }
    const updated = await transaction.activityPluginInstallation.update({
      where: { key: plugin.key },
      data: { isEnabled }
    });
    await transaction.activityType.updateMany({
      where: { key: { in: plugin.activities.map((activity) => activity.key) } },
      data: { isEnabled }
    });
    return updated;
  });
}

async function setContentTypePluginEnabled(plugin: ContentTypePluginManifest, isEnabled: boolean) {
  return prisma.$transaction(async (transaction) => {
    const installation = await transaction.contentTypePluginInstallation.findUnique({ where: { key: plugin.key } });
    if (!installation?.isActivated) {
      throw new AppError(400, "PLUGIN_NOT_ACTIVATED", "Activate this plugin before changing whether it is enabled.");
    }
    return transaction.contentTypePluginInstallation.update({
      where: { key: plugin.key },
      data: { isEnabled }
    });
  });
}

async function activateActivityPlugin(plugin: ActivityPluginManifest, restoreBackupId: string | null) {
  return prisma.$transaction(async (transaction) => {
    const installation = await upsertPluginManifest(transaction, plugin);
    if (installation.isActivated) {
      return installation;
    }

    if (restoreBackupId) {
      await restorePluginTableBackup(transaction, plugin, restoreBackupId);
    }

    let missingTables = await missingPluginTables(transaction, plugin.db.tables);
    if (missingTables.length && !restoreBackupId && plugin.db.migrations?.length) {
      await createPluginTables(transaction, plugin);
      missingTables = await missingPluginTables(transaction, plugin.db.tables);
    }

    if (missingTables.length) {
      const backups = await transaction.activityPluginTableBackup.findMany({
        where: { pluginKey: plugin.key, pluginVersion: pluginVersion(plugin), restoredAt: null },
        orderBy: { createdAt: "desc" }
      });
      throw new AppError(
        409,
        "PLUGIN_TABLES_MISSING",
        "Plugin tables are missing. Apply the plugin migration or restore a matching backup before activation.",
        { missingTables, backups }
      );
    }

    for (const definition of plugin.activities) {
      await transaction.activityType.upsert({
        where: { key: definition.key },
        update: {
          name: definition.name,
          description: definition.description,
          providerKind: "plugin",
          providerKey: plugin.key,
          metadata: { researchReady: true, plugin: plugin.key },
          isEnabled: false
        },
        create: {
          key: definition.key,
          name: definition.name,
          description: definition.description,
          providerKind: "plugin",
          providerKey: plugin.key,
          metadata: { researchReady: true, plugin: plugin.key },
          isEnabled: false
        }
      });
    }

    return transaction.activityPluginInstallation.update({
      where: { key: plugin.key },
      data: {
        isActivated: true,
        isEnabled: false,
        activatedAt: new Date(),
        deactivatedAt: null
      }
    });
  });
}

async function createPluginTables(transaction: PluginTransaction, plugin: ActivityPluginManifest) {
  for (const migration of plugin.db.migrations ?? []) {
    for (const statement of migration.statements) {
      await transaction.$executeRawUnsafe(statement);
    }
  }
}

async function createContentTypePluginTables(transaction: PluginTransaction, plugin: ContentTypePluginManifest) {
  for (const migration of plugin.db.migrations ?? []) {
    for (const statement of migration.statements) {
      await transaction.$executeRawUnsafe(statement);
    }
  }
}

async function activateContentTypePlugin(plugin: ContentTypePluginManifest, restoreBackupId: string | null) {
  return prisma.$transaction(async (transaction) => {
    const installation = await upsertContentTypePluginManifest(transaction, plugin);
    if (installation.isActivated) {
      return installation;
    }

    if (restoreBackupId) {
      await restoreContentTypePluginTableBackup(transaction, plugin, restoreBackupId);
    }

    let missingTables = await missingPluginTables(transaction, plugin.db.tables);
    if (missingTables.length && !restoreBackupId && plugin.db.migrations?.length) {
      await createContentTypePluginTables(transaction, plugin);
      missingTables = await missingPluginTables(transaction, plugin.db.tables);
    }

    if (missingTables.length) {
      const backups = await transaction.contentTypePluginTableBackup.findMany({
        where: { pluginKey: plugin.key, pluginVersion: contentTypePluginVersion(plugin), restoredAt: null },
        orderBy: { createdAt: "desc" }
      });
      throw new AppError(
        409,
        "PLUGIN_TABLES_MISSING",
        "Plugin tables are missing. Apply the plugin migration or restore a matching backup before activation.",
        { missingTables, backups }
      );
    }

    return transaction.contentTypePluginInstallation.update({
      where: { key: plugin.key },
      data: {
        isActivated: true,
        isEnabled: false,
        activatedAt: new Date(),
        deactivatedAt: null
      }
    });
  });
}

async function deactivateContentTypePlugin(plugin: ContentTypePluginManifest) {
  return prisma.$transaction(async (transaction) => {
    const installation = await transaction.contentTypePluginInstallation.findUnique({ where: { key: plugin.key } });
    if (!installation?.isActivated) {
      throw new AppError(400, "PLUGIN_NOT_ACTIVATED", "This plugin is not activated.");
    }
    if (installation.isEnabled) {
      throw new AppError(400, "PLUGIN_ENABLED", "Disable this plugin before deactivating it.");
    }

    const existingTables = [];
    for (const tableName of plugin.db.tables) {
      if (await tableExists(transaction, tableName)) {
        existingTables.push(tableName);
      }
    }

    const backupTables = existingTables.map((tableName, index) => ({
      sourceTable: tableName,
      backupTable: backupTableName(plugin, tableName, index)
    }));

    for (const table of backupTables) {
      await renameTableOwnedObjects(transaction, table.sourceTable, table.backupTable);
      await renameTable(transaction, table.sourceTable, table.backupTable);
    }

    const backup =
      backupTables.length > 0
        ? await transaction.contentTypePluginTableBackup.create({
            data: {
              pluginKey: plugin.key,
              pluginVersion: contentTypePluginVersion(plugin),
              sourceTables: backupTables.map((table) => table.sourceTable) as Prisma.InputJsonValue,
              backupTables: backupTables as Prisma.InputJsonValue
            }
          })
        : null;

    return transaction.contentTypePluginInstallation.update({
      where: { key: plugin.key },
      data: {
        isActivated: false,
        isEnabled: false,
        deactivatedAt: new Date(),
        metadata: {
          ...contentTypePluginMetadata(plugin),
          lastBackupId: backup?.id ?? null
        } as Prisma.InputJsonValue
      }
    });
  });
}

async function deactivateActivityPlugin(plugin: ActivityPluginManifest) {
  return prisma.$transaction(async (transaction) => {
    const installation = await transaction.activityPluginInstallation.findUnique({ where: { key: plugin.key } });
    if (!installation?.isActivated) {
      throw new AppError(400, "PLUGIN_NOT_ACTIVATED", "This plugin is not activated.");
    }
    if (installation.isEnabled) {
      throw new AppError(400, "PLUGIN_ENABLED", "Disable this plugin before deactivating it.");
    }

    const existingTables = [];
    for (const tableName of plugin.db.tables) {
      if (await tableExists(transaction, tableName)) {
        existingTables.push(tableName);
      }
    }

    const backupTables = existingTables.map((tableName, index) => ({
      sourceTable: tableName,
      backupTable: backupTableName(plugin, tableName, index)
    }));

    for (const table of backupTables) {
      await renameTableOwnedObjects(transaction, table.sourceTable, table.backupTable);
      await renameTable(transaction, table.sourceTable, table.backupTable);
    }

    const backup =
      backupTables.length > 0
        ? await transaction.activityPluginTableBackup.create({
            data: {
              pluginKey: plugin.key,
              pluginVersion: pluginVersion(plugin),
              sourceTables: backupTables.map((table) => table.sourceTable) as Prisma.InputJsonValue,
              backupTables: backupTables as Prisma.InputJsonValue
            }
          })
        : null;

    await transaction.activityType.updateMany({
      where: { key: { in: plugin.activities.map((activity) => activity.key) } },
      data: { isEnabled: false }
    });

    return transaction.activityPluginInstallation.update({
      where: { key: plugin.key },
      data: {
        isActivated: false,
        isEnabled: false,
        deactivatedAt: new Date(),
        metadata: {
          ...pluginMetadata(plugin),
          lastBackupId: backup?.id ?? null
        } as Prisma.InputJsonValue
      }
    });
  });
}

async function upsertPluginManifest(transaction: PluginTransaction, plugin: ActivityPluginManifest) {
  return transaction.activityPluginInstallation.upsert({
    where: { key: plugin.key },
    update: {
      packageName: plugin.packageName,
      name: plugin.name,
      version: pluginVersion(plugin),
      metadata: pluginMetadata(plugin) as Prisma.InputJsonValue
    },
    create: {
      key: plugin.key,
      packageName: plugin.packageName,
      name: plugin.name,
      version: pluginVersion(plugin),
      metadata: pluginMetadata(plugin) as Prisma.InputJsonValue,
      isActivated: false,
      isEnabled: false
    }
  });
}

async function upsertContentTypePluginManifest(
  transaction: Pick<typeof prisma, "contentTypePluginInstallation">,
  plugin: ContentTypePluginManifest
) {
  return transaction.contentTypePluginInstallation.upsert({
    where: { key: plugin.key },
    update: {
      packageName: plugin.packageName,
      name: plugin.name,
      version: contentTypePluginVersion(plugin),
      metadata: contentTypePluginMetadata(plugin) as Prisma.InputJsonValue
    },
    create: {
      key: plugin.key,
      packageName: plugin.packageName,
      name: plugin.name,
      version: contentTypePluginVersion(plugin),
      metadata: contentTypePluginMetadata(plugin) as Prisma.InputJsonValue,
      isActivated: false,
      isEnabled: false
    }
  });
}

async function restorePluginTableBackup(transaction: PluginTransaction, plugin: ActivityPluginManifest, restoreBackupId: string) {
  const backup = await transaction.activityPluginTableBackup.findFirst({
    where: {
      id: restoreBackupId,
      pluginKey: plugin.key,
      pluginVersion: pluginVersion(plugin),
      restoredAt: null
    }
  });
  if (!backup) {
    throw notFound("Plugin table backup");
  }

  const backupTables = backup.backupTables as Array<{ sourceTable: string; backupTable: string }>;
  for (const table of backupTables) {
    assertKnownPluginTable(plugin, table.sourceTable);
    assertSafeIdentifier(table.backupTable);
    if (await tableExists(transaction, table.sourceTable)) {
      throw new AppError(409, "PLUGIN_TABLE_ALREADY_EXISTS", "A plugin table already exists and cannot be restored over.", {
        table: table.sourceTable
      });
    }
    if (!(await tableExists(transaction, table.backupTable))) {
      throw new AppError(409, "PLUGIN_BACKUP_TABLE_MISSING", "A plugin backup table is missing.", { table: table.backupTable });
    }
  }

  for (const table of backupTables) {
    await renameTable(transaction, table.backupTable, table.sourceTable);
  }
  await transaction.activityPluginTableBackup.update({
    where: { id: backup.id },
    data: { restoredAt: new Date() }
  });
}

async function restoreContentTypePluginTableBackup(transaction: PluginTransaction, plugin: ContentTypePluginManifest, restoreBackupId: string) {
  const backup = await transaction.contentTypePluginTableBackup.findFirst({
    where: {
      id: restoreBackupId,
      pluginKey: plugin.key,
      pluginVersion: contentTypePluginVersion(plugin),
      restoredAt: null
    }
  });
  if (!backup) {
    throw notFound("Plugin table backup");
  }

  const backupTables = backup.backupTables as Array<{ sourceTable: string; backupTable: string }>;
  for (const table of backupTables) {
    assertKnownPluginTable(plugin, table.sourceTable);
    assertSafeIdentifier(table.backupTable);
    if (await tableExists(transaction, table.sourceTable)) {
      throw new AppError(409, "PLUGIN_TABLE_ALREADY_EXISTS", "A plugin table already exists and cannot be restored over.", {
        table: table.sourceTable
      });
    }
    if (!(await tableExists(transaction, table.backupTable))) {
      throw new AppError(409, "PLUGIN_BACKUP_TABLE_MISSING", "A plugin backup table is missing.", { table: table.backupTable });
    }
  }

  for (const table of backupTables) {
    await renameTable(transaction, table.backupTable, table.sourceTable);
  }
  await transaction.contentTypePluginTableBackup.update({
    where: { id: backup.id },
    data: { restoredAt: new Date() }
  });
}

async function missingPluginTables(transaction: PluginTransaction, tableNames: readonly string[]) {
  const missing = [];
  for (const tableName of tableNames) {
    if (!(await tableExists(transaction, tableName))) {
      missing.push(tableName);
    }
  }
  return missing;
}

async function tableExists(transaction: PluginTransaction, tableName: string) {
  assertSafeIdentifier(tableName);
  const rows = await transaction.$queryRaw<Array<{ exists: boolean }>>`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = ${tableName}
    ) AS "exists"
  `;
  return rows[0]?.exists ?? false;
}

async function renameTable(transaction: PluginTransaction, from: string, to: string) {
  assertSafeIdentifier(from);
  assertSafeIdentifier(to);
  await transaction.$executeRawUnsafe(`ALTER TABLE "public"."${from}" RENAME TO "${to}"`);
}

async function renameTableOwnedObjects(transaction: PluginTransaction, tableName: string, backupName: string) {
  assertSafeIdentifier(tableName);
  assertSafeIdentifier(backupName);

  const constraints = await transaction.$queryRaw<Array<{ name: string }>>`
    SELECT conname AS name
    FROM pg_constraint
    WHERE conrelid = to_regclass(${`public."${tableName}"`})
    ORDER BY conname
  `;
  for (const [index, constraint] of constraints.entries()) {
    assertSafeIdentifier(constraint.name);
    await transaction.$executeRawUnsafe(`ALTER TABLE "public"."${tableName}" RENAME CONSTRAINT "${constraint.name}" TO "${backupName}_c${index}"`);
  }

  const indexes = await transaction.$queryRaw<Array<{ name: string }>>`
    SELECT indexname AS name
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = ${tableName}
    ORDER BY indexname
  `;
  for (const [index, tableIndex] of indexes.entries()) {
    assertSafeIdentifier(tableIndex.name);
    await transaction.$executeRawUnsafe(`ALTER INDEX "public"."${tableIndex.name}" RENAME TO "${backupName}_i${index}"`);
  }
}

function backupTableName(plugin: ActivityPluginManifest | ContentTypePluginManifest, tableName: string, index: number) {
  const version = "activities" in plugin ? pluginVersion(plugin) : contentTypePluginVersion(plugin);
  const hash = createHash("sha1").update(`${plugin.key}:${version}:${tableName}:${Date.now()}:${index}`).digest("hex").slice(0, 10);
  return `bak_${hash}_${index}`;
}

function assertKnownPluginTable(plugin: ActivityPluginManifest | ContentTypePluginManifest, tableName: string) {
  if (!plugin.db.tables.includes(tableName)) {
    throw new AppError(400, "UNKNOWN_PLUGIN_TABLE", "The requested table is not owned by this plugin.");
  }
}

function assertSafeIdentifier(identifier: string) {
  if (!/^[A-Za-z_][A-Za-z0-9_]{0,62}$/.test(identifier)) {
    throw new AppError(400, "UNSAFE_IDENTIFIER", "A plugin table identifier is invalid.");
  }
}
