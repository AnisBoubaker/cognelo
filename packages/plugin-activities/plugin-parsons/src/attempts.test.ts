import { beforeEach, describe, expect, it, vi } from "vitest";
import { parseParsonsConfig } from "./parsons";
import { createInitialParsonsAttemptState, getParsonsConfigFingerprint } from "./attempt-types";

const tx = vi.hoisted(() => ({
  pluginParsonsAttempt: {
    update: vi.fn()
  },
  pluginParsonsAttemptEvent: {
    create: vi.fn()
  }
}));

const mockPrisma = vi.hoisted(() => ({
  $transaction: vi.fn(async (handler: (transaction: typeof tx) => unknown) => handler(tx)),
  pluginParsonsAttempt: {
    create: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn()
  }
}));

vi.mock("./db-client", () => ({
  prisma: mockPrisma,
  Prisma: {}
}));

const { ensureParsonsAttempt, listParsonsGradebookAttempts, listRecentParsonsAttemptSignals, updateParsonsAttempt } = await import("./attempts");

const now = new Date("2026-01-01T00:00:00.000Z");
const config = parseParsonsConfig({ solution: "a()\nb()" });
const state = createInitialParsonsAttemptState(config);

function attempt(overrides: Record<string, unknown> = {}) {
  return {
    id: "attempt-1",
    activityId: "activity-1",
    userId: "user-1",
    status: "in_progress",
    startedAt: now,
    lastInteractionAt: now,
    completedAt: null,
    checkCount: 0,
    resetCount: 0,
    moveCount: 0,
    indentCount: 0,
    latestState: state,
    resultSummary: {},
    ...overrides
  };
}

describe("Parsons attempts persistence helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.$transaction.mockImplementation(async (handler: (transaction: typeof tx) => unknown) => handler(tx));
  });

  it("reuses compatible in-progress attempts and creates new ones otherwise", async () => {
    mockPrisma.pluginParsonsAttempt.findFirst.mockResolvedValueOnce(attempt());

    await expect(ensureParsonsAttempt({ activityId: "activity-1", userId: "user-1", config })).resolves.toMatchObject({
      id: "attempt-1"
    });
    expect(mockPrisma.pluginParsonsAttempt.create).not.toHaveBeenCalled();

    mockPrisma.pluginParsonsAttempt.findFirst.mockResolvedValueOnce(null);
    mockPrisma.pluginParsonsAttempt.create.mockResolvedValueOnce(attempt({ id: "attempt-2" }));
    await expect(ensureParsonsAttempt({ activityId: "activity-1", userId: "user-1", config })).resolves.toMatchObject({
      id: "attempt-2"
    });
  });

  it("abandons stale attempts when the config fingerprint changes", async () => {
    mockPrisma.pluginParsonsAttempt.findFirst.mockResolvedValueOnce(
      attempt({
        latestState: {
          ...state,
          configFingerprint: "old"
        }
      })
    );
    mockPrisma.pluginParsonsAttempt.create.mockResolvedValueOnce(attempt({ id: "attempt-new" }));

    await ensureParsonsAttempt({ activityId: "activity-1", userId: "user-1", config });

    expect(mockPrisma.pluginParsonsAttempt.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "attempt-1" },
        data: expect.objectContaining({ status: "abandoned" })
      })
    );
  });

  it("updates attempt state, records events, and rejects stale fingerprints", async () => {
    mockPrisma.pluginParsonsAttempt.findFirst.mockResolvedValueOnce(attempt());
    tx.pluginParsonsAttempt.update.mockResolvedValueOnce(attempt({ checkCount: 1, resultSummary: { latestCorrect: true } }));

    await expect(
      updateParsonsAttempt({
        activityId: "activity-1",
        userId: "user-1",
        config,
        input: {
          attemptId: "clx0000000000000000000000",
          state,
          event: { type: "check", payload: {} },
          result: { isCorrect: true, orderCorrect: true, indentationCorrect: true, misplacedBlocks: 0, incorrectIndents: 0 },
          complete: true,
          abandon: false
        }
      })
    ).resolves.toMatchObject({ resultSummary: { latestCorrect: true } });

    expect(tx.pluginParsonsAttemptEvent.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ type: "check" }) }));

    mockPrisma.pluginParsonsAttempt.findFirst.mockResolvedValueOnce(attempt());
    await expect(
      updateParsonsAttempt({
        activityId: "activity-1",
        userId: "user-1",
        config,
        input: {
          attemptId: "clx0000000000000000000000",
          state: { ...state, configFingerprint: "stale" },
          complete: false,
          abandon: false
        }
      })
    ).resolves.toBeNull();
  });

  it("lists recent attempt signals with events", async () => {
    mockPrisma.pluginParsonsAttempt.findMany.mockResolvedValue([
      {
        ...attempt({ resultSummary: { configFingerprint: getParsonsConfigFingerprint(config) } }),
        events: [{ id: "event-1", type: "move", payload: { to: 1 }, createdAt: now }]
      }
    ]);

    await expect(listRecentParsonsAttemptSignals({ activityId: "activity-1", userId: "user-1", limit: 5 })).resolves.toMatchObject([
      { id: "attempt-1", recentEvents: [{ id: "event-1", type: "move" }] }
    ]);
    expect(mockPrisma.pluginParsonsAttempt.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 5 }));
  });

  it("lists gradebook attempts by latest interaction timestamp first", async () => {
    mockPrisma.pluginParsonsAttempt.findMany.mockResolvedValue([
      {
        ...attempt({ id: "attempt-1", status: "completed", completedAt: now }),
        events: [{ id: "event-1", type: "submit", payload: {}, createdAt: now }]
      }
    ]);

    await expect(
      listParsonsGradebookAttempts({
        activityId: "activity-1",
        userId: "user-1",
        config,
        includeAttempts: true
      })
    ).resolves.toMatchObject([{ id: "attempt-1", events: [{ id: "event-1" }] }]);

    expect(mockPrisma.pluginParsonsAttempt.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ lastInteractionAt: "desc" }, { startedAt: "desc" }],
        include: { events: { orderBy: [{ createdAt: "asc" }] } }
      })
    );
  });
});
