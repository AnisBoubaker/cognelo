import { getActivityDefinition, getActivityPluginForActivityType, isCoreActivityType, listActivityDefinitions } from "@cognelo/activity-sdk";
import { ActivityInputSchema, ActivityUpdateSchema } from "@cognelo/contracts";
import { Prisma, prisma } from "@cognelo/db";
import type { CurrentUser } from "@cognelo/contracts";
import { assertCanManageCourse, assertCanViewCourse } from "./authorization";
import { AppError, notFound } from "./errors";
import { assertActivityTypeAvailable, ensureCoreActivityTypes, getEnabledActivityPluginKeys } from "./plugins";

export async function listActivityTypes() {
  await ensureCoreActivityTypes();
  const enabledPluginKeys = await getEnabledActivityPluginKeys();
  const activityTypes = await prisma.activityType.findMany({ where: { isEnabled: true }, orderBy: { name: "asc" } });
  return activityTypes.filter((activityType) => {
    if (isCoreActivityType(activityType.key)) {
      return true;
    }
    const plugin = getActivityPluginForActivityType(activityType.key);
    return plugin ? enabledPluginKeys.has(plugin.key) : false;
  });
}

export async function listRegisteredActivityDefinitions() {
  const enabledPluginKeys = await getEnabledActivityPluginKeys();
  return listActivityDefinitions().filter((definition) => {
    if (definition.provider.kind === "core") {
      return true;
    }
    const plugin = getActivityPluginForActivityType(definition.key);
    return plugin ? enabledPluginKeys.has(plugin.key) : false;
  });
}

export async function getActivity(user: CurrentUser, courseId: string, activityId: string) {
  await assertCanViewCourse(user, courseId);
  const activity = await prisma.activity.findFirst({
    where: { id: activityId, courseId },
    include: { activityType: true, bankActivity: true, activityVersion: true, knowledgeConcepts: { include: { concept: true } } }
  });
  if (!activity) {
    throw notFound("Activity");
  }
  return activity;
}

export async function listActivities(user: CurrentUser, courseId: string) {
  await assertCanViewCourse(user, courseId);
  return prisma.activity.findMany({
    where: { courseId, testItem: null },
    include: { activityType: true, bankActivity: true, activityVersion: true, knowledgeConcepts: { include: { concept: true } } },
    orderBy: [{ position: "asc" }, { createdAt: "asc" }]
  });
}

export async function createActivity(user: CurrentUser, courseId: string, input: unknown) {
  await assertCanManageCourse(user, courseId);
  const data = ActivityInputSchema.parse(input);
  const knowledgeConceptIds = data.knowledgeConceptIds ?? [];
  if (knowledgeConceptIds.length) {
    const course = await prisma.course.findUnique({ where: { id: courseId }, select: { subjectId: true } });
    if (!course) throw notFound("Course");
    await assertKnowledgeConceptsBelongToSubject(knowledgeConceptIds, course.subjectId);
  }
  if (isCoreActivityType(data.activityTypeKey)) {
    throw new AppError(400, "CORE_ACTIVITY_CREATION_ROUTE_REQUIRED", "Create this core activity through its dedicated authoring flow.");
  }
  if (data.bankActivityId || data.activityVersionId) {
    return createCourseActivityFromBankVersion(user, courseId, data);
  }

  const activityType = await prisma.activityType.findUnique({
    where: { key: data.activityTypeKey }
  });
  if (!activityType || !activityType.isEnabled) {
    throw new AppError(400, "UNKNOWN_ACTIVITY_TYPE", "The requested activity type is not available.");
  }
  await assertActivityTypeAvailable(data.activityTypeKey);

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
        createdById: user.id,
        knowledgeConcepts: { create: knowledgeConceptIds.map((conceptId) => ({ conceptId })) }
      },
      include: { activityType: true, bankActivity: true, activityVersion: true, knowledgeConcepts: { include: { concept: true } } }
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
        include: { bankActivity: { include: { bank: true } }, activityType: true, knowledgeConcepts: true }
      })
    : data.bankActivityId
      ? (
          await prisma.bankActivity.findUnique({
            where: { id: data.bankActivityId },
            include: {
              bank: true,
              activityType: true,
              currentVersion: { include: { activityType: true, bankActivity: { include: { bank: true } }, knowledgeConcepts: true } }
            }
          })
        )?.currentVersion
      : null;

  if (!version) {
    throw notFound("Activity version");
  }
  await assertActivityTypeAvailable(version.activityType.key);
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
        createdById: user.id,
        knowledgeConcepts: { create: (version.knowledgeConcepts ?? []).map(({ conceptId }) => ({ conceptId })) }
      },
      include: { activityType: true, bankActivity: true, activityVersion: true, knowledgeConcepts: { include: { concept: true } } }
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
    include: {
      activityType: true,
      bankActivity: true,
      activityVersion: true,
      knowledgeConcepts: true,
      testItem: { select: { test: { select: { activityId: true } } } }
    }
  });
  if (!activity) {
    throw notFound("Activity");
  }
  if (activity.testItem) {
    const attemptCount = await prisma.activityAttempt.count({
      where: { activityId: activity.testItem.test.activityId }
    });
    if (attemptCount > 0) {
      throw new AppError(
        409,
        "TEST_STRUCTURE_LOCKED",
        "This activity cannot be changed after a student has started its Test. Duplicate the Test to create a changed assessment."
      );
    }
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
  const nextKnowledgeConceptIds = data.knowledgeConceptIds ?? activity.knowledgeConcepts?.map((link) => link.conceptId) ?? [];
  if (data.knowledgeConceptIds?.length) {
    const course = await prisma.course.findUnique({ where: { id: courseId }, select: { subjectId: true } });
    if (!course) throw notFound("Course");
    await assertKnowledgeConceptsBelongToSubject(nextKnowledgeConceptIds, course.subjectId);
  }

  return prisma.$transaction(async (tx) => {
    const updatedActivity = await tx.activity.update({
      where: { id: activityId },
      data: {
        activityTypeId,
        title: data.title,
        description: data.description,
        lifecycle: data.lifecycle,
        config: mergedConfig as Prisma.InputJsonValue | undefined,
        metadata: data.metadata as Prisma.InputJsonValue | undefined,
        position: data.position,
        knowledgeConcepts: data.knowledgeConceptIds === undefined ? undefined : {
          deleteMany: {},
          create: nextKnowledgeConceptIds.map((conceptId) => ({ conceptId }))
        }
      },
      include: { activityType: true, bankActivity: true, activityVersion: true, knowledgeConcepts: { include: { concept: true } } }
    });

    if (data.title !== undefined) {
      await tx.gradebookItem.updateMany({
        where: { courseId, activityId },
        data: { titleSnapshot: data.title }
      });
    }

    return updatedActivity;
  });
}

async function assertKnowledgeConceptsBelongToSubject(conceptIds: string[], subjectId: string) {
  if (conceptIds.length === 0) return;
  const count = await prisma.subjectKnowledgeConcept.count({ where: { id: { in: conceptIds }, subjectId } });
  if (count !== conceptIds.length) {
    throw new AppError(400, "KNOWLEDGE_CONCEPT_SUBJECT_MISMATCH", "Every selected knowledge concept must belong to the activity's subject.");
  }
}

export async function assertActivityAuthoringMutable(courseId: string, activityId: string) {
  const contained = await prisma.activity.findFirst({
    where: { id: activityId, courseId },
    select: { testItem: { select: { test: { select: { activityId: true } } } } }
  });
  if (!contained) throw notFound("Activity");
  if (!contained.testItem) return;
  const attemptCount = await prisma.activityAttempt.count({ where: { activityId: contained.testItem.test.activityId } });
  if (attemptCount > 0) {
    throw new AppError(
      409,
      "TEST_STRUCTURE_LOCKED",
      "This activity cannot be changed after a student has started its Test. Duplicate the Test to create a changed assessment."
    );
  }
}

async function resolveEnabledActivityTypeId(activityTypeKey: string) {
  if (isCoreActivityType(activityTypeKey)) {
    throw new AppError(400, "CORE_ACTIVITY_CREATION_ROUTE_REQUIRED", "Core activity types cannot replace plugin activities.");
  }
  const activityType = await prisma.activityType.findUnique({ where: { key: activityTypeKey } });
  if (!activityType || !activityType.isEnabled) {
    throw new AppError(400, "UNKNOWN_ACTIVITY_TYPE", "The requested activity type is not available.");
  }
  await assertActivityTypeAvailable(activityTypeKey);
  return activityType.id;
}

export async function deleteActivity(user: CurrentUser, courseId: string, activityId: string) {
  await assertCanManageCourse(user, courseId);
  const activity = await prisma.activity.findFirst({ where: { id: activityId, courseId }, include: { testItem: true } });
  if (!activity) {
    throw notFound("Activity");
  }
  if (activity.testItem) {
    throw new AppError(409, "TEST_ITEM_ACTIVITY_OWNED", "Remove this activity from its Test instead.");
  }
  await prisma.activity.delete({ where: { id: activityId } });
  return { ok: true };
}

export async function getActivityForDeletion(user: CurrentUser, courseId: string, activityId: string) {
  await assertCanManageCourse(user, courseId);
  const activity = await prisma.activity.findFirst({
    where: { id: activityId, courseId },
    include: { activityType: true, testItem: true, testDefinition: true }
  });
  if (!activity) {
    throw notFound("Activity");
  }
  return activity;
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
