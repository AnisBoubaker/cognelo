import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCourseGradebook: vi.fn(),
  readJson: vi.fn(),
  requireUser: vi.fn(),
  resolveCompletions: vi.fn(),
  setRelease: vi.fn()
}));

vi.mock("@cognelo/core", () => ({
  AppError: class AppError extends Error {
    constructor(
      public readonly status: number,
      public readonly code: string,
      message: string,
      public readonly details?: unknown
    ) {
      super(message);
    }
  },
  getCourseGradebook: mocks.getCourseGradebook,
  setGradebookItemRelease: mocks.setRelease
}));
vi.mock("@/lib/gradebook-completion", () => ({
  resolveCourseGradebookCompletions: mocks.resolveCompletions
}));
vi.mock("@/lib/http", () => ({
  handleRoute: async (handler: () => Promise<Response>) => handler(),
  json: (data: unknown) => Response.json(data),
  options: () => new Response(null, { status: 204 }),
  readJson: mocks.readJson,
  requireUser: mocks.requireUser
}));

const { PATCH } = await import("./route");
const params = { params: Promise.resolve({ courseId: "course-1", gradebookItemId: "item-1" }) };

describe("gradebook release route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireUser.mockResolvedValue({ id: "teacher-1", roles: ["teacher"] });
    mocks.readJson.mockResolvedValue({ released: true });
    mocks.getCourseGradebook.mockResolvedValue({ items: [], rows: [] });
  });

  it("refuses to release an item with partial or ungraded submitted work", async () => {
    mocks.resolveCompletions.mockResolvedValue({
      items: [{
        gradebookItemId: "item-1",
        gradesReleased: false,
        canReleaseGrades: false,
        incompleteGradeCount: 2
      }]
    });

    await expect(PATCH(new Request("http://test.local", { method: "PATCH" }) as never, params)).rejects.toMatchObject({
      status: 409,
      code: "GRADEBOOK_ITEM_INCOMPLETE",
      details: { incompleteGradeCount: 2 }
    });
    expect(mocks.setRelease).not.toHaveBeenCalled();
  });

  it("releases a complete item", async () => {
    mocks.resolveCompletions.mockResolvedValue({
      items: [{
        gradebookItemId: "item-1",
        gradesReleased: false,
        canReleaseGrades: true,
        incompleteGradeCount: 0
      }]
    });
    mocks.setRelease.mockResolvedValue({ id: "item-1", gradesReleased: true });

    const response = await PATCH(new Request("http://test.local", { method: "PATCH" }) as never, params);

    await expect(response.json()).resolves.toEqual({
      gradebookItem: { id: "item-1", gradesReleased: true }
    });
    expect(mocks.setRelease).toHaveBeenCalledWith(
      { id: "teacher-1", roles: ["teacher"] },
      "course-1",
      "item-1",
      { released: true }
    );
  });
});
