import { getActivityDefinition } from "@cognelo/activity-sdk";
import {
  ActivityBankInputSchema,
  ActivityBankUpdateSchema,
  BankActivityInputSchema,
  BankActivityUpdateSchema,
  SubjectInputSchema,
  SubjectUpdateSchema
} from "@cognelo/contracts";
import { Prisma, prisma } from "@cognelo/db";
import type { CurrentUser } from "@cognelo/contracts";
import { AppError, forbidden, notFound } from "./errors";
import { isAdmin, isCourseManager, isTeacher } from "./authorization";

const subjectInclude = {
  materials: { orderBy: [{ position: "asc" as const }, { createdAt: "asc" as const }] },
  activityBanks: {
    include: {
      owner: { select: { id: true, email: true, name: true } },
      activities: {
        include: { activityType: true, currentVersion: true },
        orderBy: [{ position: "asc" as const }, { createdAt: "asc" as const }]
      }
    },
    orderBy: [{ updatedAt: "desc" as const }, { createdAt: "desc" as const }]
  },
  courses: { orderBy: [{ updatedAt: "desc" as const }, { createdAt: "desc" as const }] }
};

export async function listSubjects(user: CurrentUser) {
  await assertCanViewSubjects(user);
  return prisma.subject.findMany({
    include: subjectInclude,
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }]
  });
}

export async function getSubject(user: CurrentUser, subjectId: string) {
  await assertCanViewSubjects(user);
  const subject = await prisma.subject.findUnique({
    where: { id: subjectId },
    include: subjectInclude
  });
  if (!subject) {
    throw notFound("Subject");
  }
  return subject;
}

export async function createSubject(user: CurrentUser, input: unknown) {
  await assertCanManageSubjects(user);
  const data = SubjectInputSchema.parse(input);
  return prisma.subject.create({
    data: {
      title: data.title,
      description: data.description,
      metadata: data.metadata as Prisma.InputJsonValue,
      createdById: user.id
    },
    include: subjectInclude
  });
}

export async function updateSubject(user: CurrentUser, subjectId: string, input: unknown) {
  await assertCanManageSubjects(user);
  const data = SubjectUpdateSchema.parse(input);
  return prisma.subject.update({
    where: { id: subjectId },
    data: {
      title: data.title,
      description: data.description,
      metadata: data.metadata as Prisma.InputJsonValue | undefined
    },
    include: subjectInclude
  });
}

export async function listActivityBanks(user: CurrentUser, subjectId?: string) {
  await assertCanViewSubjects(user);
  return prisma.activityBank.findMany({
    where: subjectId ? { subjectId } : undefined,
    include: {
      subject: true,
      owner: { select: { id: true, email: true, name: true } },
      activities: {
        include: { activityType: true, currentVersion: true },
        orderBy: [{ position: "asc" as const }, { createdAt: "asc" as const }]
      }
    },
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }]
  });
}

export async function getActivityBank(user: CurrentUser, activityBankId: string) {
  await assertCanViewActivityBank(user, activityBankId);
  const bank = await prisma.activityBank.findUnique({
    where: { id: activityBankId },
    include: {
      subject: true,
      owner: { select: { id: true, email: true, name: true } },
      activities: {
        include: {
          activityType: true,
          currentVersion: true,
          versions: { orderBy: { versionNumber: "desc" } }
        },
        orderBy: [{ position: "asc" }, { createdAt: "asc" }]
      }
    }
  });
  if (!bank) {
    throw notFound("Activity bank");
  }
  return bank;
}

export async function createActivityBank(user: CurrentUser, input: unknown) {
  await assertCanCreateActivityBank(user);
  const data = ActivityBankInputSchema.parse(input);
  const ownerId = isAdmin(user) && data.ownerId ? data.ownerId : user.id;

  return prisma.activityBank.create({
    data: {
      subjectId: data.subjectId,
      title: data.title,
      description: data.description,
      ownerId,
      metadata: data.metadata as Prisma.InputJsonValue
    },
    include: {
      subject: true,
      owner: { select: { id: true, email: true, name: true } },
      activities: {
        include: { activityType: true, currentVersion: true },
        orderBy: [{ position: "asc" as const }, { createdAt: "asc" as const }]
      }
    }
  });
}

export async function updateActivityBank(user: CurrentUser, activityBankId: string, input: unknown) {
  const bank = await prisma.activityBank.findUnique({ where: { id: activityBankId } });
  if (!bank) {
    throw notFound("Activity bank");
  }
  if (!isAdmin(user) && bank.ownerId !== user.id) {
    throw forbidden();
  }

  const data = ActivityBankUpdateSchema.parse(input);
  return prisma.activityBank.update({
    where: { id: activityBankId },
    data: {
      title: data.title,
      description: data.description,
      ownerId: isAdmin(user) ? data.ownerId : undefined,
      metadata: data.metadata as Prisma.InputJsonValue | undefined
    },
    include: {
      subject: true,
      owner: { select: { id: true, email: true, name: true } },
      activities: {
        include: { activityType: true, currentVersion: true },
        orderBy: [{ position: "asc" as const }, { createdAt: "asc" as const }]
      }
    }
  });
}

export async function listBankActivities(user: CurrentUser, activityBankId: string) {
  await assertCanViewActivityBank(user, activityBankId);
  return prisma.bankActivity.findMany({
    where: { bankId: activityBankId },
    include: {
      activityType: true,
      currentVersion: true,
      versions: { orderBy: { versionNumber: "desc" } }
    },
    orderBy: [{ position: "asc" }, { createdAt: "asc" }]
  });
}

export async function createBankActivity(user: CurrentUser, activityBankId: string, input: unknown) {
  await assertCanManageActivityBank(user, activityBankId);
  const data = BankActivityInputSchema.parse(input);
  const activityType = await resolveActivityType(data.activityTypeKey);
  const mergedConfig = validateActivityPayload(data.activityTypeKey, data.config, data.metadata);

  return prisma.$transaction(async (transaction) => {
    const bankActivity = await transaction.bankActivity.create({
      data: {
        bankId: activityBankId,
        activityTypeId: activityType.id,
        title: data.title,
        description: data.description,
        lifecycle: data.lifecycle,
        config: mergedConfig as Prisma.InputJsonValue,
        metadata: data.metadata as Prisma.InputJsonValue,
        position: data.position,
        createdById: user.id
      }
    });

    const version = await transaction.activityVersion.create({
      data: {
        bankActivityId: bankActivity.id,
        versionNumber: 1,
        activityTypeId: activityType.id,
        title: data.title,
        description: data.description,
        lifecycle: data.lifecycle,
        config: mergedConfig as Prisma.InputJsonValue,
        metadata: data.metadata as Prisma.InputJsonValue,
        createdById: user.id
      }
    });

    return transaction.bankActivity.update({
      where: { id: bankActivity.id },
      data: { currentVersionId: version.id },
      include: {
        activityType: true,
        currentVersion: true,
        versions: { orderBy: { versionNumber: "desc" } }
      }
    });
  });
}

export async function updateBankActivity(user: CurrentUser, bankActivityId: string, input: unknown) {
  const bankActivity = await prisma.bankActivity.findUnique({
    where: { id: bankActivityId },
    include: { bank: true, activityType: true, versions: { orderBy: { versionNumber: "desc" }, take: 1 } }
  });
  if (!bankActivity) {
    throw notFound("Bank activity");
  }
  await assertCanManageActivityBank(user, bankActivity.bankId);

  const data = BankActivityUpdateSchema.parse(input);
  const activityTypeKey = data.activityTypeKey ?? bankActivity.activityType.key;
  const activityType = data.activityTypeKey ? await resolveActivityType(data.activityTypeKey) : bankActivity.activityType;
  const currentConfig = (bankActivity.config as Record<string, unknown> | null) ?? {};
  const currentMetadata = (bankActivity.metadata as Record<string, unknown> | null) ?? {};
  const mergedConfig = validateActivityPayload(activityTypeKey, data.config ? { ...currentConfig, ...data.config } : currentConfig, data.metadata ?? currentMetadata);
  const nextVersionNumber = (bankActivity.versions[0]?.versionNumber ?? 0) + 1;
  const nextTitle = data.title ?? bankActivity.title;
  const nextDescription = data.description ?? bankActivity.description;
  const nextLifecycle = data.lifecycle ?? bankActivity.lifecycle;
  const nextMetadata = data.metadata ?? currentMetadata;

  return prisma.$transaction(async (transaction) => {
    const version = await transaction.activityVersion.create({
      data: {
        bankActivityId,
        versionNumber: nextVersionNumber,
        activityTypeId: activityType.id,
        title: nextTitle,
        description: nextDescription,
        lifecycle: nextLifecycle,
        config: mergedConfig as Prisma.InputJsonValue,
        metadata: nextMetadata as Prisma.InputJsonValue,
        createdById: user.id
      }
    });

    return transaction.bankActivity.update({
      where: { id: bankActivityId },
      data: {
        activityTypeId: activityType.id,
        title: nextTitle,
        description: nextDescription,
        lifecycle: nextLifecycle,
        config: mergedConfig as Prisma.InputJsonValue,
        metadata: nextMetadata as Prisma.InputJsonValue,
        position: data.position,
        currentVersionId: version.id
      },
      include: {
        activityType: true,
        currentVersion: true,
        versions: { orderBy: { versionNumber: "desc" } }
      }
    });
  });
}

async function assertCanViewSubjects(user: CurrentUser) {
  if (isAdmin(user) || isTeacher(user) || isCourseManager(user)) {
    return;
  }
  throw forbidden();
}

async function assertCanManageSubjects(user: CurrentUser) {
  if (isCourseManager(user)) {
    return;
  }
  throw forbidden();
}

async function assertCanCreateActivityBank(user: CurrentUser) {
  if (isAdmin(user) || isTeacher(user) || isCourseManager(user)) {
    return;
  }
  throw forbidden();
}

async function assertCanViewActivityBank(user: CurrentUser, activityBankId: string) {
  await assertCanViewSubjects(user);
  const bank = await prisma.activityBank.findUnique({ where: { id: activityBankId } });
  if (!bank) {
    throw notFound("Activity bank");
  }
}

export async function assertCanManageActivityBank(user: CurrentUser, activityBankId: string) {
  const bank = await prisma.activityBank.findUnique({ where: { id: activityBankId } });
  if (!bank) {
    throw notFound("Activity bank");
  }
  if (isAdmin(user) || bank.ownerId === user.id) {
    return;
  }
  throw forbidden();
}

async function resolveActivityType(activityTypeKey: string) {
  const activityType = await prisma.activityType.findUnique({
    where: { key: activityTypeKey }
  });
  if (!activityType || !activityType.isEnabled) {
    throw new AppError(400, "UNKNOWN_ACTIVITY_TYPE", "The requested activity type is not available.");
  }
  return activityType;
}

function validateActivityPayload(activityTypeKey: string, config: Record<string, unknown>, metadata: Record<string, unknown>) {
  const definition = getActivityDefinition(activityTypeKey);
  const mergedConfig = { ...(definition?.defaultConfig ?? {}), ...config };
  if (definition?.configSchema) {
    definition.configSchema.parse(mergedConfig);
  }
  if (definition?.metadataSchema) {
    definition.metadataSchema.parse(metadata);
  }
  return mergedConfig;
}
