import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  assertManage: vi.fn(),
  deleteActivity: vi.fn(),
  duplicateActivity: vi.fn(),
  duplicateTest: vi.fn(),
  findTest: vi.fn(),
  generationContext: vi.fn(),
  progress: vi.fn(),
  enqueue: vi.fn(),
  getActivity: vi.fn(),
  getTest: vi.fn(),
  isRegistered: vi.fn(),
  register: vi.fn(),
  resolveHandler: vi.fn(),
  runDeletedHooks: vi.fn(),
  startWorker: vi.fn()
}));

vi.mock("@cognelo/activity-sdk/server", () => ({
  resolveBankActivityVariationHandler: mocks.resolveHandler,
  runBankActivityDeletedHooks: mocks.runDeletedHooks,
  runBankActivityDuplicatedHooks: vi.fn()
}));
vi.mock("@cognelo/core", () => ({
  AppError: class AppError extends Error {
    constructor(public status: number, public code: string, message: string, public details?: unknown) { super(message); }
  },
  NonRetryableBackgroundJobError: class NonRetryableBackgroundJobError extends Error {},
  assertCanManageActivityBank: mocks.assertManage,
  deleteBankActivity: mocks.deleteActivity,
  duplicateBankActivity: mocks.duplicateActivity,
  duplicateBankTest: mocks.duplicateTest,
  enqueueBackgroundJob: mocks.enqueue,
  findBankTestByShellActivityId: mocks.findTest,
  getBackgroundJob: vi.fn(),
  getBankActivity: mocks.getActivity,
  getBankActivityVariationGenerationContext: mocks.generationContext,
  getBankTestByActivityId: mocks.getTest,
  isBackgroundJobHandlerRegistered: mocks.isRegistered,
  registerBackgroundJobHandler: mocks.register,
  startBackgroundJobWorker: mocks.startWorker,
  updateBackgroundJobMetadata: mocks.progress
}));

const { cleanupVariation, enqueueActivityVariation } = await import("./activity-variations");

describe("activity variation orchestration", () => {
  const user = { id: "teacher-1", email: "teacher@example.test", name: null, firstName: null, lastName: null, roles: ["teacher" as const] };

  beforeEach(() => {
    vi.resetAllMocks();
    mocks.assertManage.mockResolvedValue(undefined);
    mocks.isRegistered.mockReturnValue(false);
    mocks.register.mockReturnValue(() => undefined);
    mocks.resolveHandler.mockReturnValue(vi.fn());
    mocks.getActivity.mockResolvedValue({
      id: "activity-1",
      title: "Loops",
      activityType: { key: "mcq" },
      bankTestDefinition: null,
      bankTestItem: null
    });
    mocks.enqueue.mockResolvedValue(jobRow());
  });

  it("enqueues an owned single-activity variation with initial progress", async () => {
    const result = await enqueueActivityVariation(user, "bank-1", "activity-1", {
      title: "Loops (variation)",
      instructions: "Use arrays",
      locale: "en"
    });

    expect(result).toMatchObject({ id: "job-1", status: "queued", progress: { completed: 0, total: 1 } });
    expect(mocks.enqueue).toHaveBeenCalledWith(expect.objectContaining({
      handlerKey: "activity-banks.create-variation",
      maxAttempts: 1,
      metadata: expect.objectContaining({ activityBankId: "bank-1", bankActivityId: "activity-1", userId: "teacher-1" })
    }));
    expect(mocks.startWorker).toHaveBeenCalledWith(expect.objectContaining({ queue: "activity-variations" }));
  });

  it("rejects a Test before copying when any child lacks variation support", async () => {
    mocks.getActivity.mockResolvedValue({
      id: "test-1",
      title: "Midterm",
      activityType: { key: "test" },
      bankTestDefinition: { id: "definition-1" },
      bankTestItem: null
    });
    mocks.getTest.mockResolvedValue({
      items: [{ activity: { activityType: { key: "future-activity" } } }]
    });
    mocks.resolveHandler.mockReturnValue(null);

    await expect(enqueueActivityVariation(user, "bank-1", "test-1", {
      title: "Midterm (variation)",
      instructions: "",
      locale: "en"
    })).rejects.toMatchObject({ code: "ACTIVITY_VARIATION_UNSUPPORTED" });
    expect(mocks.enqueue).not.toHaveBeenCalled();
  });

  it("retries plugin-private cleanup before considering a failed variation removed", async () => {
    mocks.deleteActivity.mockResolvedValue({
      deletedActivities: [{ bankActivityId: "copy-1", activityTypeKey: "coding-exercise" }]
    });
    mocks.runDeletedHooks
      .mockRejectedValueOnce(new Error("temporary cleanup failure"))
      .mockRejectedValueOnce(new Error("temporary cleanup failure"))
      .mockResolvedValueOnce(undefined);

    await expect(cleanupVariation(user, "bank-1", "copy-1")).resolves.toBeUndefined();
    expect(mocks.runDeletedHooks).toHaveBeenCalledTimes(3);
  });

  it("surfaces plugin-private cleanup failure after three attempts", async () => {
    mocks.deleteActivity.mockResolvedValue({
      deletedActivities: [{ bankActivityId: "copy-1", activityTypeKey: "coding-exercise" }]
    });
    mocks.runDeletedHooks.mockRejectedValue(new Error("persistent cleanup failure"));

    await expect(cleanupVariation(user, "bank-1", "copy-1")).rejects.toThrow(
      "Plugin-private cleanup failed after three attempts"
    );
    expect(mocks.runDeletedHooks).toHaveBeenCalledTimes(3);
  });

  it.each([false, true])("completes a variation with review warnings and keeps all copies (compound: %s)", async (compound) => {
    const codingHandler = vi.fn().mockResolvedValue({ warnings: [{ code: "INCOMPLETE_TESTS", message: "Review missing test coverage and weights." }] });
    const otherHandler = vi.fn().mockResolvedValue(undefined);
    mocks.resolveHandler.mockImplementation((type: string) => type === "coding-exercise" ? codingHandler : otherHandler);
    mocks.findTest.mockResolvedValue(compound ? { id: "test-1" } : null);
    mocks.duplicateActivity.mockResolvedValue({ id: "copy-coding", activityType: { key: "coding-exercise" } });
    mocks.duplicateTest.mockResolvedValue({
      test: { bankActivityId: "copy-test" },
      activityCopies: [
        { sourceBankActivityId: "source-coding", bankActivity: { id: "copy-coding", activityType: { key: "coding-exercise" } } },
        { sourceBankActivityId: "source-other", bankActivity: { id: "copy-other", activityType: { key: "mcq" } } }
      ]
    });
    mocks.getActivity.mockImplementation(async (_user, _bank, id: string) => ({
      id, title: id === "copy-coding" ? "Generated programming exercise" : "Generated Test",
      description: "", config: {}, metadata: {}, lifecycle: "draft",
      activityType: { key: id.includes("coding") ? "coding-exercise" : "mcq", name: "Activity", description: "" }
    }));
    mocks.generationContext.mockResolvedValue({ locale: "en", subject: { title: "Programming", description: "" }, knowledge: { mode: "selected", concepts: [], selectedConcepts: [] } });

    const result = await runVariationJob(user);
    expect(result).toMatchObject({
      activityId: compound ? "copy-test" : "copy-coding",
      warnings: [{ activityId: "copy-coding", title: "Generated programming exercise", code: "INCOMPLETE_TESTS", message: "Review missing test coverage and weights." }]
    });
    expect(codingHandler).toHaveBeenCalledTimes(1);
    expect(otherHandler).toHaveBeenCalledTimes(compound ? 1 : 0);
    expect(mocks.deleteActivity).not.toHaveBeenCalled();
    expect(mocks.progress).toHaveBeenLastCalledWith("job-1", { progress: expect.objectContaining({ stage: "complete", completed: compound ? 2 : 1 }) });
  });

  it("still cleans up the whole Test if a later child has an unrelated fatal failure", async () => {
    mocks.findTest.mockResolvedValue({ id: "test-1" });
    mocks.duplicateTest.mockResolvedValue({
      test: { bankActivityId: "copy-test" },
      activityCopies: [
        { sourceBankActivityId: "source-coding", bankActivity: { id: "copy-coding", activityType: { key: "coding-exercise" } } },
        { sourceBankActivityId: "source-other", bankActivity: { id: "copy-other", activityType: { key: "mcq" } } }
      ]
    });
    mocks.resolveHandler.mockImplementation((type: string) => type === "coding-exercise"
      ? vi.fn().mockResolvedValue({ warnings: [{ code: "INCOMPLETE_TESTS", message: "Review tests." }] })
      : vi.fn().mockRejectedValue(new Error("Model connection unavailable.")));
    mocks.generationContext.mockResolvedValue({ locale: "en", subject: { title: "Programming", description: "" }, knowledge: { mode: "selected", concepts: [], selectedConcepts: [] } });
    mocks.deleteActivity.mockResolvedValue({ deletedActivities: [
      { bankActivityId: "copy-coding", activityTypeKey: "coding-exercise" }, { bankActivityId: "copy-other", activityTypeKey: "mcq" }
    ] });
    await expect(runVariationJob(user)).rejects.toThrow("Model connection unavailable.");
    expect(mocks.deleteActivity).toHaveBeenCalledWith(user, "bank-1", "copy-test", { force: true });
    expect(mocks.runDeletedHooks).toHaveBeenCalledTimes(2);
  });
});

async function runVariationJob(user: { id: string; email: string; roles: string[] }) {
  vi.resetModules();
  const { registerActivityVariationBackgroundJobs } = await import("./activity-variations");
  registerActivityVariationBackgroundJobs();
  const handler = mocks.register.mock.calls.at(-1)![1];
  return handler({ job: { ...jobRow(), payload: {
    activityBankId: "bank-1", bankActivityId: "source-coding", title: "New variation", instructions: "", locale: "en", user
  } } });
}

function jobRow() {
  const now = new Date("2026-09-29T12:00:00.000Z");
  return {
    id: "job-1",
    queue: "activity-variations",
    handlerKey: "activity-banks.create-variation",
    status: "queued" as const,
    priority: 0,
    payload: {},
    result: null,
    error: null,
    metadata: { progress: { completed: 0, fraction: 0, stage: "queued", step: "content", total: 1 } },
    idempotencyKey: null,
    attempts: 0,
    maxAttempts: 1,
    runAfter: now,
    lockedAt: null,
    lockedBy: null,
    completedAt: null,
    failedAt: null,
    createdAt: now,
    updatedAt: now
  };
}
