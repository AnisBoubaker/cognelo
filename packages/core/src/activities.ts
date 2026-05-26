import { getActivityDefinition, getActivityPluginForActivityType, listActivityDefinitions } from "@cognelo/activity-sdk";
import { ActivityInputSchema, ActivityUpdateSchema } from "@cognelo/contracts";
import { Prisma, prisma } from "@cognelo/db";
import type { CurrentUser } from "@cognelo/contracts";
import { assertCanManageCourse, assertCanViewCourse } from "./authorization";
import { AppError, notFound } from "./errors";
import { assertActivityTypePluginEnabled, getEnabledActivityPluginKeys } from "./plugins";

export async function listActivityTypes() {
  const enabledPluginKeys = await getEnabledActivityPluginKeys();
  const activityTypes = await prisma.activityType.findMany({ where: { isEnabled: true }, orderBy: { name: "asc" } });
  return activityTypes.filter((activityType) => {
    const plugin = getActivityPluginForActivityType(activityType.key);
    return plugin ? enabledPluginKeys.has(plugin.key) : false;
  });
}

export async function listRegisteredActivityDefinitions() {
  const enabledPluginKeys = await getEnabledActivityPluginKeys();
  return listActivityDefinitions().filter((definition) => {
    const plugin = getActivityPluginForActivityType(definition.key);
    return plugin ? enabledPluginKeys.has(plugin.key) : false;
  });
}

export async function getActivity(user: CurrentUser, courseId: string, activityId: string) {
  await assertCanViewCourse(user, courseId);
  const activity = await prisma.activity.findFirst({
    where: { id: activityId, courseId },
    include: { activityType: true, bankActivity: true, activityVersion: true }
  });
  if (!activity) {
    throw notFound("Activity");
  }
  return activity;
}

export async function listActivities(user: CurrentUser, courseId: string) {
  await assertCanViewCourse(user, courseId);
  return prisma.activity.findMany({
    where: { courseId },
    include: { activityType: true, bankActivity: true, activityVersion: true },
    orderBy: [{ position: "asc" }, { createdAt: "asc" }]
  });
}

export async function createActivity(user: CurrentUser, courseId: string, input: unknown) {
  await assertCanManageCourse(user, courseId);
  const data = ActivityInputSchema.parse(input);
  if (data.bankActivityId || data.activityVersionId) {
    return createCourseActivityFromBankVersion(user, courseId, data);
  }

  const activityType = await prisma.activityType.findUnique({
    where: { key: data.activityTypeKey }
  });
  if (!activityType || !activityType.isEnabled) {
    throw new AppError(400, "UNKNOWN_ACTIVITY_TYPE", "The requested activity type is not available.");
  }
  await assertActivityTypePluginEnabled(data.activityTypeKey);

  const definition = getActivityDefinition(data.activityTypeKey);
  const mergedConfig = { ...(definition?.defaultConfig ?? {}), ...data.config };
  if (definition?.configSchema) {
    definition.configSchema.parse(mergedConfig);
  }
  if (definition?.metadataSchema) {
    definition.metadataSchema.parse(data.metadata);
  }

  return prisma.$transaction(async (tx) => {
    const activity = await tx.activity.create({
      data: {
        courseId,
        activityTypeId: activityType.id,
        title: data.title,
        description: data.description,
        lifecycle: data.lifecycle,
        config: mergedConfig as Prisma.InputJsonValue,
        metadata: data.metadata as Prisma.InputJsonValue,
        position: data.position,
        createdById: user.id
      },
      include: { activityType: true, bankActivity: true, activityVersion: true }
    });

    if (data.contentPlacement) {
      await createCourseActivityContentItem(tx, {
        courseId,
        activityId: activity.id,
        title: activity.title,
        placement: data.contentPlacement
      });
    }

    return activity;
  });
}

async function createCourseActivityFromBankVersion(
  user: CurrentUser,
  courseId: string,
  data: ReturnType<typeof ActivityInputSchema.parse>
) {
  const course = await prisma.course.findUnique({ where: { id: courseId } });
  if (!course) {
    throw notFound("Course");
  }

  const version = data.activityVersionId
    ? await prisma.activityVersion.findUnique({
        where: { id: data.activityVersionId },
        include: { bankActivity: { include: { bank: true } }, activityType: true }
      })
    : data.bankActivityId
      ? (
          await prisma.bankActivity.findUnique({
            where: { id: data.bankActivityId },
            include: {
              bank: true,
              activityType: true,
              currentVersion: { include: { activityType: true, bankActivity: { include: { bank: true } } } }
            }
          })
        )?.currentVersion
      : null;

  if (!version) {
    throw notFound("Activity version");
  }
  await assertActivityTypePluginEnabled(version.activityType.key);
  if (version.lifecycle !== "published") {
    throw new AppError(400, "BANK_ACTIVITY_NOT_PUBLISHED", "Publish this bank activity before adding it to a course.");
  }
  if (version.bankActivity.bank.subjectId !== course.subjectId) {
    throw new AppError(400, "ACTIVITY_BANK_SUBJECT_MISMATCH", "This activity bank does not belong to the course subject.");
  }

  return prisma.$transaction(async (tx) => {
    const activity = await tx.activity.create({
      data: {
        courseId,
        bankActivityId: version.bankActivityId,
        activityVersionId: version.id,
        activityTypeId: version.activityTypeId,
        title: data.title || version.title,
        description: data.description || version.description,
        lifecycle: data.lifecycle,
        config: version.config as Prisma.InputJsonValue,
        metadata: {
          ...((version.metadata as Record<string, unknown> | null) ?? {}),
          ...(data.metadata ?? {}),
          activityVersionNumber: version.versionNumber
        } as Prisma.InputJsonValue,
        position: data.position,
        createdById: user.id
      },
      include: { activityType: true, bankActivity: true, activityVersion: true }
    });

    if (data.contentPlacement) {
      await createCourseActivityContentItem(tx, {
        courseId,
        activityId: activity.id,
        title: activity.title,
        placement: data.contentPlacement
      });
    }

    return activity;
  });
}

export async function updateActivity(user: CurrentUser, courseId: string, activityId: string, input: unknown) {
  await assertCanManageCourse(user, courseId);
  const data = ActivityUpdateSchema.parse(input);
  const activity = await prisma.activity.findFirst({
    where: { id: activityId, courseId },
    include: { activityType: true, bankActivity: true, activityVersion: true }
  });
  if (!activity) {
    throw notFound("Activity");
  }

  const definition = getActivityDefinition(data.activityTypeKey ?? activity.activityType.key);
  const mergedConfig =
    data.config !== undefined
      ? ({
          ...((activity.config as Record<string, unknown> | null) ?? {}),
          ...data.config
        } as Record<string, unknown>)
      : undefined;
  if (definition?.configSchema && mergedConfig) {
    definition.configSchema.parse(mergedConfig);
  }

  const activityTypeId = data.activityTypeKey
    ? (await resolveEnabledActivityTypeId(data.activityTypeKey))
    : undefined;

  return prisma.activity.update({
    where: { id: activityId },
    data: {
      activityTypeId,
      title: data.title,
      description: data.description,
      lifecycle: data.lifecycle,
      config: mergedConfig as Prisma.InputJsonValue | undefined,
      metadata: data.metadata as Prisma.InputJsonValue | undefined,
      position: data.position
    },
    include: { activityType: true, bankActivity: true, activityVersion: true }
  });
}

async function resolveEnabledActivityTypeId(activityTypeKey: string) {
  const activityType = await prisma.activityType.findUnique({ where: { key: activityTypeKey } });
  if (!activityType || !activityType.isEnabled) {
    throw new AppError(400, "UNKNOWN_ACTIVITY_TYPE", "The requested activity type is not available.");
  }
  await assertActivityTypePluginEnabled(activityTypeKey);
  return activityType.id;
}

export async function deleteActivity(user: CurrentUser, courseId: string, activityId: string) {
  await assertCanManageCourse(user, courseId);
  const activity = await prisma.activity.findFirst({ where: { id: activityId, courseId } });
  if (!activity) {
    throw notFound("Activity");
  }
  await prisma.activity.delete({ where: { id: activityId } });
  return { ok: true };
}

async function createCourseActivityContentItem(
  tx: Pick<typeof prisma, "courseContentItem">,
  input: {
    courseId: string;
    activityId: string;
    title: string;
    placement: NonNullable<ReturnType<typeof ActivityInputSchema.parse>["contentPlacement"]>;
  }
) {
  if (input.placement.parentId) {
    const parent = await tx.courseContentItem.findFirst({
      where: { id: input.placement.parentId, courseId: input.courseId, groupId: null, kind: "folder" },
      select: { id: true }
    });
    if (!parent) {
      throw notFound("Parent folder");
    }
  }

  const position =
    input.placement.position ??
    (await tx.courseContentItem.count({
      where: { courseId: input.courseId, groupId: null, parentId: input.placement.parentId ?? null }
    }));

  await tx.courseContentItem.create({
    data: {
      courseId: input.courseId,
      parentId: input.placement.parentId ?? null,
      kind: "activity",
      titleSnapshot: input.placement.titleSnapshot ?? input.title,
      position,
      isVisible: input.placement.isVisible,
      activityId: input.activityId,
      metadata: input.placement.metadata as Prisma.InputJsonValue
    }
  });
}
