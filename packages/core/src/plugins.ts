import { getActivityPlugin, getActivityPluginForActivityType, listActivityPlugins } from "@cognelo/activity-sdk";
import { ActivityPluginInstallationUpdateSchema } from "@cognelo/contracts";
import type { CurrentUser } from "@cognelo/contracts";
import { Prisma, prisma } from "@cognelo/db";
import { isAdmin } from "./authorization";
import { AppError, forbidden, notFound } from "./errors";

function pluginMetadata(plugin: ReturnType<typeof listActivityPlugins>[number]) {
  return {
    activityTypeKeys: plugin.activities.map((activity) => activity.key),
    databaseNamespace: plugin.db.namespace,
    databaseTables: plugin.db.tables,
    databaseNotes: plugin.db.notes ?? []
  };
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
          version: plugin.version ?? "0.1.0",
          metadata: pluginMetadata(plugin) as Prisma.InputJsonValue
        },
        create: {
          key: plugin.key,
          packageName: plugin.packageName,
          name: plugin.name,
          version: plugin.version ?? "0.1.0",
          metadata: pluginMetadata(plugin) as Prisma.InputJsonValue,
          isEnabled: true
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
  return prisma.activityPluginInstallation.findMany({ orderBy: { name: "asc" } });
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
  const activityTypeKeys = plugin.activities.map((activity) => activity.key);

  return prisma.$transaction(async (transaction) => {
    const installation = await transaction.activityPluginInstallation.upsert({
      where: { key: plugin.key },
      update: {
        packageName: plugin.packageName,
        name: plugin.name,
        version: plugin.version ?? "0.1.0",
        metadata: pluginMetadata(plugin) as Prisma.InputJsonValue,
        isEnabled: data.isEnabled
      },
      create: {
        key: plugin.key,
        packageName: plugin.packageName,
        name: plugin.name,
        version: plugin.version ?? "0.1.0",
        metadata: pluginMetadata(plugin) as Prisma.InputJsonValue,
        isEnabled: data.isEnabled
      }
    });

    await transaction.activityType.updateMany({
      where: { key: { in: activityTypeKeys } },
      data: { isEnabled: data.isEnabled }
    });

    return installation;
  });
}

export async function getEnabledActivityPluginKeys() {
  await ensureActivityPluginInstallations();
  const installations = await prisma.activityPluginInstallation.findMany({
    where: { isEnabled: true },
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
  return installation?.isEnabled ?? true;
}

export async function assertActivityTypePluginEnabled(activityTypeKey: string) {
  if (await isActivityTypePluginEnabled(activityTypeKey)) {
    return;
  }
  throw new AppError(400, "PLUGIN_DISABLED", "The activity plugin for this activity type is disabled.");
}
