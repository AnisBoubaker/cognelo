import { createHash } from "node:crypto";
import { getActivityDefinition, getActivityProviderForActivityType } from "@cognelo/activity-sdk";
import {
  BankTestCreateSchema,
  BankTestUpdateSchema,
  BankActivityDuplicateSchema,
  CourseTestPublishToBankSchema,
  TestFromBankCreateSchema,
  TestItemCreateSchema,
  TestItemUpdateSchema,
  TestSettingsSchema,
  type CurrentUser
} from "@cognelo/contracts";
import { Prisma, prisma } from "@cognelo/db";
import { conceptSelectionCreates, selectionsFromStoredLinks } from "./activity-knowledge-concepts";
import { AppError, notFound } from "./errors";
import { reconcileMediaAssetReferences } from "./media-assets";
import { assertActivityTypeAvailable, ensureCoreActivityTypes } from "./plugins";
import { assertCanManageActivityBank, assertCanViewActivityBank } from "./subjects";

const bankActivityInclude = {
  activityType: true,
  currentVersion: true,
  knowledgeConcepts: { include: { concept: true } },
  versions: { where: { lifecycle: "published" as const }, orderBy: { versionNumber: "desc" as const } }
};

const bankTestInclude = {
  activity: { include: bankActivityInclude },
  items: {
    where: { removedAt: null },
    include: { activity: { include: bankActivityInclude } },
    orderBy: [{ position: "asc" as const }, { createdAt: "asc" as const }]
  }
};

export async function createBankTest(user: CurrentUser, activityBankId: string, input: unknown) {
  await assertCanManageActivityBank(user, activityBankId);
  const data = BankTestCreateSchema.parse(input);
  await ensureCoreActivityTypes();
  const [bank, activityType] = await Promise.all([
    prisma.activityBank.findUnique({ where: { id: activityBankId }, select: { id: true } }),
    prisma.activityType.findUnique({ where: { key: "test" } })
  ]);
  if (!bank) throw notFound("Activity bank");
  if (!activityType || activityType.providerKind !== "core" || !activityType.isEnabled) {
    throw new AppError(409, "TEST_ACTIVITY_TYPE_MISSING", "The core Test activity type is not available.");
  }
  if (data.folderId) await assertBankFolder(activityBankId, data.folderId);

  return prisma.$transaction(async (tx) => {
    const activity = await tx.bankActivity.create({
      data: {
        bankId: activityBankId,
        activityTypeId: activityType.id,
        title: data.title,
        description: data.description,
        lifecycle: "draft",
        config: {},
        metadata: { coreActivity: "test" },
        position: data.position,
        folderId: data.folderId ?? null,
        createdById: user.id
      }
    });
    await reconcileMediaAssetReferences(tx, { bankActivityId: activity.id }, {
      description: activity.description,
      config: activity.config
    }, { actorId: user.id });
    const test = await tx.bankTest.create({
      data: { bankActivityId: activity.id, settings: data.settings as Prisma.InputJsonValue }
    });
    if (data.lifecycle === "published") await publishBankTestVersion(tx, test.id, user.id);
    return tx.bankTest.findUniqueOrThrow({ where: { id: test.id }, include: bankTestInclude });
  });
}

export async function getBankTestByActivityId(user: CurrentUser, activityBankId: string, bankActivityId: string) {
  await assertCanViewActivityBank(user, activityBankId);
  const test = await prisma.bankTest.findFirst({
    where: { bankActivityId, activity: { bankId: activityBankId } },
    include: bankTestInclude
  });
  if (!test) throw notFound("Bank Test");
  return test;
}

export async function updateBankTest(user: CurrentUser, activityBankId: string, bankActivityId: string, input: unknown) {
  await assertCanManageActivityBank(user, activityBankId);
  const data = BankTestUpdateSchema.parse(input);
  const current = await prisma.bankTest.findFirst({
    where: { bankActivityId, activity: { bankId: activityBankId } },
    include: { activity: true }
  });
  if (!current) throw notFound("Bank Test");
  const settings = data.settings
    ? TestSettingsSchema.parse({ ...asRecord(current.settings), ...data.settings })
    : TestSettingsSchema.parse(current.settings);
  const authoredChanged = data.title !== undefined || data.description !== undefined || data.settings !== undefined;

  return prisma.$transaction(async (tx) => {
    await tx.bankTest.update({ where: { id: current.id }, data: { settings: settings as Prisma.InputJsonValue } });
    const activity = await tx.bankActivity.update({
      where: { id: bankActivityId },
      data: {
        title: data.title,
        description: data.description,
        lifecycle: data.lifecycle === "published" ? "draft" : data.lifecycle ?? (authoredChanged ? "draft" : undefined)
      }
    });
    await reconcileMediaAssetReferences(tx, { bankActivityId }, {
      description: activity.description,
      config: activity.config
    }, { actorId: user.id });
    if (data.lifecycle === "published") await publishBankTestVersion(tx, current.id, user.id);
    return tx.bankTest.findUniqueOrThrow({ where: { id: current.id }, include: bankTestInclude });
  });
}

export async function createBankTestItem(
  user: CurrentUser,
  activityBankId: string,
  testBankActivityId: string,
  input: unknown
) {
  await assertCanManageActivityBank(user, activityBankId);
  const data = TestItemCreateSchema.parse(input);
  const test = await prisma.bankTest.findFirst({
    where: { bankActivityId: testBankActivityId, activity: { bankId: activityBankId } },
    include: { activity: { include: { bank: { select: { subjectId: true } } } }, _count: { select: { items: true } } }
  });
  if (!test) throw notFound("Bank Test");
  const position = data.position ?? test._count.items;

  if (data.source === "bank") {
    const source = await resolvePublishedBankVersion(data.bankActivityId, data.activityVersionId);
    assertActivityCanBelongToTest(source.activityType.key);
    if (source.bankActivity.bank.subjectId !== test.activity.bank.subjectId) {
      throw new AppError(400, "ACTIVITY_BANK_SUBJECT_MISMATCH", "Test activities must belong to the same subject as the Test.");
    }
    if (source.bankActivityId === testBankActivityId) {
      throw new AppError(400, "NESTED_TEST_UNSUPPORTED", "A Test cannot contain another Test.");
    }
    const created = await prisma.$transaction(async (tx) => {
      const child = await tx.bankActivity.create({
        data: {
          bankId: activityBankId,
          activityTypeId: source.activityTypeId,
          title: source.title,
          description: source.description,
          lifecycle: "draft",
          config: source.config as Prisma.InputJsonValue,
          metadata: source.metadata as Prisma.InputJsonValue,
          position,
          folderId: null,
          createdById: user.id,
          knowledgeConcepts: { create: conceptSelectionCreates(selectionsFromStoredLinks(source.knowledgeConcepts)) }
        },
        include: bankActivityInclude
      });
      await reconcileMediaAssetReferences(tx, { bankActivityId: child.id }, {
        description: child.description,
        config: child.config
      }, { trustedCopy: true });
      const item = await tx.bankTestItem.create({
        data: {
          bankTestId: test.id,
          bankActivityId: child.id,
          position,
          pointsPossible: data.pointsPossible,
          isRequired: data.isRequired,
          metadata: data.metadata as Prisma.InputJsonValue
        },
        include: { activity: { include: bankActivityInclude } }
      });
      await tx.bankActivity.update({ where: { id: testBankActivityId }, data: { lifecycle: "draft" } });
      return { item, activity: child };
    });
    return { ...created, sourceBankActivityId: source.bankActivityId };
  }

  assertActivityCanBelongToTest(data.activityTypeKey);
  await assertActivityTypeAvailable(data.activityTypeKey);
  const activityType = await prisma.activityType.findUnique({ where: { key: data.activityTypeKey } });
  if (!activityType) throw new AppError(400, "UNKNOWN_ACTIVITY_TYPE", "The requested activity type is not available.");
  const definition = getActivityDefinition(data.activityTypeKey);
  const config = { ...(definition?.defaultConfig ?? {}), ...data.config };
  definition?.configSchema?.parse(config);
  definition?.metadataSchema?.parse(data.activityMetadata);

  return prisma.$transaction(async (tx) => {
    const child = await tx.bankActivity.create({
      data: {
        bankId: activityBankId,
        activityTypeId: activityType.id,
        title: data.title,
        description: data.description,
        lifecycle: "draft",
        config: config as Prisma.InputJsonValue,
        metadata: data.activityMetadata as Prisma.InputJsonValue,
        position,
        folderId: null,
        createdById: user.id
      },
      include: bankActivityInclude
    });
    await reconcileMediaAssetReferences(tx, { bankActivityId: child.id }, {
      description: child.description,
      config: child.config
    }, { actorId: user.id });
    const item = await tx.bankTestItem.create({
      data: {
        bankTestId: test.id,
        bankActivityId: child.id,
        position,
        pointsPossible: data.pointsPossible,
        isRequired: data.isRequired,
        metadata: data.metadata as Prisma.InputJsonValue
      },
      include: { activity: { include: bankActivityInclude } }
    });
    await tx.bankActivity.update({ where: { id: testBankActivityId }, data: { lifecycle: "draft" } });
    return { item, activity: child, sourceBankActivityId: null };
  });
}

export async function updateBankTestItem(
  user: CurrentUser,
  activityBankId: string,
  testBankActivityId: string,
  itemId: string,
  input: unknown
) {
  await assertCanManageActivityBank(user, activityBankId);
  const data = TestItemUpdateSchema.parse(input);
  const item = await findBankTestItem(activityBankId, testBankActivityId, itemId);
  return prisma.$transaction(async (tx) => {
    const updated = await tx.bankTestItem.update({
      where: { id: item.id },
      data: {
        pointsPossible: data.pointsPossible,
        isRequired: data.isRequired,
        position: data.position,
        metadata: data.metadata as Prisma.InputJsonValue | undefined
      },
      include: { activity: { include: bankActivityInclude } }
    });
    await tx.bankActivity.update({ where: { id: testBankActivityId }, data: { lifecycle: "draft" } });
    return updated;
  });
}

export async function deleteBankTestItem(
  user: CurrentUser,
  activityBankId: string,
  testBankActivityId: string,
  itemId: string
) {
  await assertCanManageActivityBank(user, activityBankId);
  const item = await findBankTestItem(activityBankId, testBankActivityId, itemId);
  await prisma.$transaction(async (tx) => {
    await tx.bankTestItem.update({ where: { id: item.id }, data: { removedAt: new Date() } });
    await tx.bankActivity.update({ where: { id: item.bankActivityId }, data: { lifecycle: "archived" } });
    await tx.bankActivity.update({ where: { id: testBankActivityId }, data: { lifecycle: "draft" } });
  });
  return {
    bankActivityId: item.bankActivityId,
    activityTypeKey: item.activity.activityType.key
  };
}

export async function discardBankTestItem(
  user: CurrentUser,
  activityBankId: string,
  testBankActivityId: string,
  itemId: string
) {
  await assertCanManageActivityBank(user, activityBankId);
  const item = await findBankTestItem(activityBankId, testBankActivityId, itemId);
  await prisma.$transaction(async (tx) => {
    await tx.bankActivity.delete({ where: { id: item.bankActivityId } });
    await tx.bankActivity.update({ where: { id: testBankActivityId }, data: { lifecycle: "draft" } });
  });
  return {
    bankActivityId: item.bankActivityId,
    activityTypeKey: item.activity.activityType.key
  };
}

export async function duplicateBankTest(
  user: CurrentUser,
  activityBankId: string,
  bankActivityId: string,
  input: unknown
) {
  await assertCanManageActivityBank(user, activityBankId);
  const { title } = BankActivityDuplicateSchema.parse(input);
  const source = await prisma.bankTest.findFirst({
    where: { bankActivityId, activity: { bankId: activityBankId } },
    include: {
      activity: { include: { knowledgeConcepts: true } },
      items: {
        where: { removedAt: null },
        include: { activity: { include: { activityType: true, knowledgeConcepts: true } } },
        orderBy: [{ position: "asc" }, { createdAt: "asc" }]
      }
    }
  });
  if (!source) throw notFound("Bank Test");
  const position = await nextTopLevelPosition(activityBankId, source.activity.folderId);

  return prisma.$transaction(async (tx) => {
    const shell = await tx.bankActivity.create({
      data: {
        bankId: activityBankId,
        activityTypeId: source.activity.activityTypeId,
        title,
        description: source.activity.description,
        lifecycle: "draft",
        config: source.activity.config as Prisma.InputJsonValue,
        metadata: source.activity.metadata as Prisma.InputJsonValue,
        position,
        folderId: source.activity.folderId,
        createdById: user.id,
        knowledgeConcepts: { create: copyConceptSelections(source.activity.knowledgeConcepts) }
      }
    });
    await reconcileMediaAssetReferences(tx, { bankActivityId: shell.id }, {
      description: shell.description,
      config: shell.config
    }, { trustedCopy: true });
    const test = await tx.bankTest.create({
      data: { bankActivityId: shell.id, settings: source.settings as Prisma.InputJsonValue }
    });
    const activityCopies: Array<{ sourceBankActivityId: string; bankActivity: { id: string; activityType: { key: string } } }> = [];
    for (const sourceItem of source.items) {
      const child = await tx.bankActivity.create({
        data: {
          bankId: activityBankId,
          activityTypeId: sourceItem.activity.activityTypeId,
          title: sourceItem.activity.title,
          description: sourceItem.activity.description,
          lifecycle: "draft",
          config: sourceItem.activity.config as Prisma.InputJsonValue,
          metadata: sourceItem.activity.metadata as Prisma.InputJsonValue,
          position: sourceItem.position,
          folderId: null,
          createdById: user.id,
          knowledgeConcepts: { create: copyConceptSelections(sourceItem.activity.knowledgeConcepts) }
        },
        include: { activityType: true }
      });
      await reconcileMediaAssetReferences(tx, { bankActivityId: child.id }, {
        description: child.description,
        config: child.config
      }, { trustedCopy: true });
      await tx.bankTestItem.create({
        data: {
          bankTestId: test.id,
          bankActivityId: child.id,
          position: sourceItem.position,
          pointsPossible: sourceItem.pointsPossible,
          isRequired: sourceItem.isRequired,
          metadata: sourceItem.metadata as Prisma.InputJsonValue
        }
      });
      activityCopies.push({ sourceBankActivityId: sourceItem.bankActivityId, bankActivity: child });
    }
    return {
      test: await tx.bankTest.findUniqueOrThrow({ where: { id: test.id }, include: bankTestInclude }),
      activityCopies
    };
  });
}

export async function createCourseTestFromBankVersion(user: CurrentUser, courseId: string, input: unknown) {
  const { assertCanManageCourse } = await import("./authorization");
  await assertCanManageCourse(user, courseId);
  const data = TestFromBankCreateSchema.parse(input);
  const [course, source] = await Promise.all([
    prisma.course.findUnique({ where: { id: courseId }, select: { subjectId: true } }),
    resolveBankTestVersion(data.bankActivityId, data.activityVersionId)
  ]);
  if (!course) throw notFound("Course");
  if (source.test.activity.bank.subjectId !== course.subjectId) {
    throw new AppError(400, "ACTIVITY_BANK_SUBJECT_MISMATCH", "This Test bank does not belong to the course subject.");
  }

  return prisma.$transaction(async (tx) => {
    const shellVersion = source.activityVersion;
    const shell = await tx.activity.create({
      data: {
        courseId,
        bankActivityId: shellVersion.bankActivityId,
        activityVersionId: shellVersion.id,
        activityTypeId: shellVersion.activityTypeId,
        title: shellVersion.title,
        description: shellVersion.description,
        lifecycle: data.lifecycle,
        config: shellVersion.config as Prisma.InputJsonValue,
        metadata: {
          ...asRecord(shellVersion.metadata),
          activityVersionNumber: shellVersion.versionNumber
        } as Prisma.InputJsonValue,
        position: data.position,
        createdById: user.id
      }
    });
    await reconcileMediaAssetReferences(tx, { activityId: shell.id }, {
      description: shell.description,
      config: shell.config
    }, { trustedCopy: true });
    const test = await tx.test.create({
      data: { courseId, activityId: shell.id, settings: source.settings as Prisma.InputJsonValue }
    });
    if (data.contentPlacement) {
      await createCourseTestContentItem(tx, courseId, shell.id, shell.title, data.contentPlacement);
    }
    const activityCopies = [];
    for (const sourceItem of source.items) {
      const version = sourceItem.activityVersion;
      const child = await tx.activity.create({
        data: {
          courseId,
          bankActivityId: version.bankActivityId,
          activityVersionId: version.id,
          activityTypeId: version.activityTypeId,
          title: version.title,
          description: version.description,
          lifecycle: "draft",
          config: version.config as Prisma.InputJsonValue,
          metadata: {
            ...asRecord(version.metadata),
            activityVersionNumber: version.versionNumber
          } as Prisma.InputJsonValue,
          position: sourceItem.position,
          createdById: user.id,
          knowledgeConcepts: { create: conceptSelectionCreates(selectionsFromStoredLinks(version.knowledgeConcepts)) }
        },
        include: { activityType: true }
      });
      await reconcileMediaAssetReferences(tx, { activityId: child.id }, {
        description: child.description,
        config: child.config
      }, { trustedCopy: true });
      await tx.testItem.create({
        data: {
          testId: test.id,
          activityId: child.id,
          position: sourceItem.position,
          pointsPossible: sourceItem.pointsPossible,
          isRequired: sourceItem.isRequired,
          metadata: sourceItem.metadata as Prisma.InputJsonValue
        }
      });
      activityCopies.push({
        bankActivityId: version.bankActivityId,
        activityVersionId: version.id,
        activity: child
      });
    }
    return {
      test: await tx.test.findUniqueOrThrow({
        where: { id: test.id },
        include: {
          activity: { include: { activityType: true, bankActivity: true, activityVersion: true } },
          items: {
            include: { activity: { include: { activityType: true, bankActivity: true, activityVersion: true } } },
            orderBy: [{ position: "asc" }, { createdAt: "asc" }]
          }
        }
      }),
      activityCopies
    };
  });
}

export async function createBankTestFromCourse(
  user: CurrentUser,
  courseId: string,
  testActivityId: string,
  input: unknown
) {
  const { assertCanManageCourse } = await import("./authorization");
  await assertCanManageCourse(user, courseId);
  const data = CourseTestPublishToBankSchema.parse(input);
  await assertCanManageActivityBank(user, data.activityBankId);
  const [course, bank, source] = await Promise.all([
    prisma.course.findUnique({ where: { id: courseId }, select: { subjectId: true } }),
    prisma.activityBank.findUnique({ where: { id: data.activityBankId }, select: { subjectId: true } }),
    prisma.test.findFirst({
      where: { courseId, activityId: testActivityId },
      include: {
        activity: { include: { activityType: true, knowledgeConcepts: true } },
        items: {
          include: { activity: { include: { activityType: true, knowledgeConcepts: true } } },
          orderBy: [{ position: "asc" }, { createdAt: "asc" }]
        }
      }
    })
  ]);
  if (!course || !source) throw notFound("Course Test");
  if (!bank) throw notFound("Activity bank");
  if (course.subjectId !== bank.subjectId) {
    throw new AppError(400, "ACTIVITY_BANK_SUBJECT_MISMATCH", "The destination activity bank must belong to the course subject.");
  }
  if (source.activity.bankActivityId || source.activity.activityVersionId) {
    throw new AppError(409, "TEST_ALREADY_LINKED_TO_BANK", "This Test already comes from an activity bank.");
  }
  const position = await nextTopLevelPosition(data.activityBankId, null);

  return prisma.$transaction(async (tx) => {
    const shell = await tx.bankActivity.create({
      data: {
        bankId: data.activityBankId,
        activityTypeId: source.activity.activityTypeId,
        title: data.title ?? source.activity.title,
        description: source.activity.description,
        lifecycle: "draft",
        config: source.activity.config as Prisma.InputJsonValue,
        metadata: source.activity.metadata as Prisma.InputJsonValue,
        position,
        folderId: null,
        createdById: user.id,
        knowledgeConcepts: { create: copyConceptSelections(source.activity.knowledgeConcepts) }
      }
    });
    await reconcileMediaAssetReferences(tx, { bankActivityId: shell.id }, {
      description: shell.description,
      config: shell.config
    }, { trustedCopy: true });
    const bankTest = await tx.bankTest.create({
      data: { bankActivityId: shell.id, settings: source.settings as Prisma.InputJsonValue }
    });
    const activityCopies = [];
    for (const sourceItem of source.items) {
      const child = await tx.bankActivity.create({
        data: {
          bankId: data.activityBankId,
          activityTypeId: sourceItem.activity.activityTypeId,
          title: sourceItem.activity.title,
          description: sourceItem.activity.description,
          lifecycle: "draft",
          config: sourceItem.activity.config as Prisma.InputJsonValue,
          metadata: sourceItem.activity.metadata as Prisma.InputJsonValue,
          position: sourceItem.position,
          folderId: null,
          createdById: user.id,
          knowledgeConcepts: { create: copyConceptSelections(sourceItem.activity.knowledgeConcepts) }
        },
        include: { activityType: true }
      });
      await reconcileMediaAssetReferences(tx, { bankActivityId: child.id }, {
        description: child.description,
        config: child.config
      }, { trustedCopy: true });
      await tx.bankTestItem.create({
        data: {
          bankTestId: bankTest.id,
          bankActivityId: child.id,
          position: sourceItem.position,
          pointsPossible: sourceItem.pointsPossible,
          isRequired: sourceItem.isRequired,
          metadata: sourceItem.metadata as Prisma.InputJsonValue
        }
      });
      activityCopies.push({ sourceActivity: sourceItem.activity, bankActivity: child });
    }
    return {
      test: await tx.bankTest.findUniqueOrThrow({ where: { id: bankTest.id }, include: bankTestInclude }),
      sourceTestActivity: source.activity,
      activityCopies
    };
  });
}

export async function linkCourseTestToPublishedBankCopy(
  user: CurrentUser,
  courseId: string,
  testActivityId: string,
  input: {
    bankActivityId: string;
    activityVersionId: string;
    versionNumber: number;
    items: Array<{
      sourceActivityId: string;
      bankActivityId: string;
      activityVersionId: string;
      versionNumber: number;
    }>;
  }
) {
  const { assertCanManageCourse } = await import("./authorization");
  await assertCanManageCourse(user, courseId);
  const test = await prisma.test.findFirst({
    where: { courseId, activityId: testActivityId },
    include: { activity: true, items: { include: { activity: true } } }
  });
  if (!test) throw notFound("Course Test");
  const testActivityIds = new Set(test.items.map((item) => item.activityId));
  if (input.items.some((item) => !testActivityIds.has(item.sourceActivityId))) {
    throw new AppError(400, "TEST_BANK_LINK_INVALID", "The bank copy does not match this Test composition.");
  }
  await prisma.$transaction(async (tx) => {
    await tx.activity.update({
      where: { id: testActivityId },
      data: {
        bankActivityId: input.bankActivityId,
        activityVersionId: input.activityVersionId,
        metadata: { ...asRecord(test.activity.metadata), activityVersionNumber: input.versionNumber } as Prisma.InputJsonValue
      }
    });
    for (const item of input.items) {
      const source = test.items.find((candidate) => candidate.activityId === item.sourceActivityId)!;
      await tx.activity.update({
        where: { id: item.sourceActivityId },
        data: {
          bankActivityId: item.bankActivityId,
          activityVersionId: item.activityVersionId,
          metadata: { ...asRecord(source.activity.metadata), activityVersionNumber: item.versionNumber } as Prisma.InputJsonValue
        }
      });
    }
  });
}

export async function findBankTestByShellActivityId(bankActivityId: string) {
  return prisma.bankTest.findUnique({ where: { bankActivityId }, select: { id: true } });
}

async function findBankTestItem(activityBankId: string, testBankActivityId: string, itemId: string) {
  const item = await prisma.bankTestItem.findFirst({
    where: {
      id: itemId,
      removedAt: null,
      test: { bankActivityId: testBankActivityId, activity: { bankId: activityBankId } }
    },
    include: { activity: { include: { activityType: true } } }
  });
  if (!item) throw notFound("Bank Test item");
  return item;
}

async function resolvePublishedBankVersion(bankActivityId: string, activityVersionId?: string) {
  const version = activityVersionId
    ? await prisma.activityVersion.findFirst({
        where: { id: activityVersionId, bankActivityId, lifecycle: "published" },
        include: { activityType: true, knowledgeConcepts: true, bankActivity: { include: { bank: true } } }
      })
    : (
        await prisma.bankActivity.findUnique({
          where: { id: bankActivityId },
          include: {
            currentVersion: {
              include: { activityType: true, knowledgeConcepts: true, bankActivity: { include: { bank: true } } }
            }
          }
        })
      )?.currentVersion;
  if (!version || version.lifecycle !== "published") throw notFound("Published activity version");
  return version;
}

async function resolveBankTestVersion(bankActivityId: string, activityVersionId?: string) {
  const version = await resolvePublishedBankVersion(bankActivityId, activityVersionId);
  if (version.activityType.key !== "test") throw new AppError(400, "BANK_TEST_REQUIRED", "Choose a published bank Test.");
  const bankTestVersion = await prisma.bankTestVersion.findUnique({
    where: { activityVersionId: version.id },
    include: {
      activityVersion: true,
      test: { include: { activity: { include: { bank: true } } } },
      items: {
        include: { activityVersion: { include: { activityType: true, knowledgeConcepts: true } } },
        orderBy: [{ position: "asc" }, { createdAt: "asc" }]
      }
    }
  });
  if (!bankTestVersion) throw new AppError(409, "BANK_TEST_VERSION_MISSING", "This Test version does not contain a reusable composition snapshot.");
  return bankTestVersion;
}

type BankTestTransaction = Prisma.TransactionClient;

async function publishBankTestVersion(tx: BankTestTransaction, bankTestId: string, actorId: string) {
  const test = await tx.bankTest.findUniqueOrThrow({
    where: { id: bankTestId },
    include: {
      activity: { include: { activityType: true } },
      items: {
        where: { removedAt: null },
        include: { activity: { include: { knowledgeConcepts: true } } },
        orderBy: [{ position: "asc" }, { createdAt: "asc" }]
      },
      versions: {
        include: {
          activityVersion: true,
          items: { include: { activityVersion: { include: { knowledgeConcepts: true } } }, orderBy: [{ position: "asc" }, { createdAt: "asc" }] }
        },
        orderBy: { createdAt: "desc" },
        take: 1
      }
    }
  });
  const latest = test.versions[0];
  if (latest && bankTestSnapshotFingerprint(test) === bankTestVersionFingerprint(latest)) {
    await tx.bankActivity.update({
      where: { id: test.bankActivityId },
      data: { lifecycle: "published", currentVersionId: latest.activityVersionId }
    });
    return latest;
  }

  const childVersions: Array<{ id: string }> = [];
  for (const item of test.items) {
    childVersions.push(await ensurePublishedChildVersion(tx, item.activity, actorId));
  }
  const lastVersion = await tx.activityVersion.findFirst({
    where: { bankActivityId: test.bankActivityId },
    orderBy: { versionNumber: "desc" },
    select: { versionNumber: true }
  });
  const shellVersion = await tx.activityVersion.create({
    data: {
      bankActivityId: test.bankActivityId,
      versionNumber: (lastVersion?.versionNumber ?? 0) + 1,
      activityTypeId: test.activity.activityTypeId,
      title: test.activity.title,
      description: test.activity.description,
      lifecycle: "published",
      config: test.activity.config as Prisma.InputJsonValue,
      metadata: test.activity.metadata as Prisma.InputJsonValue,
      createdById: actorId
    }
  });
  await reconcileMediaAssetReferences(tx, { activityVersionId: shellVersion.id }, {
    description: shellVersion.description,
    config: shellVersion.config
  }, { trustedCopy: true });
  const version = await tx.bankTestVersion.create({
    data: {
      bankTestId: test.id,
      activityVersionId: shellVersion.id,
      settings: test.settings as Prisma.InputJsonValue,
      items: {
        create: test.items.map((item, index) => ({
          sourceBankTestItemId: item.id,
          activityVersionId: childVersions[index].id,
          position: item.position,
          pointsPossible: item.pointsPossible,
          isRequired: item.isRequired,
          metadata: item.metadata as Prisma.InputJsonValue
        }))
      }
    }
  });
  await tx.bankActivity.update({
    where: { id: test.bankActivityId },
    data: { lifecycle: "published", currentVersionId: shellVersion.id }
  });
  return version;
}

async function ensurePublishedChildVersion(
  tx: BankTestTransaction,
  activity: {
    id: string;
    activityTypeId: string;
    title: string;
    description: string;
    config: unknown;
    metadata: unknown;
    knowledgeConcepts: Parameters<typeof selectionsFromStoredLinks>[0];
  },
  actorId: string
) {
  const latest = await tx.activityVersion.findFirst({
    where: { bankActivityId: activity.id, lifecycle: "published" },
    orderBy: { versionNumber: "desc" },
    include: { knowledgeConcepts: true }
  });
  if (latest && genericActivityFingerprint(activity) === genericActivityFingerprint(latest)) {
    await tx.bankActivity.update({ where: { id: activity.id }, data: { lifecycle: "published", currentVersionId: latest.id } });
    return latest;
  }
  const last = await tx.activityVersion.findFirst({
    where: { bankActivityId: activity.id },
    orderBy: { versionNumber: "desc" },
    select: { versionNumber: true }
  });
  const selections = selectionsFromStoredLinks(activity.knowledgeConcepts);
  const version = await tx.activityVersion.create({
    data: {
      bankActivityId: activity.id,
      versionNumber: (last?.versionNumber ?? 0) + 1,
      activityTypeId: activity.activityTypeId,
      title: activity.title,
      description: activity.description,
      lifecycle: "published",
      config: activity.config as Prisma.InputJsonValue,
      metadata: activity.metadata as Prisma.InputJsonValue,
      createdById: actorId,
      knowledgeConcepts: { create: conceptSelectionCreates(selections) }
    },
    include: { knowledgeConcepts: true }
  });
  await reconcileMediaAssetReferences(tx, { activityVersionId: version.id }, {
    description: version.description,
    config: version.config
  }, { trustedCopy: true });
  await tx.bankActivity.update({ where: { id: activity.id }, data: { lifecycle: "published", currentVersionId: version.id } });
  return version;
}

function bankTestSnapshotFingerprint(test: {
  activity: { activityTypeId: string; title: string; description: string; config: unknown; metadata: unknown };
  settings: unknown;
  items: Array<{
    id: string;
    position: number;
    pointsPossible: number;
    isRequired: boolean;
    metadata: unknown;
    activity: { activityTypeId: string; title: string; description: string; config: unknown; metadata: unknown; knowledgeConcepts: Parameters<typeof selectionsFromStoredLinks>[0] };
  }>;
}) {
  return fingerprint({
    activity: bankTestShellSnapshot(test.activity),
    settings: test.settings,
    items: test.items.map((item) => ({
      sourceBankTestItemId: item.id,
      position: item.position,
      pointsPossible: item.pointsPossible,
      isRequired: item.isRequired,
      metadata: item.metadata,
      activity: genericActivitySnapshot(item.activity)
    }))
  });
}

function bankTestVersionFingerprint(version: {
  activityVersion: { activityTypeId: string; title: string; description: string; config: unknown; metadata: unknown };
  settings: unknown;
  items: Array<{
    sourceBankTestItemId: string;
    position: number;
    pointsPossible: number;
    isRequired: boolean;
    metadata: unknown;
    activityVersion: { activityTypeId: string; title: string; description: string; config: unknown; metadata: unknown; knowledgeConcepts: Parameters<typeof selectionsFromStoredLinks>[0] };
  }>;
}) {
  return fingerprint({
    activity: bankTestShellSnapshot(version.activityVersion),
    settings: version.settings,
    items: version.items.map((item) => ({
      sourceBankTestItemId: item.sourceBankTestItemId,
      position: item.position,
      pointsPossible: item.pointsPossible,
      isRequired: item.isRequired,
      metadata: item.metadata,
      activity: genericActivitySnapshot(item.activityVersion)
    }))
  });
}

function bankTestShellSnapshot(activity: {
  activityTypeId: string;
  title: string;
  description: string;
  config: unknown;
  metadata: unknown;
}) {
  return {
    activityTypeId: activity.activityTypeId,
    title: activity.title,
    description: activity.description,
    config: activity.config,
    metadata: activity.metadata
  };
}

function genericActivityFingerprint(activity: Parameters<typeof genericActivitySnapshot>[0]) {
  return fingerprint(genericActivitySnapshot(activity));
}

function genericActivitySnapshot(activity: {
  activityTypeId: string;
  title: string;
  description: string;
  config: unknown;
  metadata: unknown;
  knowledgeConcepts: Parameters<typeof selectionsFromStoredLinks>[0];
}) {
  return {
    activityTypeId: activity.activityTypeId,
    title: activity.title,
    description: activity.description,
    config: activity.config,
    metadata: activity.metadata,
    knowledgeConcepts: selectionsFromStoredLinks(activity.knowledgeConcepts)
  };
}

function fingerprint(value: unknown) {
  return createHash("sha256").update(stableJson(value)).digest("hex");
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => `${JSON.stringify(key)}:${stableJson(child)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

function assertActivityCanBelongToTest(activityTypeKey: string) {
  const provider = getActivityProviderForActivityType(activityTypeKey);
  if (provider?.kind !== "plugin") {
    throw new AppError(400, "TEST_ITEM_ACTIVITY_UNSUPPORTED", "Choose a plugin activity for this Test.");
  }
}

async function assertBankFolder(activityBankId: string, folderId: string) {
  const folder = await prisma.activityBankFolder.findFirst({ where: { id: folderId, bankId: activityBankId }, select: { id: true } });
  if (!folder) throw notFound("Activity bank folder");
}

async function nextTopLevelPosition(activityBankId: string, folderId: string | null) {
  const last = await prisma.bankActivity.findFirst({
    where: { bankId: activityBankId, folderId, bankTestItem: null },
    orderBy: [{ position: "desc" }, { createdAt: "desc" }],
    select: { position: true }
  });
  return (last?.position ?? -1) + 1;
}

function copyConceptSelections(selections: Array<{ conceptId: string; selectsAllSkills: boolean; selectedSkills: unknown; selectedSkillIds: unknown }>) {
  return selections.map((selection) => ({
    conceptId: selection.conceptId,
    selectsAllSkills: selection.selectsAllSkills,
    selectedSkills: selection.selectedSkills as Prisma.InputJsonValue,
    selectedSkillIds: selection.selectedSkillIds as Prisma.InputJsonValue
  }));
}

async function createCourseTestContentItem(
  tx: BankTestTransaction,
  courseId: string,
  activityId: string,
  title: string,
  placement: NonNullable<ReturnType<typeof TestFromBankCreateSchema.parse>["contentPlacement"]>
) {
  if (placement.parentId) {
    const parent = await tx.courseContentItem.findFirst({
      where: { id: placement.parentId, courseId, groupId: null, kind: "folder" },
      select: { id: true }
    });
    if (!parent) throw notFound("Parent folder");
  }
  const position = placement.position ?? await tx.courseContentItem.count({
    where: { courseId, groupId: null, parentId: placement.parentId ?? null }
  });
  await tx.courseContentItem.create({
    data: {
      courseId,
      parentId: placement.parentId ?? null,
      kind: "activity",
      titleSnapshot: placement.titleSnapshot ?? title,
      position,
      isVisible: placement.isVisible,
      activityId,
      metadata: placement.metadata as Prisma.InputJsonValue
    }
  });
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
