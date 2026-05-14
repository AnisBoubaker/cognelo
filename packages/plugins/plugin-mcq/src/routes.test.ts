import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  assertCanManageActivityBank: vi.fn(),
  assertCanManageCourse: vi.fn(),
  generateQuestionAuthoringText: vi.fn(),
  prisma: {
    activityBank: { findUnique: vi.fn() },
    course: { findUnique: vi.fn() }
  }
}));

vi.mock("@cognelo/core", async () => {
  const actual = await vi.importActual<typeof import("@cognelo/core")>("@cognelo/core");
  return {
    ...actual,
    assertCanManageActivityBank: mocks.assertCanManageActivityBank,
    assertCanManageCourse: mocks.assertCanManageCourse,
    generateQuestionAuthoringText: mocks.generateQuestionAuthoringText
  };
});

vi.mock("@cognelo/db", () => ({
  prisma: mocks.prisma
}));

const { mcqGenerateRoute } = await import("./routes");

const context = {
  user: { id: "teacher-1", email: "teacher@example.test", name: null, firstName: null, lastName: null, roles: ["teacher" as const] },
  courseId: "course-1",
  activityId: "activity-1",
  path: ["mcq", "generate"],
  activity: {
    id: "activity-1",
    title: "MCQ",
    description: "",
    lifecycle: "draft",
    activityType: { key: "mcq", name: "MCQ", description: "" }
  }
};

describe("MCQ generation route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.prisma.course.findUnique.mockResolvedValue({ subject: { title: "Programming", description: "Basics" } });
  });

  it("generates valid MCQ source with course permissions", async () => {
    mocks.generateQuestionAuthoringText.mockResolvedValue(`## Question\n\n- [x] Correct\n- [ ] Wrong`);

    await expect(
      mcqGenerateRoute.methods.POST?.({
        request: new Request("http://test.local"),
        context,
        readJson: async () => ({ description: "Generate a simple programming MCQ.", defaultCodeLanguage: "python", locale: "en" })
      })
    ).resolves.toMatchObject({ attempts: 1, source: expect.stringContaining("## Question") });

    expect(mocks.assertCanManageCourse).toHaveBeenCalledWith(context.user, "course-1");
  });

  it("retries malformed source and fails after repeated invalid output", async () => {
    mocks.generateQuestionAuthoringText.mockResolvedValue("not mcq");

    await expect(
      mcqGenerateRoute.methods.POST?.({
        request: new Request("http://test.local"),
        context,
        readJson: async () => ({ description: "Generate a simple programming MCQ.", defaultCodeLanguage: "python", locale: "en" })
      })
    ).rejects.toMatchObject({ status: 422, code: "MCQ_AI_GENERATION_INVALID" });
  });

  it("requires a course or bank context", async () => {
    await expect(
      mcqGenerateRoute.methods.POST?.({
        request: new Request("http://test.local"),
        context: { ...context, courseId: undefined },
        readJson: async () => ({ description: "Generate a simple programming MCQ.", defaultCodeLanguage: "python", locale: "en" })
      })
    ).rejects.toMatchObject({ status: 400, code: "ACTIVITY_CONTEXT_REQUIRED" });
  });
});
