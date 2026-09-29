import {
  resolveBankActivityVariationHandler,
  runBankActivityDeletedHooks,
  runBankActivityDuplicatedHooks,
  type ServerActivityRecord
} from "@cognelo/activity-sdk/server";
import type { CurrentUser } from "@cognelo/contracts";
import {
  AppError,
  NonRetryableBackgroundJobError,
  assertCanManageActivityBank,
  deleteBankActivity,
  duplicateBankActivity,
  duplicateBankTest,
  enqueueBackgroundJob,
  findBankTestByShellActivityId,
  getBackgroundJob,
  getBankActivity,
  getBankActivityVariationGenerationContext,
  getBankTestByActivityId,
  isBackgroundJobHandlerRegistered,
  registerBackgroundJobHandler,
  startBackgroundJobWorker,
  updateBackgroundJobMetadata,
  type BackgroundJobRecord
} from "@cognelo/core";
import { z } from "zod";

export const activityVariationQueue = "activity-variations";
export const activityVariationHandlerKey = "activity-banks.create-variation";

const createVariationSchema = z.object({
  instructions: z.string().trim().max(4000).default(""),
  locale: z.enum(["en", "fr", "zh", "ar"]).default("en"),
  title: z.string().trim().min(2).max(160)
});

type ActivityVariationPayload = {
  activityBankId: string;
  bankActivityId: string;
  instructions: string;
  locale: "en" | "fr" | "zh" | "ar";
  title: string;
  user: CurrentUser;
};

let unregisterHandler: (() => void) | null = null;

export function registerActivityVariationBackgroundJobs() {
  if (unregisterHandler) return unregisterHandler;
  if (isBackgroundJobHandlerRegistered(activityVariationHandlerKey)) {
    unregisterHandler = () => undefined;
    return unregisterHandler;
  }
  unregisterHandler = registerBackgroundJobHandler(activityVariationHandlerKey, async ({ job }) => processActivityVariation(job));
  return unregisterHandler;
}

export async function enqueueActivityVariation(
  user: CurrentUser,
  activityBankId: string,
  bankActivityId: string,
  rawInput: unknown
) {
  registerActivityVariationBackgroundJobs();
  const input = createVariationSchema.parse(rawInput);
  await assertCanManageActivityBank(user, activityBankId);
  const source = await getBankActivity(user, activityBankId, bankActivityId);
  if (source.bankTestItem) {
    throw new AppError(409, "BANK_TEST_ITEM_VARIATION_UNSUPPORTED", "Create a variation of the containing Test instead.");
  }

  const bankTest = source.bankTestDefinition
    ? await getBankTestByActivityId(user, activityBankId, bankActivityId)
    : null;
  const activityTypes = bankTest
    ? bankTest.items.map((item) => item.activity.activityType.key)
    : [source.activityType.key];
  const unsupportedTypes = [...new Set(activityTypes.filter((key) => !resolveBankActivityVariationHandler(key)))];
  if (unsupportedTypes.length) {
    throw new AppError(
      409,
      "ACTIVITY_VARIATION_UNSUPPORTED",
      "Every activity in a Test must support variations before a Test variation can be created.",
      { activityTypeKeys: unsupportedTypes }
    );
  }

  const total = bankTest ? bankTest.items.length : 1;
  const job = await enqueueBackgroundJob({
    handlerKey: activityVariationHandlerKey,
    maxAttempts: 1,
    metadata: {
      activityBankId,
      bankActivityId,
      sourceTitle: source.title,
      userId: user.id,
      progress: { completed: 0, fraction: 0, stage: "queued", step: "content", total }
    },
    payload: { activityBankId, bankActivityId, ...input, user },
    queue: activityVariationQueue
  });
  startBackgroundJobWorker({
    idleTimeoutMs: 60_000,
    queue: activityVariationQueue,
    workerId: "activity-variation-api-worker"
  });
  return toActivityVariationJob(job);
}

export async function getActivityVariationJob(
  user: CurrentUser,
  activityBankId: string,
  bankActivityId: string,
  jobId: string
) {
  await assertCanManageActivityBank(user, activityBankId);
  const job = await getBackgroundJob(jobId);
  if (
    !job ||
    job.handlerKey !== activityVariationHandlerKey ||
    job.metadata.activityBankId !== activityBankId ||
    job.metadata.bankActivityId !== bankActivityId ||
    job.metadata.userId !== user.id
  ) {
    throw new AppError(404, "ACTIVITY_VARIATION_JOB_NOT_FOUND", "The activity variation job was not found.");
  }
  return toActivityVariationJob(job);
}

async function processActivityVariation(job: BackgroundJobRecord) {
  const payload = normalizePayload(job.payload);
  let createdBankActivityId: string | null = null;
  try {
    await assertCanManageActivityBank(payload.user, payload.activityBankId);
    await reportJobProgress(job.id, { completed: 0, fraction: 0, stage: "duplicating", step: "content", total: progressTotal(job) });
    const isTest = Boolean(await findBankTestByShellActivityId(payload.bankActivityId));
    let copies: Array<{ sourceBankActivityId: string; bankActivityId: string; activityTypeKey: string }>;

    if (isTest) {
      const duplicated = await duplicateBankTest(payload.user, payload.activityBankId, payload.bankActivityId, { title: payload.title });
      createdBankActivityId = duplicated.test.bankActivityId;
      copies = duplicated.activityCopies.map((copy) => ({
        sourceBankActivityId: copy.sourceBankActivityId,
        bankActivityId: copy.bankActivity.id,
        activityTypeKey: copy.bankActivity.activityType.key
      }));
    } else {
      const duplicated = await duplicateBankActivity(payload.user, payload.activityBankId, payload.bankActivityId, { title: payload.title });
      createdBankActivityId = duplicated.id;
      copies = [{
        sourceBankActivityId: payload.bankActivityId,
        bankActivityId: duplicated.id,
        activityTypeKey: duplicated.activityType.key
      }];
    }

    for (const copy of copies) {
      await runBankActivityDuplicatedHooks({
        user: payload.user,
        activityBankId: payload.activityBankId,
        ...copy
      });
    }

    for (const [index, copy] of copies.entries()) {
      const handler = resolveBankActivityVariationHandler(copy.activityTypeKey);
      if (!handler) {
        throw new AppError(409, "ACTIVITY_VARIATION_UNSUPPORTED", `The activity type ${copy.activityTypeKey} does not support variations.`);
      }
      const [sourceActivity, activity, generationContext] = await Promise.all([
        getBankActivity(payload.user, payload.activityBankId, copy.sourceBankActivityId),
        getBankActivity(payload.user, payload.activityBankId, copy.bankActivityId),
        getBankActivityVariationGenerationContext(payload.user, payload.activityBankId, copy.sourceBankActivityId)
      ]);
      await reportJobProgress(job.id, {
        completed: index,
        currentActivityTitle: sourceActivity.title,
        fraction: 0,
        stage: "generating",
        step: "content",
        total: copies.length
      });
      await handler({
        user: payload.user,
        activityBankId: payload.activityBankId,
        sourceActivity: toServerActivityRecord(sourceActivity),
        activity: toServerActivityRecord(activity),
        instructions: payload.instructions,
        locale: generationContext.locale,
        subject: generationContext.subject,
        knowledge: generationContext.knowledge,
        reportProgress: async ({ fraction, step }) => {
          await reportJobProgress(job.id, {
            completed: index,
            currentActivityTitle: sourceActivity.title,
            fraction: Math.max(0, Math.min(fraction, 0.99)),
            stage: "generating",
            step,
            total: copies.length
          });
        }
      });
      await reportJobProgress(job.id, {
        completed: index + 1,
        currentActivityTitle: sourceActivity.title,
        fraction: 0,
        stage: index + 1 === copies.length ? "finalizing" : "generating",
        step: "saving",
        total: copies.length
      });
    }

    await reportJobProgress(job.id, {
      completed: copies.length,
      fraction: 0,
      stage: "complete",
      step: "saving",
      total: copies.length
    });
    return { activityId: createdBankActivityId, title: payload.title };
  } catch (error) {
    let cleanupError: unknown = null;
    if (createdBankActivityId) {
      try {
        await cleanupVariation(payload.user, payload.activityBankId, createdBankActivityId);
      } catch (caught) {
        cleanupError = caught;
      }
    }
    const code = error instanceof AppError ? error.code : "ACTIVITY_VARIATION_FAILED";
    const message = error instanceof Error ? error.message : "The activity variation could not be created.";
    if (cleanupError) {
      const cleanupMessage = cleanupError instanceof Error ? cleanupError.message : "Unknown cleanup error.";
      throw new NonRetryableBackgroundJobError(
        `${message} The incomplete copy could not be removed: ${cleanupMessage}`,
        "ACTIVITY_VARIATION_CLEANUP_FAILED"
      );
    }
    throw new NonRetryableBackgroundJobError(message, code);
  }
}

async function cleanupVariation(user: CurrentUser, activityBankId: string, bankActivityId: string) {
  const deleted = await deleteBankActivity(user, activityBankId, bankActivityId, { force: true });
  for (const activity of deleted.deletedActivities ?? []) {
    await runBankActivityDeletedHooks({ user, activityBankId, ...activity }).catch(() => undefined);
  }
}

async function reportJobProgress(jobId: string, progress: Record<string, unknown>) {
  await updateBackgroundJobMetadata(jobId, { progress });
}

function normalizePayload(value: Record<string, unknown>): ActivityVariationPayload {
  const parsed = createVariationSchema.safeParse(value);
  const activityBankId = stringValue(value.activityBankId);
  const bankActivityId = stringValue(value.bankActivityId);
  const user = normalizeUser(value.user);
  if (!parsed.success || !activityBankId || !bankActivityId || !user) {
    throw new NonRetryableBackgroundJobError("The activity variation job payload is invalid.", "ACTIVITY_VARIATION_PAYLOAD_INVALID");
  }
  return { activityBankId, bankActivityId, ...parsed.data, user };
}

function normalizeUser(value: unknown): CurrentUser | null {
  const record = asRecord(value);
  const id = stringValue(record.id);
  const email = stringValue(record.email);
  const roles = Array.isArray(record.roles)
    ? record.roles.filter((role): role is CurrentUser["roles"][number] => typeof role === "string")
    : [];
  if (!id || !email || !roles.length) return null;
  return {
    id,
    email,
    roles,
    firstName: typeof record.firstName === "string" ? record.firstName : null,
    lastName: typeof record.lastName === "string" ? record.lastName : null,
    name: typeof record.name === "string" ? record.name : null
  };
}

function toServerActivityRecord(activity: Awaited<ReturnType<typeof getBankActivity>>): ServerActivityRecord {
  return {
    id: activity.id,
    title: activity.title,
    description: activity.description,
    lifecycle: activity.lifecycle,
    config: asRecord(activity.config),
    metadata: asRecord(activity.metadata),
    activityType: {
      key: activity.activityType.key,
      name: activity.activityType.name,
      description: activity.activityType.description
    }
  };
}

function toActivityVariationJob(job: BackgroundJobRecord) {
  return {
    id: job.id,
    status: job.status,
    progress: asRecord(job.metadata.progress),
    result: job.result,
    error: job.error,
    createdAt: job.createdAt.toISOString(),
    updatedAt: job.updatedAt.toISOString()
  };
}

function progressTotal(job: BackgroundJobRecord) {
  const total = asRecord(job.metadata.progress).total;
  return typeof total === "number" && Number.isFinite(total) ? total : 1;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}
