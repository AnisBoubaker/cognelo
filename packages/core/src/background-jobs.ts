import { randomUUID } from "node:crypto";
import { z } from "zod";
import { Prisma, prisma } from "@cognelo/db";

export type BackgroundJobStatus = "queued" | "running" | "succeeded" | "failed" | "cancelled";

export type BackgroundJobRecord = {
  id: string;
  queue: string;
  handlerKey: string;
  status: BackgroundJobStatus;
  priority: number;
  payload: Record<string, unknown>;
  result: Record<string, unknown> | null;
  error: Record<string, unknown> | null;
  metadata: Record<string, unknown>;
  idempotencyKey: string | null;
  attempts: number;
  maxAttempts: number;
  runAfter: Date;
  lockedAt: Date | null;
  lockedBy: string | null;
  completedAt: Date | null;
  failedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type BackgroundJobHandler = (input: { job: BackgroundJobRecord }) => Promise<Record<string, unknown> | void>;

export class NonRetryableBackgroundJobError extends Error {
  readonly code: string;

  constructor(message: string, code = "BACKGROUND_JOB_NON_RETRYABLE") {
    super(message);
    this.name = "NonRetryableBackgroundJobError";
    this.code = code;
  }
}

const enqueueSchema = z.object({
  handlerKey: z.string().trim().min(2).max(160),
  id: z.string().trim().min(8).max(160).optional(),
  idempotencyKey: z.string().trim().min(4).max(240).optional(),
  maxAttempts: z.number().int().min(1).max(25).optional(),
  metadata: z.record(z.unknown()).optional(),
  payload: z.record(z.unknown()).optional(),
  priority: z.number().int().min(-1000).max(1000).optional(),
  queue: z.string().trim().min(1).max(120).optional(),
  runAfter: z.date().optional()
});

const handlers = new Map<string, BackgroundJobHandler>();
const workers = new Map<string, { stop: () => void }>();

export function registerBackgroundJobHandler(handlerKey: string, handler: BackgroundJobHandler) {
  const normalizedKey = handlerKey.trim();
  if (!normalizedKey) {
    throw new Error("Background job handler keys cannot be empty.");
  }
  if (handlers.has(normalizedKey)) {
    throw new Error(`Background job handler already registered: ${normalizedKey}`);
  }
  handlers.set(normalizedKey, handler);
  return () => {
    if (handlers.get(normalizedKey) === handler) {
      handlers.delete(normalizedKey);
    }
  };
}

export function isBackgroundJobHandlerRegistered(handlerKey: string) {
  return handlers.has(handlerKey.trim());
}

export async function enqueueBackgroundJob(input: z.input<typeof enqueueSchema>) {
  const data = enqueueSchema.parse(input);
  const now = new Date();
  const id = data.id ?? randomUUID();
  const queue = data.queue ?? "default";
  const runAfter = data.runAfter ?? now;
  const payload = data.payload ?? {};
  const metadata = data.metadata ?? {};
  const maxAttempts = data.maxAttempts ?? 3;
  const priority = data.priority ?? 0;

  const rows = data.idempotencyKey
    ? await prisma.$queryRawUnsafe<BackgroundJobRow[]>(
        `INSERT INTO "BackgroundJob"
          ("id", "queue", "handlerKey", "status", "priority", "payload", "metadata", "idempotencyKey", "attempts", "maxAttempts", "runAfter", "createdAt", "updatedAt")
         VALUES
          ($1, $2, $3, 'queued', $4, $5::jsonb, $6::jsonb, $7, 0, $8, $9, $10, $10)
         ON CONFLICT ("queue", "idempotencyKey") DO UPDATE SET "updatedAt" = "BackgroundJob"."updatedAt"
         RETURNING *`,
        id,
        queue,
        data.handlerKey,
        priority,
        JSON.stringify(payload),
        JSON.stringify(metadata),
        data.idempotencyKey,
        maxAttempts,
        runAfter,
        now
      )
    : await prisma.$queryRawUnsafe<BackgroundJobRow[]>(
        `INSERT INTO "BackgroundJob"
          ("id", "queue", "handlerKey", "status", "priority", "payload", "metadata", "idempotencyKey", "attempts", "maxAttempts", "runAfter", "createdAt", "updatedAt")
         VALUES
          ($1, $2, $3, 'queued', $4, $5::jsonb, $6::jsonb, NULL, 0, $7, $8, $9, $9)
         RETURNING *`,
        id,
        queue,
        data.handlerKey,
        priority,
        JSON.stringify(payload),
        JSON.stringify(metadata),
        maxAttempts,
        runAfter,
        now
      );

  return toBackgroundJobRecord(rows[0]);
}

export async function getBackgroundJob(jobId: string) {
  const rows = await prisma.$queryRawUnsafe<BackgroundJobRow[]>(`SELECT * FROM "BackgroundJob" WHERE "id" = $1 LIMIT 1`, jobId);
  return rows[0] ? toBackgroundJobRecord(rows[0]) : null;
}

export async function runBackgroundJobOnce(options: { queue?: string; workerId?: string } = {}) {
  const workerId = options.workerId ?? `worker-${randomUUID()}`;
  const job = await claimBackgroundJob({ queue: options.queue, workerId });
  if (!job) {
    return null;
  }

  const handler = handlers.get(job.handlerKey);
  if (!handler) {
    await failBackgroundJob(job, {
      error: {
        code: "BACKGROUND_JOB_HANDLER_NOT_REGISTERED",
        message: `No handler is registered for ${job.handlerKey}.`,
        retryable: false
      },
      retryable: false
    });
    return getBackgroundJob(job.id);
  }

  try {
    const result = (await handler({ job })) ?? {};
    await prisma.$executeRawUnsafe(
      `UPDATE "BackgroundJob"
       SET "status" = 'succeeded',
           "result" = $2::jsonb,
           "error" = NULL,
           "lockedAt" = NULL,
           "lockedBy" = NULL,
           "completedAt" = $3,
           "failedAt" = NULL,
           "updatedAt" = $3
       WHERE "id" = $1`,
      job.id,
      JSON.stringify(result),
      new Date()
    );
  } catch (error) {
    await failBackgroundJob(job, normalizeJobError(error));
  }

  return getBackgroundJob(job.id);
}

export function startBackgroundJobWorker(options: { concurrency?: number; intervalMs?: number; queue?: string; workerId?: string } = {}) {
  const queueKey = options.queue ?? "all";
  const workerId = options.workerId ?? `worker-${randomUUID()}`;
  const key = `${queueKey}:${workerId}`;
  const existing = workers.get(key);
  if (existing) {
    return existing;
  }

  const concurrency = Math.max(1, Math.min(options.concurrency ?? 1, 10));
  const intervalMs = Math.max(250, options.intervalMs ?? 1000);
  let stopped = false;
  let running = false;

  const tick = async () => {
    if (stopped || running) {
      return;
    }
    running = true;
    try {
      await Promise.all(Array.from({ length: concurrency }, () => runBackgroundJobOnce({ queue: options.queue, workerId })));
    } finally {
      running = false;
    }
  };

  const interval = setInterval(() => {
    void tick();
  }, intervalMs);
  void tick();

  const worker = {
    stop: () => {
      stopped = true;
      clearInterval(interval);
      workers.delete(key);
    }
  };
  workers.set(key, worker);
  return worker;
}

export function startDefaultBackgroundJobWorker() {
  if (process.env.COGNELO_BACKGROUND_JOBS_DISABLED === "true") {
    return { stop: () => undefined };
  }
  return startBackgroundJobWorker({
    concurrency: readIntegerEnv("COGNELO_BACKGROUND_JOBS_CONCURRENCY", 1),
    intervalMs: readIntegerEnv("COGNELO_BACKGROUND_JOBS_INTERVAL_MS", 1000),
    workerId: process.env.COGNELO_BACKGROUND_JOBS_WORKER_ID ?? "api-worker"
  });
}

async function claimBackgroundJob(options: { queue?: string; workerId: string }) {
  const rows = await prisma.$transaction((transaction) =>
    transaction.$queryRawUnsafe<BackgroundJobRow[]>(
      `WITH next_job AS (
         SELECT "id"
         FROM "BackgroundJob"
         WHERE "status" = 'queued'
           AND "runAfter" <= CURRENT_TIMESTAMP
           AND ($2::text IS NULL OR "queue" = $2)
         ORDER BY "priority" DESC, "runAfter" ASC, "createdAt" ASC
         FOR UPDATE SKIP LOCKED
         LIMIT 1
       )
       UPDATE "BackgroundJob"
       SET "status" = 'running',
           "attempts" = "attempts" + 1,
           "lockedAt" = CURRENT_TIMESTAMP,
           "lockedBy" = $1,
           "updatedAt" = CURRENT_TIMESTAMP
       WHERE "id" IN (SELECT "id" FROM next_job)
       RETURNING *`,
      options.workerId,
      options.queue ?? null
    )
  );
  return rows[0] ? toBackgroundJobRecord(rows[0]) : null;
}

async function failBackgroundJob(
  job: BackgroundJobRecord,
  failure: { error: Record<string, unknown>; retryable: boolean; runAfter?: Date }
) {
  const exhausted = job.attempts >= job.maxAttempts;
  const status: BackgroundJobStatus = failure.retryable && !exhausted ? "queued" : "failed";
  const now = new Date();
  const runAfter = failure.runAfter ?? new Date(now.getTime() + retryDelayMs(job.attempts));

  await prisma.$executeRawUnsafe(
    `UPDATE "BackgroundJob"
     SET "status" = $2::"BackgroundJobStatus",
         "error" = $3::jsonb,
         "runAfter" = $4,
         "lockedAt" = NULL,
         "lockedBy" = NULL,
         "failedAt" = CASE WHEN $2::"BackgroundJobStatus" = 'failed' THEN $5 ELSE NULL END,
         "updatedAt" = $5
     WHERE "id" = $1`,
    job.id,
    status,
    JSON.stringify(failure.error),
    status === "queued" ? runAfter : job.runAfter,
    now
  );
}

function normalizeJobError(error: unknown) {
  const retryable = !(error instanceof NonRetryableBackgroundJobError);
  return {
    error: {
      code: error instanceof NonRetryableBackgroundJobError ? error.code : "BACKGROUND_JOB_FAILED",
      message: error instanceof Error ? error.message : "Background job failed.",
      retryable
    },
    retryable
  };
}

function retryDelayMs(attempts: number) {
  return Math.min(60_000, 1000 * 2 ** Math.max(0, attempts - 1));
}

function readIntegerEnv(key: string, fallback: number) {
  const value = Number.parseInt(process.env[key] ?? "", 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

type BackgroundJobRow = {
  id: string;
  queue: string;
  handlerKey: string;
  status: BackgroundJobStatus;
  priority: number;
  payload: Prisma.JsonValue | string;
  result: Prisma.JsonValue | string | null;
  error: Prisma.JsonValue | string | null;
  metadata: Prisma.JsonValue | string;
  idempotencyKey: string | null;
  attempts: number;
  maxAttempts: number;
  runAfter: Date;
  lockedAt: Date | null;
  lockedBy: string | null;
  completedAt: Date | null;
  failedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

function toBackgroundJobRecord(row: BackgroundJobRow | undefined): BackgroundJobRecord {
  if (!row) {
    throw new Error("Background job row is missing.");
  }
  return {
    id: row.id,
    queue: row.queue,
    handlerKey: row.handlerKey,
    status: row.status,
    priority: row.priority,
    payload: normalizeJsonObject(row.payload),
    result: row.result === null ? null : normalizeJsonObject(row.result),
    error: row.error === null ? null : normalizeJsonObject(row.error),
    metadata: normalizeJsonObject(row.metadata),
    idempotencyKey: row.idempotencyKey,
    attempts: row.attempts,
    maxAttempts: row.maxAttempts,
    runAfter: row.runAfter,
    lockedAt: row.lockedAt,
    lockedBy: row.lockedBy,
    completedAt: row.completedAt,
    failedAt: row.failedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}

function normalizeJsonObject(value: Prisma.JsonValue | string | null) {
  const parsed = typeof value === "string" ? JSON.parse(value) : value;
  return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
}
