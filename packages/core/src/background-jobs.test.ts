import { beforeEach, describe, expect, it, vi } from "vitest";

const mockPrisma = vi.hoisted(() => ({
  $executeRawUnsafe: vi.fn(),
  $queryRawUnsafe: vi.fn(),
  $transaction: vi.fn()
}));

vi.mock("@cognelo/db", () => ({
  Prisma: {},
  prisma: mockPrisma
}));

const {
  NonRetryableBackgroundJobError,
  enqueueBackgroundJob,
  getBackgroundJob,
  registerBackgroundJobHandler,
  runBackgroundJobOnce
} = await import("./background-jobs");

describe("background job service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.$transaction.mockImplementation((handler: (transaction: { $queryRawUnsafe: (query: string, ...params: unknown[]) => unknown }) => unknown) =>
      handler({ $queryRawUnsafe: mockPrisma.$queryRawUnsafe })
    );
  });

  it("enqueues jobs with durable idempotency keys", async () => {
    const row = jobRow({
      id: "job-enqueue-1",
      idempotencyKey: "submission-1",
      payload: { submissionId: "submission-1" },
      queue: "coding-homework-grader"
    });
    mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([row]);

    await expect(
      enqueueBackgroundJob({
        handlerKey: "coding-homework-grader.process-submission",
        id: "job-enqueue-1",
        idempotencyKey: "submission-1",
        payload: { submissionId: "submission-1" },
        queue: "coding-homework-grader"
      })
    ).resolves.toMatchObject({
      id: "job-enqueue-1",
      idempotencyKey: "submission-1",
      payload: { submissionId: "submission-1" },
      queue: "coding-homework-grader",
      status: "queued"
    });
    expect(mockPrisma.$queryRawUnsafe).toHaveBeenCalledWith(expect.stringContaining("ON CONFLICT"), expect.any(String), expect.any(String), expect.any(String), expect.any(Number), expect.any(String), expect.any(String), "submission-1", expect.any(Number), expect.any(Date), expect.any(Date));
  });

  it("runs a registered handler and marks the job succeeded", async () => {
    const unregister = registerBackgroundJobHandler("test.success", async ({ job }) => ({ handled: job.id }));
    mockPrisma.$queryRawUnsafe
      .mockResolvedValueOnce([jobRow({ attempts: 1, handlerKey: "test.success", id: "job-success", status: "running" })])
      .mockResolvedValueOnce([jobRow({ attempts: 1, handlerKey: "test.success", id: "job-success", result: { handled: "job-success" }, status: "succeeded" })]);

    await expect(runBackgroundJobOnce({ queue: "default", workerId: "worker-1" })).resolves.toMatchObject({
      id: "job-success",
      result: { handled: "job-success" },
      status: "succeeded"
    });
    expect(mockPrisma.$executeRawUnsafe).toHaveBeenCalledWith(expect.stringContaining('"status" = \'succeeded\''), "job-success", JSON.stringify({ handled: "job-success" }), expect.any(Date));
    unregister();
  });

  it("requeues retryable handler failures until attempts are exhausted", async () => {
    const unregister = registerBackgroundJobHandler("test.retry", async () => {
      throw new Error("Temporary outage");
    });
    mockPrisma.$queryRawUnsafe
      .mockResolvedValueOnce([jobRow({ attempts: 1, handlerKey: "test.retry", id: "job-retry", maxAttempts: 3, status: "running" })])
      .mockResolvedValueOnce([
        jobRow({
          attempts: 1,
          error: { code: "BACKGROUND_JOB_FAILED", message: "Temporary outage", retryable: true },
          handlerKey: "test.retry",
          id: "job-retry",
          maxAttempts: 3,
          status: "queued"
        })
      ]);

    await expect(runBackgroundJobOnce({ workerId: "worker-1" })).resolves.toMatchObject({
      error: { code: "BACKGROUND_JOB_FAILED", message: "Temporary outage", retryable: true },
      status: "queued"
    });
    expect(mockPrisma.$executeRawUnsafe).toHaveBeenCalledWith(expect.stringContaining('$2::"BackgroundJobStatus"'), "job-retry", "queued", expect.any(String), expect.any(Date), expect.any(Date));
    unregister();
  });

  it("marks non-retryable failures as failed", async () => {
    const unregister = registerBackgroundJobHandler("test.non-retryable", async () => {
      throw new NonRetryableBackgroundJobError("Bad request", "BAD_REQUEST");
    });
    mockPrisma.$queryRawUnsafe
      .mockResolvedValueOnce([jobRow({ attempts: 1, handlerKey: "test.non-retryable", id: "job-failed", maxAttempts: 3, status: "running" })])
      .mockResolvedValueOnce([
        jobRow({
          attempts: 1,
          error: { code: "BAD_REQUEST", message: "Bad request", retryable: false },
          handlerKey: "test.non-retryable",
          id: "job-failed",
          maxAttempts: 3,
          status: "failed"
        })
      ]);

    await expect(runBackgroundJobOnce({ workerId: "worker-1" })).resolves.toMatchObject({
      error: { code: "BAD_REQUEST", retryable: false },
      status: "failed"
    });
    expect(mockPrisma.$executeRawUnsafe).toHaveBeenCalledWith(expect.stringContaining('$2::"BackgroundJobStatus"'), "job-failed", "failed", expect.any(String), expect.any(Date), expect.any(Date));
    unregister();
  });

  it("reads a job by id", async () => {
    mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([jobRow({ id: "job-read" })]);

    await expect(getBackgroundJob("job-read")).resolves.toMatchObject({ id: "job-read" });
    expect(mockPrisma.$queryRawUnsafe).toHaveBeenCalledWith(expect.stringContaining('WHERE "id" = $1'), "job-read");
  });
});

function jobRow(overrides: Partial<Record<string, unknown>> = {}) {
  const now = new Date("2026-06-18T20:00:00.000Z");
  return {
    attempts: 0,
    completedAt: null,
    createdAt: now,
    error: null,
    failedAt: null,
    handlerKey: "test.handler",
    id: "job-1",
    idempotencyKey: null,
    lockedAt: null,
    lockedBy: null,
    maxAttempts: 3,
    metadata: {},
    payload: {},
    priority: 0,
    queue: "default",
    result: null,
    runAfter: now,
    status: "queued",
    updatedAt: now,
    ...overrides
  };
}
