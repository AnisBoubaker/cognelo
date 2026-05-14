import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createActivity: vi.fn(),
  listActivities: vi.fn(),
  readJson: vi.fn(),
  requireUser: vi.fn(),
  runCourseActivityCreatedFromBankVersionHooks: vi.fn()
}));

vi.mock("@cognelo/core", () => ({
  createActivity: mocks.createActivity,
  listActivities: mocks.listActivities
}));

vi.mock("@cognelo/activity-sdk/server", () => ({
  runCourseActivityCreatedFromBankVersionHooks: mocks.runCourseActivityCreatedFromBankVersionHooks
}));

vi.mock("@/lib/http", () => ({
  handleRoute: async (handler: () => Promise<Response>) => handler(),
  json: (data: unknown, init?: ResponseInit) => Response.json(data, init),
  options: () => new Response(null, { status: 204 }),
  readJson: mocks.readJson,
  requireUser: mocks.requireUser
}));

const { POST } = await import("./route");

describe("course activities route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireUser.mockResolvedValue({ id: "teacher-1", roles: ["teacher"] });
    mocks.readJson.mockResolvedValue({ bankActivityId: "bank-activity-1" });
  });

  it("runs plugin copy hooks when a course activity is created from a bank version", async () => {
    mocks.createActivity.mockResolvedValue({
      id: "activity-1",
      bankActivityId: "bank-activity-1",
      activityVersionId: "version-1",
      title: "Copied activity",
      description: "Description",
      lifecycle: "draft",
      config: { prompt: "Solve it" },
      metadata: { activityVersionNumber: 2 },
      activityType: {
        key: "coding-exercise",
        name: "Coding exercise",
        description: "Write code"
      }
    });

    const response = await POST(new Request("http://test.local") as never, {
      params: Promise.resolve({ courseId: "course-1" })
    });

    expect(response.status).toBe(201);
    expect(mocks.runCourseActivityCreatedFromBankVersionHooks).toHaveBeenCalledWith({
      user: { id: "teacher-1", roles: ["teacher"] },
      courseId: "course-1",
      bankActivityId: "bank-activity-1",
      activityVersionId: "version-1",
      activity: {
        id: "activity-1",
        bankActivityId: "bank-activity-1",
        activityVersionId: "version-1",
        title: "Copied activity",
        description: "Description",
        lifecycle: "draft",
        config: { prompt: "Solve it" },
        metadata: { activityVersionNumber: 2 },
        activityType: {
          key: "coding-exercise",
          name: "Coding exercise",
          description: "Write code"
        }
      }
    });
  });

  it("does not run copy hooks for local course activities", async () => {
    mocks.createActivity.mockResolvedValue({
      id: "activity-1",
      bankActivityId: null,
      activityVersionId: null,
      title: "Local activity",
      description: "",
      lifecycle: "draft",
      config: {},
      metadata: {},
      activityType: {
        key: "placeholder",
        name: "Placeholder",
        description: ""
      }
    });

    await POST(new Request("http://test.local") as never, {
      params: Promise.resolve({ courseId: "course-1" })
    });

    expect(mocks.runCourseActivityCreatedFromBankVersionHooks).not.toHaveBeenCalled();
  });
});
