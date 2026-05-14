import { beforeEach, describe, expect, it, vi } from "vitest";

const mockPrisma = vi.hoisted(() => ({
  pluginWebDesignExerciseSubmission: {
    create: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn()
  },
  pluginWebDesignExerciseTest: {
    findMany: vi.fn()
  },
  pluginWebDesignExerciseTestResult: {
    createMany: vi.fn()
  }
}));

const mocks = vi.hoisted(() => ({
  runWebDesignTestsInRunner: vi.fn()
}));

vi.mock("./db-client", () => ({
  prisma: mockPrisma,
  Prisma: {}
}));

vi.mock("./runner", () => ({
  runWebDesignTestsInRunner: mocks.runWebDesignTestsInRunner
}));

const { listRecentWebDesignExerciseSubmissions, runWebDesignExercise, submitWebDesignExercise } = await import("./executions");

const now = new Date("2026-01-01T00:00:00.000Z");
const file = { id: "index", path: "index.html", language: "html" as const, starterCode: "<main></main>", isEditable: true, orderIndex: 0 };

function submission(overrides: Record<string, unknown> = {}) {
  return {
    id: "submission-1",
    activityId: "activity-1",
    userId: "user-1",
    kind: "run",
    status: "completed",
    files: [file],
    resultSummary: {},
    score: 1,
    maxScore: 1,
    message: null,
    createdAt: now,
    updatedAt: now,
    testResults: [],
    ...overrides
  };
}

describe("web design execution persistence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.pluginWebDesignExerciseTest.findMany.mockResolvedValue([
      { id: "test-1", name: "Test", testCode: "await expect(page).toBeTruthy()", weight: 1 }
    ]);
    mockPrisma.pluginWebDesignExerciseSubmission.create.mockResolvedValue(submission({ status: "pending", score: null, maxScore: null }));
    mockPrisma.pluginWebDesignExerciseSubmission.update.mockResolvedValue(submission());
    mocks.runWebDesignTestsInRunner.mockResolvedValue({
      status: "completed",
      score: 1,
      maxScore: 1,
      durationMs: 20,
      tests: [{ id: "test-1", name: "Test", status: "completed", weight: 1, score: 1, details: {} }]
    });
  });

  it("runs sample tests, submits hidden tests, and persists runner results", async () => {
    await expect(runWebDesignExercise({ activityId: "activity-1", userId: "user-1", input: { files: [file] } })).resolves.toMatchObject({
      id: "submission-1",
      status: "completed"
    });
    expect(mockPrisma.pluginWebDesignExerciseTest.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ kind: "sample" }) }));
    expect(mockPrisma.pluginWebDesignExerciseTestResult.createMany).toHaveBeenCalled();

    await submitWebDesignExercise({ activityId: "activity-1", userId: "user-1", input: { files: [file] } });
    expect(mockPrisma.pluginWebDesignExerciseTest.findMany).toHaveBeenLastCalledWith(expect.objectContaining({ where: expect.objectContaining({ kind: "hidden" }) }));
  });

  it("records failed submissions when the runner fails and lists recent submissions", async () => {
    mocks.runWebDesignTestsInRunner.mockRejectedValueOnce(new Error("runner down"));
    mockPrisma.pluginWebDesignExerciseSubmission.update.mockResolvedValueOnce(
      submission({ status: "failed", score: null, maxScore: null, message: "runner down" })
    );

    await expect(runWebDesignExercise({ activityId: "activity-1", userId: "user-1", input: { files: [file] } })).resolves.toMatchObject({
      status: "failed",
      message: "runner down"
    });

    mockPrisma.pluginWebDesignExerciseSubmission.findMany.mockResolvedValue([submission()]);
    await expect(listRecentWebDesignExerciseSubmissions({ activityId: "activity-1", userId: "user-1", kind: "run" })).resolves.toHaveLength(1);
  });
});
