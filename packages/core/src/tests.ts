import { getActivityProviderForActivityType } from "@cognelo/activity-sdk";
import { TestCreateSchema, TestDuplicateSchema, TestItemCreateSchema, TestItemUpdateSchema, TestSettingsSchema, TestUpdateSchema } from "@cognelo/contracts";
import type { CurrentUser } from "@cognelo/contracts";
import { Prisma, prisma } from "@cognelo/db";
import { createActivity } from "./activities";
import { assertCanManageCourse, assertCanViewCourse } from "./authorization";
import { AppError, notFound } from "./errors";
import { ensureCoreActivityTypes } from "./plugins";

const testInclude = {
  activity: { include: { activityType: true, bankActivity: true, activityVersion: true } },
  items: {
    include: {
      activity: { include: { activityType: true, bankActivity: true, activityVersion: true } }
    },
    orderBy: [{ position: "asc" as const }, { createdAt: "asc" as const }]
  }
};

export async function createTest(user: CurrentUser, courseId: string, input: unknown) {
  await assertCanManageCourse(user, courseId);
  const data = TestCreateSchema.parse(input);
  await ensureCoreActivityTypes();
  const activityType = await prisma.activityType.findUnique({ where: { key: "test" } });
  if (!activityType || activityType.providerKind !== "core" || !activityType.isEnabled) {
    throw new AppError(409, "TEST_ACTIVITY_TYPE_MISSING", "The core Test activity type is not available.");
  }

  return prisma.$transaction(async (tx) => {
    const activity = await tx.activity.create({
      data: {
        courseId,
        activityTypeId: activityType.id,
        title: data.title,
        description: data.description,
        lifecycle: data.lifecycle,
        config: {},
        metadata: { coreActivity: "test" },
        position: data.position,
        createdById: user.id
      }
    });
    const test = await tx.test.create({
      data: {
        courseId,
        activityId: activity.id,
        settings: data.settings as Prisma.InputJsonValue
      }
    });

    if (data.contentPlacement) {
      await createTestContentItem(tx, {
        courseId,
        activityId: activity.id,
        title: activity.title,
        placement: data.contentPlacement
      });
    }

    return tx.test.findUniqueOrThrow({ where: { id: test.id }, include: testInclude });
  });
}

export async function getTestByActivityId(user: CurrentUser, courseId: string, activityId: string) {
  await assertCanViewCourse(user, courseId);
  const test = await prisma.test.findFirst({ where: { courseId, activityId }, include: testInclude });
  if (!test) {
    throw notFound("Test");
  }
  return test;
}

export async function duplicateTest(user: CurrentUser, courseId: string, activityId: string, input: unknown) {
  await assertCanManageCourse(user, courseId);
  const data = TestDuplicateSchema.parse(input);
  const source = await prisma.test.findFirst({ where: { courseId, activityId }, include: testInclude });
  if (!source) throw notFound("Test");
  return prisma.$transaction(async (tx) => {
    const shell = await tx.activity.create({
      data: {
        courseId,
        activityTypeId: source.activity.activityTypeId,
        title: data.title ?? `${source.activity.title} (copy)`,
        description: source.activity.description,
        lifecycle: "draft",
        config: source.activity.config as Prisma.InputJsonValue,
        metadata: source.activity.metadata as Prisma.InputJsonValue,
        position: source.activity.position + 1,
        createdById: user.id
      }
    });
    const duplicated = await tx.test.create({
      data: { courseId, activityId: shell.id, settings: source.settings as Prisma.InputJsonValue }
    });
    const activityCopies = [];
    for (const sourceItem of source.items) {
      const child = await tx.activity.create({
        data: {
          courseId,
          bankActivityId: sourceItem.activity.bankActivityId,
          activityVersionId: sourceItem.activity.activityVersionId,
          activityTypeId: sourceItem.activity.activityTypeId,
          title: sourceItem.activity.title,
          description: sourceItem.activity.description,
          lifecycle: "draft",
          config: sourceItem.activity.config as Prisma.InputJsonValue,
          metadata: sourceItem.activity.metadata as Prisma.InputJsonValue,
          position: sourceItem.activity.position,
          createdById: user.id
        },
        include: { activityType: true }
      });
      await tx.testItem.create({
        data: {
          testId: duplicated.id,
          activityId: child.id,
          position: sourceItem.position,
          pointsPossible: sourceItem.pointsPossible,
          isRequired: sourceItem.isRequired,
          metadata: sourceItem.metadata as Prisma.InputJsonValue
        }
      });
      activityCopies.push({ sourceActivityId: sourceItem.activityId, activity: child });
    }
    return {
      test: await tx.test.findUniqueOrThrow({ where: { id: duplicated.id }, include: testInclude }),
      activityCopies
    };
  });
}

export async function updateTest(user: CurrentUser, courseId: string, activityId: string, input: unknown) {
  await assertCanManageCourse(user, courseId);
  const data = TestUpdateSchema.parse(input);
  const current = await prisma.test.findFirst({ where: { courseId, activityId } });
  if (!current) {
    throw notFound("Test");
  }
  const settings = data.settings
    ? TestSettingsSchema.parse({ ...asRecord(current.settings), ...data.settings })
    : undefined;
  if (settings) {
    await assertTestStructureMutable(activityId);
  }

  return prisma.$transaction(async (tx) => {
    if (data.title !== undefined || data.description !== undefined || data.lifecycle !== undefined) {
      await tx.activity.update({
        where: { id: activityId },
        data: {
          title: data.title,
          description: data.description,
          lifecycle: data.lifecycle
        }
      });
      if (data.title !== undefined) {
        await tx.courseContentItem.updateMany({ where: { activityId }, data: { titleSnapshot: data.title } });
      }
    }
    if (settings) {
      await tx.test.update({ where: { id: current.id }, data: { settings: settings as Prisma.InputJsonValue } });
    }
    return tx.test.findUniqueOrThrow({ where: { id: current.id }, include: testInclude });
  });
}

export async function createTestItem(user: CurrentUser, courseId: string, testActivityId: string, input: unknown) {
  await assertCanManageCourse(user, courseId);
  const data = TestItemCreateSchema.parse(input);
  const test = await prisma.test.findFirst({ where: { courseId, activityId: testActivityId }, include: { _count: { select: { items: true } } } });
  if (!test) {
    throw notFound("Test");
  }
  await assertTestStructureMutable(testActivityId);
  const position = data.position ?? test._count.items;

  let activity;
  if (data.source === "bank") {
    const bankSource = await resolveBankTestItemSource(data.bankActivityId, data.activityVersionId);
    assertActivityCanBelongToTest(bankSource.activityTypeKey);
    activity = await createActivity(user, courseId, {
          activityTypeKey: bankSource.activityTypeKey,
          bankActivityId: data.bankActivityId,
          activityVersionId: data.activityVersionId,
          title: bankSource.title,
          lifecycle: "draft",
          position
        });
  } else {
    assertActivityCanBelongToTest(data.activityTypeKey);
    activity = await createActivity(user, courseId, {
          activityTypeKey: data.activityTypeKey,
          title: data.title,
          description: data.description,
          lifecycle: data.lifecycle,
          config: data.config,
          metadata: data.activityMetadata,
          position
        });
  }

  try {
    const item = await prisma.testItem.create({
      data: {
        testId: test.id,
        activityId: activity.id,
        position,
        pointsPossible: data.pointsPossible,
        isRequired: data.isRequired,
        metadata: data.metadata as Prisma.InputJsonValue
      },
      include: {
        activity: { include: { activityType: true, bankActivity: true, activityVersion: true } }
      }
    });
    return { item, activity, testId: test.id };
  } catch (error) {
    await prisma.activity.delete({ where: { id: activity.id } }).catch(() => undefined);
    throw error;
  }
}

async function resolveBankTestItemSource(bankActivityId: string, activityVersionId?: string) {
  const version = activityVersionId
    ? await prisma.activityVersion.findFirst({
        where: { id: activityVersionId, bankActivityId },
        include: { activityType: true }
      })
    : (
        await prisma.bankActivity.findUnique({
          where: { id: bankActivityId },
          include: { currentVersion: { include: { activityType: true } } }
        })
      )?.currentVersion;
  if (!version) {
    throw notFound("Activity version");
  }
  return { activityTypeKey: version.activityType.key, title: version.title };
}

export async function updateTestItem(user: CurrentUser, courseId: string, testActivityId: string, testItemId: string, input: unknown) {
  await assertCanManageCourse(user, courseId);
  const data = TestItemUpdateSchema.parse(input);
  await assertTestStructureMutable(testActivityId);
  const item = await findTestItem(courseId, testActivityId, testItemId);
  return prisma.testItem.update({
    where: { id: item.id },
    data: {
      pointsPossible: data.pointsPossible,
      isRequired: data.isRequired,
      position: data.position,
      metadata: data.metadata as Prisma.InputJsonValue | undefined
    },
    include: { activity: { include: { activityType: true, bankActivity: true, activityVersion: true } } }
  });
}

export async function getTestItemForDeletion(user: CurrentUser, courseId: string, testActivityId: string, testItemId: string) {
  await assertCanManageCourse(user, courseId);
  return findTestItem(courseId, testActivityId, testItemId);
}

export async function deleteTestItem(user: CurrentUser, courseId: string, testActivityId: string, testItemId: string) {
  await assertCanManageCourse(user, courseId);
  await assertTestStructureMutable(testActivityId);
  const item = await findTestItem(courseId, testActivityId, testItemId);
  await prisma.activity.delete({ where: { id: item.activityId } });
  return { ok: true } as const;
}

export async function getTestForDeletion(user: CurrentUser, courseId: string, activityId: string) {
  await assertCanManageCourse(user, courseId);
  const test = await prisma.test.findFirst({ where: { courseId, activityId }, include: testInclude });
  if (!test) {
    throw notFound("Test");
  }
  return test;
}

export async function deleteTest(user: CurrentUser, courseId: string, activityId: string) {
  await assertCanManageCourse(user, courseId);
  const test = await prisma.test.findFirst({ where: { courseId, activityId }, include: { items: { select: { activityId: true } } } });
  if (!test) {
    throw notFound("Test");
  }
  await prisma.$transaction(async (tx) => {
    if (test.items.length) {
      await tx.activity.deleteMany({ where: { id: { in: test.items.map((item) => item.activityId) } } });
    }
    await tx.activity.delete({ where: { id: activityId } });
  });
  return { ok: true } as const;
}

async function findTestItem(courseId: string, testActivityId: string, testItemId: string) {
  const item = await prisma.testItem.findFirst({
    where: { id: testItemId, test: { courseId, activityId: testActivityId } },
    include: { activity: { include: { activityType: true, bankActivity: true, activityVersion: true } } }
  });
  if (!item) {
    throw notFound("Test item");
  }
  return item;
}

async function assertTestStructureMutable(testActivityId: string) {
  const attemptCount = await prisma.activityAttempt.count({ where: { activityId: testActivityId } });
  if (attemptCount > 0) {
    throw new AppError(
      409,
      "TEST_STRUCTURE_LOCKED",
      "This Test cannot be reconfigured after a student has started an attempt. Duplicate it to create a changed assessment."
    );
  }
}

function assertActivityCanBelongToTest(activityTypeKey: string) {
  const provider = getActivityProviderForActivityType(activityTypeKey);
  if (provider?.kind !== "plugin") {
    throw new AppError(400, "TEST_ITEM_ACTIVITY_UNSUPPORTED", "Choose a plugin activity for this Test.");
  }
}

async function createTestContentItem(
  tx: Pick<typeof prisma, "courseContentItem">,
  input: {
    courseId: string;
    activityId: string;
    title: string;
    placement: NonNullable<ReturnType<typeof TestCreateSchema.parse>["contentPlacement"]>;
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
    (await tx.courseContentItem.count({ where: { courseId: input.courseId, groupId: null, parentId: input.placement.parentId ?? null } }));
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

function asRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}
