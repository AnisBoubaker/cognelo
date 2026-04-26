import { getActivityDefinition, listActivityDefinitions } from "@cognelo/activity-sdk";
import { ActivityInputSchema, ActivityUpdateSchema } from "@cognelo/contracts";
import { Prisma, prisma } from "@cognelo/db";
import type { CurrentUser } from "@cognelo/contracts";
import { assertCanManageCourse, assertCanViewCourse } from "./authorization";
import { AppError, notFound } from "./errors";

export async function listActivityTypes() {
  return prisma.activityType.findMany({ where: { isEnabled: true }, orderBy: { name: "asc" } });
}

export function listRegisteredActivityDefinitions() {
  return listActivityDefinitions();
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

  const definition = getActivityDefinition(data.activityTypeKey);
  const mergedConfig = { ...(definition?.defaultConfig ?? {}), ...data.config };
  if (definition?.configSchema) {
    definition.configSchema.parse(mergedConfig);
  }
  if (definition?.metadataSchema) {
    definition.metadataSchema.parse(data.metadata);
  }

  return prisma.activity.create({
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
  if (version.bankActivity.bank.subjectId !== course.subjectId) {
    throw new AppError(400, "ACTIVITY_BANK_SUBJECT_MISMATCH", "This activity bank does not belong to the course subject.");
  }

  return prisma.activity.create({
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
    ? (await prisma.activityType.findUniqueOrThrow({ where: { key: data.activityTypeKey } })).id
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

export async function deleteActivity(user: CurrentUser, courseId: string, activityId: string) {
  await assertCanManageCourse(user, courseId);
  const activity = await prisma.activity.findFirst({ where: { id: activityId, courseId } });
  if (!activity) {
    throw notFound("Activity");
  }
  await prisma.activity.delete({ where: { id: activityId } });
  return { ok: true };
}
