import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  assertCanManageCourse: vi.fn(),
  ensureParsonsAttempt: vi.fn(),
  generateParsonsProblem: vi.fn(),
  updateParsonsAttempt: vi.fn(),
  prisma: {
    course: { findUnique: vi.fn() }
  }
}));

vi.mock("@cognelo/core", async () => {
  const actual = await vi.importActual<typeof import("@cognelo/core")>("@cognelo/core");
  return {
    ...actual,
    assertCanManageCourse: mocks.assertCanManageCourse
  };
});

vi.mock("@cognelo/db", () => ({
  prisma: mocks.prisma
}));

vi.mock("./attempts", () => ({
  ensureParsonsAttempt: mocks.ensureParsonsAttempt,
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
    mocks.updateParsonsAttempt.mockResolvedValue({ id: "attempt-1" });
    mocks.generateParsonsProblem.mockResolvedValue({ status: "ok" });
    mocks.prisma.course.findUnique.mockResolvedValue({ subject: { title: "Programming", description: "Basics" } });
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
    ).resolves.toEqual({ attempt: { id: "attempt-1" } });
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
});
