import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  assertCanManageCourse: vi.fn(),
  ensureParsonsAttempt: vi.fn(),
  findLatestParsonsAttempt: vi.fn(),
  generateParsonsProblem: vi.fn(),
  getActivityAttemptAvailability: vi.fn(),
  recordActivityAttemptGradingResult: vi.fn(),
  startActivityAttempt: vi.fn(),
  submitActivityAttempt: vi.fn(),
  updateParsonsAttempt: vi.fn(),
  prisma: {
    course: { findUnique: vi.fn() }
  }
}));

vi.mock("@cognelo/core", async () => {
  const actual = await vi.importActual<typeof import("@cognelo/core")>("@cognelo/core");
  return {
    ...actual,
    assertCanManageCourse: mocks.assertCanManageCourse,
    getActivityAttemptAvailability: mocks.getActivityAttemptAvailability,
    recordActivityAttemptGradingResult: mocks.recordActivityAttemptGradingResult,
    startActivityAttempt: mocks.startActivityAttempt,
    submitActivityAttempt: mocks.submitActivityAttempt
  };
});

vi.mock("@cognelo/db", () => ({
  prisma: mocks.prisma
}));

vi.mock("./attempts", () => ({
  ensureParsonsAttempt: mocks.ensureParsonsAttempt,
  findLatestParsonsAttempt: mocks.findLatestParsonsAttempt,
  updateParsonsAttempt: mocks.updateParsonsAttempt
}));

vi.mock("./generation", async () => {
  const actual = await vi.importActual<typeof import("./generation")>("./generation");
  return {
    ...actual,
    generateParsonsProblem: mocks.generateParsonsProblem
  };
});

const { parsonsAttemptRoute, parsonsGenerateRoute } = await import("./routes");

const context = {
  user: { id: "student-1", email: "student@example.test", name: null, firstName: null, lastName: null, roles: ["student" as const] },
  courseId: "course-1",
  activityId: "activity-1",
  path: ["parsons", "attempt"],
  activity: {
    id: "activity-1",
    title: "Parsons",
    description: "",
    lifecycle: "draft",
    config: { solution: "a()\nb()" },
    activityType: { key: "parsons-problem", name: "Parsons", description: "" }
  }
};

describe("Parsons plugin routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.ensureParsonsAttempt.mockResolvedValue({ id: "attempt-1" });
    mocks.findLatestParsonsAttempt.mockResolvedValue({ id: "completed-attempt-1", status: "completed" });
    mocks.getActivityAttemptAvailability.mockResolvedValue({ canStart: true, reason: null });
    mocks.updateParsonsAttempt.mockResolvedValue({ id: "attempt-1", latestState: { configFingerprint: "fingerprint-1" } });
    mocks.generateParsonsProblem.mockResolvedValue({ status: "ok" });
    mocks.prisma.course.findUnique.mockResolvedValue({ subject: { title: "Programming", description: "Basics" } });
    mocks.startActivityAttempt.mockResolvedValue({ id: "core-attempt-1" });
    mocks.submitActivityAttempt.mockResolvedValue({ id: "core-attempt-1" });
    mocks.recordActivityAttemptGradingResult.mockResolvedValue({ id: "grade-1" });
  });

  it("ensures and updates attempts", async () => {
    await expect(
      parsonsAttemptRoute.methods.POST?.({
        request: new Request("http://test.local"),
        context,
        readJson: async () => ({ forceNew: true })
      })
    ).resolves.toEqual({ attempt: { id: "attempt-1" } });

    await expect(
      parsonsAttemptRoute.methods.PATCH?.({
        request: new Request("http://test.local"),
        context,
        readJson: async () => ({ attemptId: "clx0000000000000000000000" })
      })
    ).resolves.toMatchObject({ attempt: { id: "attempt-1" } });
  });

  it("rejects invalid attempt updates and generates with manager permission", async () => {
    mocks.updateParsonsAttempt.mockResolvedValueOnce(null);
    await expect(
      parsonsAttemptRoute.methods.PATCH?.({
        request: new Request("http://test.local"),
        context,
        readJson: async () => ({ attemptId: "clx0000000000000000000000" })
      })
    ).rejects.toMatchObject({ status: 409, code: "ATTEMPT_STATE_INVALID" });

    await expect(
      parsonsGenerateRoute.methods.POST?.({
        request: new Request("http://test.local"),
        context: { ...context, user: { ...context.user, roles: ["teacher" as const] } },
        readJson: async () => ({ description: "Generate a Parsons problem.", language: "python", locale: "en" })
      })
    ).resolves.toEqual({ status: "ok" });
    expect(mocks.assertCanManageCourse).toHaveBeenCalled();
  });

  it("records a core gradebook attempt for summative submissions", async () => {
    await expect(
      parsonsAttemptRoute.methods.PATCH?.({
        request: new Request("http://test.local"),
        context: {
          ...context,
          groupId: "group-1",
          activity: {
            ...context.activity,
            assignment: {
              id: "assignment-1",
              metadata: { assessmentMode: "summative" }
            }
          }
        },
        readJson: async () => ({
          attemptId: "clx0000000000000000000000",
          submit: true,
          result: { isCorrect: true, orderCorrect: true, indentationCorrect: true, misplacedBlocks: 0, incorrectIndents: 0 }
        })
      })
    ).resolves.toEqual({ attempt: { id: "attempt-1", latestState: { configFingerprint: "fingerprint-1" } } });

    expect(mocks.startActivityAttempt).toHaveBeenCalledWith(
      context.user,
      expect.objectContaining({
        courseId: "course-1",
        groupId: "group-1",
        activityId: "activity-1",
        pluginKey: "parsons",
        pluginAttemptRef: "attempt-1",
        activityConfigFingerprint: "fingerprint-1"
      })
    );
    expect(mocks.submitActivityAttempt).toHaveBeenCalledWith(context.user, {
      attemptId: "core-attempt-1",
      pluginAttemptRef: "attempt-1"
    });
    expect(mocks.recordActivityAttemptGradingResult).toHaveBeenCalledWith(
      context.user,
      expect.objectContaining({
        attemptId: "core-attempt-1",
        rawScore: 1,
        rawMaxScore: 1,
        source: "auto",
        isPass: true
      })
    );
  });

  it("returns the completed summative attempt when the core attempt limit is reached", async () => {
    mocks.getActivityAttemptAvailability.mockResolvedValueOnce({ canStart: false, reason: "ATTEMPT_LIMIT_REACHED" });

    await expect(
      parsonsAttemptRoute.methods.POST?.({
        request: new Request("http://test.local"),
        context: {
          ...context,
          groupId: "group-1",
          activity: {
            ...context.activity,
            assignment: {
              id: "assignment-1",
              metadata: { assessmentMode: "summative" }
            }
          }
        },
        readJson: async () => ({})
      })
    ).resolves.toEqual({
      attempt: { id: "completed-attempt-1", status: "completed" },
      attemptAvailability: { canStart: false, reason: "ATTEMPT_LIMIT_REACHED" }
    });

    expect(mocks.ensureParsonsAttempt).not.toHaveBeenCalled();
  });
});
