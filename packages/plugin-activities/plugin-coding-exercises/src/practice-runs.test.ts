import { beforeEach, describe, expect, it, vi } from "vitest";
import { getCodingExerciseMaxTestRuns, codingExerciseAiFeedbackConfigSchema } from "./coding-exercises";

const mocks = vi.hoisted(() => ({ participant: vi.fn(), latest: vi.fn(), availability: vi.fn(), query: vi.fn(), create: vi.fn(), transaction: vi.fn() }));
vi.mock("@cognelo/core", () => ({
  AppError: class extends Error { constructor(public status: number, public code: string, message: string, public details?: unknown) { super(message); } },
  getActivityAttemptAvailability: mocks.availability
}));
vi.mock("@cognelo/db", () => ({ prisma: { courseGroupParticipant: { findFirst: mocks.participant }, activityAttempt: { findFirst: mocks.latest } } }));
vi.mock("./db-client", () => ({ prisma: { $queryRaw: mocks.query, $transaction: mocks.transaction,
  pluginCodingExerciseExecution: { create: mocks.create } } }));

const { resolveCodingPracticeScope, codingTestPracticeScope, getCodingPracticeRunAllowance, createCodingPracticeRun, assertCodingPracticeRunsEnabled } = await import("./practice-runs");
const context = { groupId: "group", courseId: "course", user: { id: "student" }, activity: { id: "activity", config: { maxTestRuns: 2 }, assignment: { id: "assignment" } } } as unknown as Parameters<typeof resolveCodingPracticeScope>[0];

describe("per-attempt practice runs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.participant.mockResolvedValue({ id: "participant" });
    mocks.latest.mockResolvedValue(null);
    mocks.availability.mockResolvedValue({ canStart: true });
    mocks.query.mockResolvedValue([{ used: 0 }]);
    mocks.create.mockResolvedValue({ id: "reserved" });
    mocks.transaction.mockImplementation(async callback => callback({ $queryRaw: mocks.query, pluginCodingExerciseExecution: { create: mocks.create } }));
  });

  it("defaults blanks to zero and legacy code to unlimited, with explicit overrides retained", () => {
    expect(getCodingExerciseMaxTestRuns({ responseMode: "blanks" })).toBe(0);
    expect(getCodingExerciseMaxTestRuns({})).toBeNull();
    expect(getCodingExerciseMaxTestRuns({ responseMode: "blanks", maxTestRuns: null })).toBeNull();
    expect(getCodingExerciseMaxTestRuns({ maxTestRuns: 3 })).toBe(3);
    expect(getCodingExerciseMaxTestRuns({ maxTestRuns: 3, testsEnabled: false })).toBe(0);
    expect(() => assertCodingPracticeRunsEnabled({ responseMode: "blanks" })).toThrow("disabled");
  });

  it("resets for new attempt numbers but keeps the same scope after reopening", async () => {
    const first = await resolveCodingPracticeScope(context);
    mocks.latest.mockResolvedValue({ attemptNumber: 1, lifecycle: "submitted" });
    const next = await resolveCodingPracticeScope(context);
    expect(next).not.toBe(first);
    mocks.latest.mockResolvedValue({ attemptNumber: 1, lifecycle: "started" });
    expect(await resolveCodingPracticeScope(context)).toBe(first);
    expect(codingTestPracticeScope("parent-1", "child")).not.toBe(codingTestPracticeScope("parent-2", "child"));
  });

  it("cannot obtain another finite allowance after attempts are exhausted", async () => {
    mocks.latest.mockResolvedValue({ attemptNumber: 1, lifecycle: "graded" });
    mocks.availability.mockResolvedValue({ canStart: false });
    await expect(resolveCodingPracticeScope(context)).rejects.toMatchObject({ code: "CODING_EXERCISE_ATTEMPT_UNAVAILABLE" });
  });

  it("reads the allowance without creating attempts or executions", async () => {
    mocks.query.mockResolvedValue([{ used: 2 }]);
    await expect(getCodingPracticeRunAllowance({ activityId: "activity", userId: "student", activityConfig: { maxTestRuns: 3 }, scope: "attempt" }))
      .resolves.toEqual({ limit: 3, used: 2, remaining: 1 });
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("reserves the pending execution inside the scope lock and rejects exhausted runs", async () => {
    const data = { activityId: "activity", userId: "student", sourceCode: "print(1)", languageKey: "python", judge0LanguageId: 71 };
    mocks.query.mockResolvedValueOnce([]).mockResolvedValueOnce([{ used: 1 }]);
    await expect(createCodingPracticeRun(data, 2, "attempt")).resolves.toEqual({ id: "reserved" });
    expect(mocks.query.mock.calls[0][0].join("")).toContain("pg_advisory_xact_lock");
    mocks.create.mockClear();
    mocks.query.mockResolvedValueOnce([]).mockResolvedValueOnce([{ used: 2 }]);
    await expect(createCodingPracticeRun(data, 2, "attempt")).rejects.toMatchObject({ code: "CODING_EXERCISE_RUN_LIMIT_REACHED" });
    expect(mocks.create).not.toHaveBeenCalled();
    await expect(createCodingPracticeRun(data, 0, "attempt")).rejects.toMatchObject({ code: "CODING_EXERCISE_RUN_DISABLED" });
  });
});

describe("grading component policy", () => {
  const criterion = { id: "quality", title: "Quality", description: "Assess the solution.", weightPercent: 100 };
  it("keeps legacy tests-only configuration and accepts rubric-only with tests disabled", () => {
    expect(codingExerciseAiFeedbackConfigSchema.safeParse({}).success).toBe(true);
    expect(codingExerciseAiFeedbackConfigSchema.safeParse({ gradingEnabled: true, testsEnabled: false,
      testWeightPercent: 0, aiWeightPercent: 100, criteria: [criterion] }).success).toBe(true);
  });
  it("rejects missing components and weights that do not match enabled components", () => {
    expect(codingExerciseAiFeedbackConfigSchema.safeParse({ testsEnabled: false }).success).toBe(false);
    expect(codingExerciseAiFeedbackConfigSchema.safeParse({ testsEnabled: true, testWeightPercent: 80, aiWeightPercent: 0 }).success).toBe(false);
    expect(codingExerciseAiFeedbackConfigSchema.safeParse({ gradingEnabled: true, testsEnabled: false, criteria: [criterion] }).success).toBe(false);
    expect(codingExerciseAiFeedbackConfigSchema.safeParse({ gradingEnabled: true, testWeightPercent: 70, aiWeightPercent: 40, criteria: [criterion] }).success).toBe(false);
  });
});
