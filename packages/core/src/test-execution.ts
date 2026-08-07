import { createHash } from "node:crypto";
import { getActivityDefinition, type ActivityGradingResult } from "@cognelo/activity-sdk";
import type { CurrentUser } from "@cognelo/contracts";
import { Prisma, prisma } from "@cognelo/db";
import { AppError, forbidden, notFound } from "./errors";
import { getActivityAttemptAvailability, startActivityAttempt, submitActivityAttempt } from "./gradebook";
import { getGroupAssignedActivity } from "./groups";

const CORE_TEST_RUNTIME_KEY = "core:test";
const CORE_TEST_RUNTIME_VERSION = "0.1.0";

const runtimeTestInclude = {
  activity: { include: { activityType: true } },
  items: {
    include: { activity: { include: { activityType: true } } },
    orderBy: [{ position: "asc" as const }, { createdAt: "asc" as const }]
  }
};

type RuntimeView = "attempt" | "previous";

export async function getTestRuntime(
  user: CurrentUser,
  courseId: string,
  groupId: string,
  testActivityId: string,
  view: RuntimeView = "attempt"
) {
  const context = await resolveTestRuntimeContext(user, courseId, groupId, testActivityId);
  const attempts = await prisma.activityAttempt.findMany({
    where: {
      courseId,
      groupId,
      activityId: testActivityId,
      participantId: context.participant.id,
      pluginKey: CORE_TEST_RUNTIME_KEY,
      lifecycle: { not: "deleted" }
    },
    include: { testItemAttempts: true },
    orderBy: [{ attemptNumber: "desc" }]
  });
  const attempt = view === "previous"
    ? attempts.find((candidate) => candidate.lifecycle === "submitted" || candidate.lifecycle === "graded") ?? null
    : attempts.find((candidate) => candidate.lifecycle === "started") ?? null;
  const availability = await getActivityAttemptAvailability(user, { courseId, groupId, activityId: testActivityId });

  return buildTestRuntime(context, attempt, availability, attempts.some((candidate) =>
    candidate.lifecycle === "submitted" || candidate.lifecycle === "graded"
  ));
}

export async function startOrResumeTestAttempt(
  user: CurrentUser,
  courseId: string,
  groupId: string,
  testActivityId: string
) {
  const context = await resolveTestRuntimeContext(user, courseId, groupId, testActivityId);
  assertCompositeItemsSupported(context.test.items);
  const existing = await prisma.activityAttempt.findFirst({
    where: {
      courseId,
      groupId,
      activityId: testActivityId,
      participantId: context.participant.id,
      pluginKey: CORE_TEST_RUNTIME_KEY,
      lifecycle: "started"
    },
    orderBy: [{ attemptNumber: "desc" }]
  });
  if (!existing) {
    const manifestItems = orderManifestItems(context.test.items, asRecord(context.test.settings).randomizeItems === true);
    const manifest = {
      testId: context.test.id,
      settings: context.test.settings,
      items: manifestItems.map((item) => ({
        testItemId: item.id,
        activityId: item.activityId,
        activityTypeKey: item.activity.activityType.key,
        title: item.activity.title,
        position: item.position,
        pointsPossible: item.pointsPossible,
        isRequired: item.isRequired,
        activityConfigFingerprint: fingerprint(item.activity.config)
      }))
    };
    await startActivityAttempt(user, {
      courseId,
      groupId,
      activityId: testActivityId,
      pluginKey: CORE_TEST_RUNTIME_KEY,
      pluginVersion: CORE_TEST_RUNTIME_VERSION,
      activityConfigFingerprint: fingerprint(manifest),
      metadata: { runtimeHandlerKey: CORE_TEST_RUNTIME_KEY, manifest } as Prisma.InputJsonValue
    });
  }
  return getTestRuntime(user, courseId, groupId, testActivityId, "attempt");
}

export async function getTestItemExecutionContext(
  user: CurrentUser,
  courseId: string,
  groupId: string,
  testActivityId: string,
  parentAttemptId: string,
  testItemId: string,
  options: { allowCompletedParent?: boolean } = {}
) {
  const context = await resolveTestRuntimeContext(user, courseId, groupId, testActivityId);
  const parentAttempt = await findParentAttempt(
    context.participant.id,
    testActivityId,
    parentAttemptId,
    options.allowCompletedParent === true
  );
  const item = context.test.items.find((candidate) => candidate.id === testItemId);
  if (!item || !manifestItemIds(parentAttempt.metadata).has(item.id)) {
    throw notFound("Test item");
  }
  const definition = getActivityDefinition(item.activity.activityType.key);
  if (!definition?.grading?.supportsCompositeExecution) {
    throw new AppError(409, "TEST_ITEM_COMPOSITE_UNSUPPORTED", `${item.activity.title} does not support Test execution yet.`);
  }
  const itemAttempt = await prisma.testItemAttempt.findUnique({
    where: { parentAttemptId_testItemId: { parentAttemptId, testItemId } }
  });
  return { ...context, parentAttempt, item, itemAttempt };
}

export async function saveTestItemAttemptState(
  user: CurrentUser,
  courseId: string,
  groupId: string,
  testActivityId: string,
  parentAttemptId: string,
  testItemId: string,
  state: Record<string, unknown>
) {
  const context = await getTestItemExecutionContext(user, courseId, groupId, testActivityId, parentAttemptId, testItemId);
  if (context.itemAttempt && context.itemAttempt.lifecycle !== "started") {
    throw new AppError(409, "TEST_ITEM_ALREADY_SUBMITTED", "This Test item has already been submitted.");
  }
  return prisma.testItemAttempt.upsert({
    where: { parentAttemptId_testItemId: { parentAttemptId, testItemId } },
    update: { result: { state } as Prisma.InputJsonValue },
    create: {
      parentAttemptId,
      testItemId,
      activityId: context.item.activityId,
      lifecycle: "started",
      result: { state } as Prisma.InputJsonValue,
      activityConfigFingerprint: fingerprint(context.item.activity.config)
    }
  });
}

export async function submitTestItemAttemptResult(
  user: CurrentUser,
  courseId: string,
  groupId: string,
  testActivityId: string,
  parentAttemptId: string,
  testItemId: string,
  input: {
    state: Record<string, unknown>;
    gradingResult: ActivityGradingResult;
    pluginAttemptRef?: string | null;
    now?: Date;
  }
) {
  const context = await getTestItemExecutionContext(user, courseId, groupId, testActivityId, parentAttemptId, testItemId);
  if (context.itemAttempt && context.itemAttempt.lifecycle !== "started") {
    throw new AppError(409, "TEST_ITEM_ALREADY_SUBMITTED", "This Test item has already been submitted.");
  }
  if (!Number.isFinite(input.gradingResult.rawMaxScore) || input.gradingResult.rawMaxScore <= 0) {
    throw new AppError(422, "TEST_ITEM_GRADING_RESULT_INVALID", "The activity returned an invalid maximum score.");
  }
  const now = input.now ?? new Date();
  const normalizedScore = (input.gradingResult.rawScore / input.gradingResult.rawMaxScore) * context.item.pointsPossible;
  return prisma.testItemAttempt.upsert({
    where: { parentAttemptId_testItemId: { parentAttemptId, testItemId } },
    update: {
      lifecycle: "graded",
      rawScore: input.gradingResult.rawScore,
      rawMaxScore: input.gradingResult.rawMaxScore,
      normalizedScore,
      normalizedMaxScore: context.item.pointsPossible,
      pluginAttemptRef: input.pluginAttemptRef,
      result: {
        state: input.state,
        analyticsPayload: input.gradingResult.analyticsPayload ?? {},
        metadata: input.gradingResult.metadata ?? {}
      } as Prisma.InputJsonValue,
      feedback: (input.gradingResult.feedback ?? {}) as Prisma.InputJsonValue,
      submittedAt: now,
      gradedAt: now
    },
    create: {
      parentAttemptId,
      testItemId,
      activityId: context.item.activityId,
      lifecycle: "graded",
      rawScore: input.gradingResult.rawScore,
      rawMaxScore: input.gradingResult.rawMaxScore,
      normalizedScore,
      normalizedMaxScore: context.item.pointsPossible,
      pluginAttemptRef: input.pluginAttemptRef,
      result: {
        state: input.state,
        analyticsPayload: input.gradingResult.analyticsPayload ?? {},
        metadata: input.gradingResult.metadata ?? {}
      } as Prisma.InputJsonValue,
      feedback: (input.gradingResult.feedback ?? {}) as Prisma.InputJsonValue,
      activityConfigFingerprint: fingerprint(context.item.activity.config),
      submittedAt: now,
      gradedAt: now
    }
  });
}

export async function submitTestAttempt(
  user: CurrentUser,
  courseId: string,
  groupId: string,
  testActivityId: string,
  parentAttemptId: string
) {
  const context = await resolveTestRuntimeContext(user, courseId, groupId, testActivityId);
  const parentAttempt = await prisma.activityAttempt.findFirst({
    where: {
      id: parentAttemptId,
      activityId: testActivityId,
      participantId: context.participant.id,
      pluginKey: CORE_TEST_RUNTIME_KEY,
      lifecycle: "started"
    },
    include: { testItemAttempts: true }
  });
  if (!parentAttempt) {
    throw notFound("Active Test attempt");
  }
  const completedIds = new Set(
    parentAttempt.testItemAttempts
      .filter((attempt) => attempt.lifecycle === "submitted" || attempt.lifecycle === "graded")
      .map((attempt) => attempt.testItemId)
  );
  const requiredManifestItems = manifestItems(parentAttempt.metadata).filter((item) => item.isRequired !== false);
  const missingRequiredItemIds = requiredManifestItems.map((item) => item.testItemId).filter((id) => !completedIds.has(id));
  if (missingRequiredItemIds.length) {
    throw new AppError(409, "TEST_REQUIRED_ITEMS_INCOMPLETE", "Complete all required Test activities before submitting.", {
      missingRequiredItemIds
    });
  }
  await submitActivityAttempt(user, {
    attemptId: parentAttempt.id,
    pluginAttemptRef: parentAttempt.id,
    metadata: {
      ...asRecord(parentAttempt.metadata),
      submittedItemIds: [...completedIds]
    } as Prisma.InputJsonValue
  });
  return getTestRuntime(user, courseId, groupId, testActivityId, "previous");
}

async function resolveTestRuntimeContext(user: CurrentUser, courseId: string, groupId: string, testActivityId: string) {
  const assignedActivity = await getGroupAssignedActivity(user, courseId, groupId, testActivityId);
  if (assignedActivity.activityType.key !== "test") {
    throw new AppError(400, "TEST_ACTIVITY_REQUIRED", "This assigned activity is not a Test.");
  }
  const participant = await prisma.courseGroupParticipant.findFirst({
    where: { groupId, userId: user.id, role: "student" }
  });
  if (!participant) {
    throw forbidden();
  }
  const test = await prisma.test.findFirst({
    where: { courseId, activityId: testActivityId },
    include: runtimeTestInclude
  });
  if (!test) {
    throw notFound("Test");
  }
  return { assignedActivity, participant, test };
}

async function findParentAttempt(
  participantId: string,
  testActivityId: string,
  parentAttemptId: string,
  allowCompletedParent: boolean
) {
  const attempt = await prisma.activityAttempt.findFirst({
    where: {
      id: parentAttemptId,
      activityId: testActivityId,
      participantId,
      pluginKey: CORE_TEST_RUNTIME_KEY,
      lifecycle: allowCompletedParent ? { in: ["started", "submitted", "graded"] } : "started"
    }
  });
  if (!attempt) {
    throw notFound(allowCompletedParent ? "Test attempt" : "Active Test attempt");
  }
  return attempt;
}

function buildTestRuntime(
  context: Awaited<ReturnType<typeof resolveTestRuntimeContext>>,
  attempt: Awaited<ReturnType<typeof prisma.activityAttempt.findFirst>> & { testItemAttempts?: Array<Record<string, unknown>> } | null,
  availability: Awaited<ReturnType<typeof getActivityAttemptAvailability>>,
  hasPreviousSubmissions: boolean
) {
  const itemAttempts = new Map((attempt?.testItemAttempts ?? []).map((itemAttempt) => [String(itemAttempt.testItemId), itemAttempt]));
  const itemOrder = attempt ? manifestItems(attempt.metadata).map((item) => item.testItemId) : context.test.items.map((item) => item.id);
  const itemById = new Map(context.test.items.map((item) => [item.id, item]));
  const items = itemOrder.flatMap((itemId) => {
    const item = itemById.get(itemId);
    if (!item) return [];
    const itemAttempt = itemAttempts.get(itemId);
    return [{
      ...item,
      itemAttempt: itemAttempt ? {
        id: String(itemAttempt.id),
        lifecycle: String(itemAttempt.lifecycle),
        rawScore: numberOrNull(itemAttempt.rawScore),
        rawMaxScore: numberOrNull(itemAttempt.rawMaxScore),
        normalizedScore: numberOrNull(itemAttempt.normalizedScore),
        normalizedMaxScore: numberOrNull(itemAttempt.normalizedMaxScore),
        state: asRecord(asRecord(itemAttempt.result).state),
        submittedAt: itemAttempt.submittedAt ?? null,
        gradedAt: itemAttempt.gradedAt ?? null
      } : null
    }];
  });
  return {
    test: {
      id: context.test.id,
      activity: context.test.activity,
      settings: context.test.settings,
      items
    },
    attempt: attempt ? {
      id: attempt.id,
      attemptNumber: attempt.attemptNumber,
      lifecycle: attempt.lifecycle,
      startedAt: attempt.startedAt,
      submittedAt: attempt.submittedAt,
      gradedAt: attempt.gradedAt
    } : null,
    availability,
    hasPreviousSubmissions
  };
}

function assertCompositeItemsSupported(items: Array<{ activity: { title: string; activityType: { key: string } } }>) {
  if (!items.length) {
    throw new AppError(409, "TEST_ITEMS_REQUIRED", "Add at least one activity before starting this Test.");
  }
  const unsupported = items.filter((item) => !getActivityDefinition(item.activity.activityType.key)?.grading?.supportsCompositeExecution);
  if (unsupported.length) {
    throw new AppError(409, "TEST_ITEM_COMPOSITE_UNSUPPORTED", "Some Test activities do not support student execution yet.", {
      activityTitles: unsupported.map((item) => item.activity.title)
    });
  }
}

function orderManifestItems<T>(items: T[], randomize: boolean) {
  if (!randomize) return [...items];
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}

function fingerprint(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value ?? null)).digest("hex");
}

function manifestItems(metadata: unknown) {
  const manifest = asRecord(asRecord(metadata).manifest);
  const items = Array.isArray(manifest.items) ? manifest.items : [];
  return items.flatMap((value) => {
    const item = asRecord(value);
    return typeof item.testItemId === "string" ? [{
      testItemId: item.testItemId,
      isRequired: item.isRequired !== false
    }] : [];
  });
}

function manifestItemIds(metadata: unknown) {
  return new Set(manifestItems(metadata).map((item) => item.testItemId));
}

function asRecord(value: unknown): Record<string, any> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, any> : {};
}

function numberOrNull(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
