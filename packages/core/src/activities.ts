import { getActivityDefinition, listActivityDefinitions } from "@cognara/activity-sdk";
import { ActivityInputSchema, ActivityUpdateSchema } from "@cognara/contracts";
import { Prisma, prisma } from "@cognara/db";
import type { CurrentUser } from "@cognara/contracts";
import { assertCanManageCourse, assertCanViewCourse } from "./authorization";
import { AppError, notFound } from "./errors";

export async function listActivityTypes() {
  return prisma.activityType.findMany({ where: { isEnabled: true }, orderBy: { name: "asc" } });
}

export function listRegisteredActivityDefinitions() {
  return listActivityDefinitions();
}

export async function listActivities(user: CurrentUser, courseId: string) {
  await assertCanViewCourse(user, courseId);
  return prisma.activity.findMany({
    where: { courseId },
    include: { activityType: true },
    orderBy: [{ position: "asc" }, { createdAt: "asc" }]
  });
}

export async function createActivity(user: CurrentUser, courseId: string, input: unknown) {
  await assertCanManageCourse(user, courseId);
  const data = ActivityInputSchema.parse(input);
  const activityType = await prisma.activityType.findUnique({
    where: { key: data.activityTypeKey }
  });
  if (!activityType || !activityType.isEnabled) {
    throw new AppError(400, "UNKNOWN_ACTIVITY_TYPE", "The requested activity type is not available.");
  }

  const definition = getActivityDefinition(data.activityTypeKey);
  if (definition?.configSchema) {
    definition.configSchema.parse(data.config);
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
      config: { ...(definition?.defaultConfig ?? {}), ...data.config } as Prisma.InputJsonValue,
      metadata: data.metadata as Prisma.InputJsonValue,
      position: data.position,
      createdById: user.id
    },
    include: { activityType: true }
  });
}

export async function updateActivity(user: CurrentUser, courseId: string, activityId: string, input: unknown) {
  await assertCanManageCourse(user, courseId);
  const data = ActivityUpdateSchema.parse(input);
  const activity = await prisma.activity.findFirst({
    where: { id: activityId, courseId },
    include: { activityType: true }
  });
  if (!activity) {
    throw notFound("Activity");
  }

  const definition = getActivityDefinition(data.activityTypeKey ?? activity.activityType.key);
  if (definition?.configSchema && data.config) {
    definition.configSchema.parse(data.config);
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
      config: data.config as Prisma.InputJsonValue | undefined,
      metadata: data.metadata as Prisma.InputJsonValue | undefined,
      position: data.position
    },
    include: { activityType: true }
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
