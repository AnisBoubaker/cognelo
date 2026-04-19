import { Prisma, type PluginParsonsAttempt, type PluginParsonsAttemptEvent, prisma } from "@cognara/db";
import {
  createInitialParsonsAttemptState,
  getParsonsConfigFingerprint,
  parsonsAttemptEnsureInputSchema,
  parsonsAttemptStateSchema,
  parsonsAttemptUpdateInputSchema,
  type ParsonsAttemptEvaluation,
  type ParsonsAttemptState,
  type ParsonsAttemptUpdateInput
} from "./attempt-types";
import { defaultParsonsConfig, type ParsonsConfig } from "./parsons";

export type ParsonsAttemptRecord = {
  id: string;
  activityId: string;
  userId: string;
  status: "in_progress" | "completed" | "abandoned";
  startedAt: string;
  lastInteractionAt: string;
  completedAt: string | null;
  checkCount: number;
  resetCount: number;
  moveCount: number;
  indentCount: number;
  latestState: ParsonsAttemptState;
  resultSummary: Record<string, unknown>;
};

export async function ensureParsonsAttempt(params: {
  activityId: string;
  userId: string;
  config: ParsonsConfig;
  forceNew?: boolean;
}) {
  const { activityId, userId, config } = params;
  const input = parsonsAttemptEnsureInputSchema.parse({ forceNew: params.forceNew });
  const fingerprint = getParsonsConfigFingerprint(config);

  if (input.forceNew) {
    await prisma.pluginParsonsAttempt.updateMany({
      where: { activityId, userId, status: "in_progress" },
      data: {
        status: "abandoned",
        completedAt: new Date(),
        lastInteractionAt: new Date()
      }
    });
  }

  const existing = input.forceNew
    ? null
    : await prisma.pluginParsonsAttempt.findFirst({
        where: { activityId, userId, status: "in_progress" },
        orderBy: [{ updatedAt: "desc" }]
      });

  if (existing) {
    const state = normalizeAttemptState(existing.latestState, config);
    if (state.configFingerprint === fingerprint) {
      return toParsonsAttemptRecord(existing, state);
    }

    await prisma.pluginParsonsAttempt.update({
      where: { id: existing.id },
      data: {
        status: "abandoned",
        completedAt: new Date(),
        lastInteractionAt: new Date(),
        resultSummary: {
          ...(normalizeResultSummary(existing.resultSummary) as Prisma.InputJsonObject),
          supersededByConfigChange: true,
          configFingerprint: state.configFingerprint
        }
      }
    });
  }

  const initialState = createInitialParsonsAttemptState(config);
  const attempt = await prisma.pluginParsonsAttempt.create({
    data: {
      activityId,
      userId,
      latestState: initialState as Prisma.InputJsonValue,
      resultSummary: {
        configFingerprint: fingerprint,
        latestCorrect: false
      } as Prisma.InputJsonValue,
      lastInteractionAt: new Date()
    }
  });

  return toParsonsAttemptRecord(attempt, initialState);
}

export async function updateParsonsAttempt(params: {
  activityId: string;
  userId: string;
  config: ParsonsConfig;
  input: ParsonsAttemptUpdateInput;
}) {
  const { activityId, userId, config } = params;
  const input = parsonsAttemptUpdateInputSchema.parse(params.input);
  const attempt = await prisma.pluginParsonsAttempt.findFirst({
    where: { id: input.attemptId, activityId, userId }
  });

  if (!attempt) {
    return null;
  }

  const currentState = normalizeAttemptState(attempt.latestState, config);
  const nextState = input.state ? parsonsAttemptStateSchema.parse(input.state) : currentState;
  const expectedFingerprint = getParsonsConfigFingerprint(config);
  if (nextState.configFingerprint !== expectedFingerprint) {
    return null;
  }

  const now = new Date();
  const currentSummary = normalizeResultSummary(attempt.resultSummary);
  const nextStatus = input.abandon ? "abandoned" : input.complete ? "completed" : attempt.status;
  const nextSummary = {
    ...currentSummary,
    configFingerprint: expectedFingerprint,
    latestCorrect: input.result?.isCorrect ?? currentSummary.latestCorrect ?? false,
    latestResult: input.result ?? currentSummary.latestResult ?? null,
    lastEventType: input.event?.type ?? currentSummary.lastEventType ?? null,
    updatedAt: now.toISOString()
  };

  const updatedAttempt = await prisma.$transaction(async (transaction) => {
    const result = await transaction.pluginParsonsAttempt.update({
      where: { id: attempt.id },
      data: {
        latestState: nextState as Prisma.InputJsonValue,
        resultSummary: nextSummary as Prisma.InputJsonValue,
        lastInteractionAt: now,
        status: nextStatus,
        completedAt: nextStatus === "completed" || nextStatus === "abandoned" ? now : attempt.completedAt,
        checkCount: input.event?.type === "check" ? { increment: 1 } : undefined,
        resetCount: input.event?.type === "reset" ? { increment: 1 } : undefined,
        moveCount: input.event?.type === "move" ? { increment: 1 } : undefined,
        indentCount: input.event?.type === "indent" ? { increment: 1 } : undefined
      }
    });

    if (input.event) {
      await transaction.pluginParsonsAttemptEvent.create({
        data: {
          attemptId: attempt.id,
          type: input.event.type,
          payload: input.event.payload as Prisma.InputJsonValue
        }
      });
    }

    return result;
  });

  return toParsonsAttemptRecord(updatedAttempt, nextState);
}

export async function listRecentParsonsAttemptSignals(params: { activityId: string; userId?: string; limit?: number }) {
  const attempts = await prisma.pluginParsonsAttempt.findMany({
    where: {
      activityId: params.activityId,
      ...(params.userId ? { userId: params.userId } : {})
    },
    orderBy: [{ lastInteractionAt: "desc" }],
    take: params.limit ?? 20,
    include: {
      events: {
        orderBy: [{ createdAt: "desc" }],
        take: 5
      }
    }
  });

  return attempts.map((attempt) => ({
    ...toParsonsAttemptRecord(attempt, normalizeAttemptState(attempt.latestState, defaultParsonsConfig())),
    recentEvents: attempt.events.map((event) => toParsonsAttemptEventRecord(event))
  }));
}

function normalizeAttemptState(value: unknown, config: ParsonsConfig): ParsonsAttemptState {
  const parsed = parsonsAttemptStateSchema.safeParse(value);
  if (parsed.success) {
    return parsed.data;
  }
  return createInitialParsonsAttemptState(config);
}

function normalizeResultSummary(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function toParsonsAttemptRecord(attempt: PluginParsonsAttempt, latestState: ParsonsAttemptState): ParsonsAttemptRecord {
  return {
    id: attempt.id,
    activityId: attempt.activityId,
    userId: attempt.userId,
    status: attempt.status,
    startedAt: attempt.startedAt.toISOString(),
    lastInteractionAt: attempt.lastInteractionAt.toISOString(),
    completedAt: attempt.completedAt?.toISOString() ?? null,
    checkCount: attempt.checkCount,
    resetCount: attempt.resetCount,
    moveCount: attempt.moveCount,
    indentCount: attempt.indentCount,
    latestState,
    resultSummary: normalizeResultSummary(attempt.resultSummary)
  };
}

function toParsonsAttemptEventRecord(event: PluginParsonsAttemptEvent) {
  return {
    id: event.id,
    type: event.type,
    createdAt: event.createdAt.toISOString(),
    payload: normalizeResultSummary(event.payload)
  };
}
