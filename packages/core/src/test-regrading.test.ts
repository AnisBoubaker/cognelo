import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CurrentUser, TestRegradeProgress } from "@cognelo/contracts";
import { AppError } from "./errors";

const mocks = vi.hoisted(() => ({
  authorize: vi.fn(), aggregate: vi.fn(), enabled: vi.fn(), submit: vi.fn(), regrade: vi.fn(), lock: vi.fn(),
  db: {
    $transaction: vi.fn(), $queryRaw: vi.fn(),
    activityAttempt: { findFirst: vi.fn(), findUniqueOrThrow: vi.fn() },
    testSubmissionClaim: { findUnique: vi.fn(), upsert: vi.fn(), updateMany: vi.fn() },
    testItemAttempt: { update: vi.fn() }, courseAuditEvent: { create: vi.fn() }
  }
}));
vi.mock("@cognelo/db", () => ({ prisma: mocks.db, Prisma: {} }));
vi.mock("@cognelo/activity-sdk/server", () => ({
  resolveCompositeExecutionSubmissionHandler: () => mocks.submit,
  resolveCompositeExecutionRegradingHandler: mocks.regrade
}));
vi.mock("./gradebook", () => ({ getActivityAttemptRegradeContext: mocks.authorize }));
vi.mock("./plugins", () => ({ assertActivityTypePluginEnabled: mocks.enabled }));
vi.mock("./activity-authoring-live", () => ({ lockTestAuthoring: mocks.lock }));
vi.mock("./test-execution", () => ({ recalculateTestAttemptGrade: mocks.aggregate }));
import { regradeTestAttempt } from "./test-regrading";

const user: CurrentUser = { id: "teacher", email: "teacher@example.test", name: null, firstName: null, lastName: null, roles: ["teacher"] };
function fixture(lifecycle = "graded") {
  const date = new Date("2026-10-14T18:00:00Z");
  return { id: "parent", activityId: "test", groupId: "section", lifecycle, updatedAt: date,
    user: { ...user, id: "learner" },
    metadata: { manifest: { items: [1, 2].map(n => ({ testItemId: `item-${n}`, pointsPossible: n * 10 })) } },
    testItemAttempts: [1, 2, 3].map(n => ({ id: `child-${n}`, testItemId: `item-${n}`, activityId: `activity-${n}`,
      lifecycle, updatedAt: date, submittedAt: date, rawScore: 0, rawMaxScore: 1, normalizedScore: 0, normalizedMaxScore: n * 10,
      feedback: { teacherComment: "Keep this comment" }, result: { state: { answers: { q: ["saved"] } }, configSnapshot: { key: "old" } },
      activity: { id: `activity-${n}`, title: `Exercise ${n}`, config: { key: "corrected" }, metadata: {}, activityType: { key: "mcq" } }
    })) };
}

describe("Test automatic regrading", () => {
  let parent: ReturnType<typeof fixture>;
  beforeEach(() => {
    vi.resetAllMocks(); parent = fixture();
    mocks.db.$transaction.mockImplementation(run => run(mocks.db));
    mocks.db.activityAttempt.findFirst.mockImplementation(args => Promise.resolve(args.select ? { activityId: "test" } : parent));
    mocks.db.activityAttempt.findUniqueOrThrow.mockImplementation(() => Promise.resolve(parent));
    mocks.db.testSubmissionClaim.findUnique.mockResolvedValue({ status: "completed" });
    mocks.db.testSubmissionClaim.updateMany.mockResolvedValue({ count: 1 });
    mocks.db.testItemAttempt.update.mockImplementation(({ where, data }) => Promise.resolve({ ...parent.testItemAttempts.find(i => i.id === where.id), ...data }));
    mocks.submit.mockImplementation(({ payload }) => Promise.resolve({ state: payload, gradingResult: { rawScore: 1, rawMaxScore: 1 } }));
    mocks.regrade.mockReturnValue(null);
    mocks.aggregate.mockResolvedValue({ grade: { id: "grade" } });
  });

  it("reruns every already-graded manifest child against current authoring, audits it, and reports real progress", async () => {
    const progress: TestRegradeProgress[] = [];
    const result = await regradeTestAttempt(user, "course", "parent", "Corrected key", p => progress.push(p));
    expect(mocks.submit).toHaveBeenCalledTimes(2); // Newly added third exercise is outside this submitted Test.
    expect(mocks.submit).toHaveBeenCalledWith(expect.objectContaining({
      user: expect.objectContaining({ id: "learner" }), actor: user,
      activity: expect.objectContaining({ config: { key: "corrected" } }), payload: { answers: { q: ["saved"] } },
      previousConfig: { key: "old" }
    }));
    expect(mocks.aggregate).toHaveBeenCalledOnce();
    expect(result.items.map(i => i.status)).toEqual(["graded", "graded"]);
    expect(progress[0]).toEqual({ completed: 0, total: 3, activityTitle: "Exercise 1" });
    expect(progress.at(-1)).toEqual({ completed: 3, total: 3, activityTitle: null });
    expect(progress.some(p => p.completed === 1)).toBe(true);
    for (const [call] of mocks.db.testItemAttempt.update.mock.calls) {
      expect(call.data).not.toHaveProperty("submittedAt");
      expect(call.data.feedback).toEqual({ teacherComment: "Keep this comment" });
      expect(call.data.result).toMatchObject({
        configSnapshot: { key: "old" }, gradingConfigSnapshot: { key: "corrected" }, state: { answers: { q: ["saved"] } }
      });
    }
    expect(mocks.db.courseAuditEvent.create).toHaveBeenCalledTimes(2);
    expect(mocks.db.courseAuditEvent.create.mock.calls[0][0].data.previousValue.result).toEqual(parent.testItemAttempts[0].result);
    expect(mocks.db.testSubmissionClaim.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ status: "processing", updatedAt: expect.any(Date) }) }));
  });

  it("regrades every child again on a second request", async () => {
    await regradeTestAttempt(user, "course", "parent");
    await regradeTestAttempt(user, "course", "parent");
    expect(mocks.submit).toHaveBeenCalledTimes(4);
  });

  it("continues after a runner failure, retains successful child results, and leaves the parent grade unchanged", async () => {
    mocks.submit.mockRejectedValueOnce(new AppError(503, "RUNNER_UNAVAILABLE", "Runner unavailable"));
    const result = await regradeTestAttempt(user, "course", "parent");
    expect(mocks.submit).toHaveBeenCalledTimes(2);
    expect(result).toMatchObject({ result: null, items: [{ status: "failed", title: "Exercise 1", message: "Runner unavailable" }, { status: "graded" }] });
    expect(mocks.db.testItemAttempt.update).toHaveBeenCalledTimes(1);
    expect(mocks.aggregate).not.toHaveBeenCalled();
  });

  it("keeps existing scores and feedback when a child needs manual/rubric grading", async () => {
    mocks.submit.mockResolvedValueOnce({ state: { answers: {} }, gradingResult: null });
    const result = await regradeTestAttempt(user, "course", "parent");
    expect(result.items[0].status).toBe("pending");
    expect(mocks.db.testItemAttempt.update.mock.calls[0][0].data).not.toHaveProperty("rawScore");
    expect(mocks.aggregate).not.toHaveBeenCalled();
  });

  it("grades recovered submitted responses using the same batch", async () => {
    parent = fixture("submitted");
    await regradeTestAttempt(user, "course", "parent");
    expect(mocks.submit).toHaveBeenCalledTimes(2);
    expect(mocks.aggregate).toHaveBeenCalledOnce();
  });

  it("uses a plugin's dedicated regrade handler when provided", async () => {
    const handler = vi.fn().mockResolvedValue({ state: { executionId: "original" }, gradingResult: { rawScore: 3, rawMaxScore: 4 } });
    mocks.regrade.mockReturnValue(handler);
    await regradeTestAttempt(user, "course", "parent");
    expect(handler).toHaveBeenCalledTimes(2);
    expect(mocks.submit).not.toHaveBeenCalled();
    expect(mocks.db.testItemAttempt.update.mock.calls[0][0].data.normalizedScore).toBe(7.5);
  });

  it("rejects simultaneous grading without executing children or releasing another operation's claim", async () => {
    mocks.db.testSubmissionClaim.findUnique.mockResolvedValue({ status: "processing", updatedAt: new Date() });
    await expect(regradeTestAttempt(user, "course", "parent")).rejects.toMatchObject({ code: "TEST_SUBMISSION_IN_PROGRESS" });
    expect(mocks.submit).not.toHaveBeenCalled();
    expect(mocks.db.testSubmissionClaim.updateMany).not.toHaveBeenCalled();
  });

  it("does not overwrite a submission reopened or changed while a runner was executing", async () => {
    mocks.submit.mockImplementationOnce(async () => {
      mocks.db.activityAttempt.findUniqueOrThrow.mockResolvedValue({ ...parent, lifecycle: "started" });
      return { state: {}, gradingResult: { rawScore: 1, rawMaxScore: 1 } };
    });
    await expect(regradeTestAttempt(user, "course", "parent")).rejects.toMatchObject({ code: "TEST_ATTEMPT_CHANGED" });
    expect(mocks.db.testItemAttempt.update).not.toHaveBeenCalled();
    expect(mocks.aggregate).not.toHaveBeenCalled();
    expect(mocks.db.testSubmissionClaim.updateMany).toHaveBeenCalledOnce();
  });

  it("checks teacher section authorization before creating a claim", async () => {
    mocks.authorize.mockRejectedValue(new AppError(403, "FORBIDDEN", "Forbidden"));
    await expect(regradeTestAttempt(user, "course", "parent")).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(mocks.db.$transaction).not.toHaveBeenCalled();
  });
});
