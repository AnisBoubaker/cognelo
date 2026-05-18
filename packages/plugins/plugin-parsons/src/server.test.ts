import { beforeEach, describe, expect, it, vi } from "vitest";

const mockPrisma = vi.hoisted(() => ({
  pluginParsonsAttempt: {
    findFirst: vi.fn()
  }
}));

vi.mock("./db-client", () => ({
  prisma: mockPrisma
}));

vi.mock("@cognelo/core", () => ({
  AppError: class AppError extends Error {
    constructor(
      public readonly status: number,
      public readonly code: string,
      message: string
    ) {
      super(message);
    }
  }
}));

const { parsonsServerPlugin } = await import("./server");

describe("Parsons server plugin grading contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns a grading result from a stored Parsons attempt result", async () => {
    mockPrisma.pluginParsonsAttempt.findFirst.mockResolvedValue({
      id: "plugin-attempt-1",
      activityId: "activity-1",
      resultSummary: {
        latestResult: {
          isCorrect: true,
          orderCorrect: true,
          indentationCorrect: true,
          misplacedBlocks: 0,
          incorrectIndents: 0
        }
      }
    });

    await expect(
      parsonsServerPlugin.grading?.gradeAttempt?.({
        user: {
          id: "teacher-1",
          email: "teacher@example.test",
          name: "Ada Teacher",
          firstName: "Ada",
          lastName: "Teacher",
          roles: ["teacher"]
        },
        courseId: "course-1",
        groupId: "group-1",
        activityId: "activity-1",
        coreAttemptId: "core-attempt-1",
        pluginAttemptRef: "plugin-attempt-1",
        activity: {
          id: "activity-1",
          title: "Parsons",
          description: "",
          lifecycle: "published",
          activityType: {
            key: "parsons-problem",
            name: "Parsons problem",
            description: ""
          }
        }
      })
    ).resolves.toMatchObject({
      rawScore: 1,
      rawMaxScore: 1,
      isPass: true
    });

    expect(mockPrisma.pluginParsonsAttempt.findFirst).toHaveBeenCalledWith({
      where: {
        id: "plugin-attempt-1",
        activityId: "activity-1"
      }
    });
  });

  it("rejects attempts that do not contain a parsable grading result", async () => {
    mockPrisma.pluginParsonsAttempt.findFirst.mockResolvedValue({
      id: "plugin-attempt-1",
      activityId: "activity-1",
      resultSummary: {}
    });

    await expect(
      parsonsServerPlugin.grading?.gradeAttempt?.({
        user: {
          id: "teacher-1",
          email: "teacher@example.test",
          name: "Ada Teacher",
          firstName: "Ada",
          lastName: "Teacher",
          roles: ["teacher"]
        },
        courseId: "course-1",
        groupId: "group-1",
        activityId: "activity-1",
        coreAttemptId: "core-attempt-1",
        pluginAttemptRef: "plugin-attempt-1",
        activity: {
          id: "activity-1",
          title: "Parsons",
          description: "",
          lifecycle: "published",
          activityType: {
            key: "parsons-problem",
            name: "Parsons problem",
            description: ""
          }
        }
      })
    ).rejects.toMatchObject({ code: "PARSONS_ATTEMPT_NOT_GRADABLE" });
  });
});
