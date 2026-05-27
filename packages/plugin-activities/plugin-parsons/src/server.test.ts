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

  it("returns a grading result by evaluating the stored attempt against the current activity config", async () => {
    mockPrisma.pluginParsonsAttempt.findFirst.mockResolvedValue({
      id: "plugin-attempt-1",
      activityId: "activity-1",
      latestState: parsonsState([
        parsonsBlock({ id: "block-1", text: "first", sourceIndex: 0, physicalLineIndex: 0 }),
        parsonsBlock({ id: "block-2", text: "second", sourceIndex: 1, physicalLineIndex: 1 })
      ])
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
          config: {
            solution: "first\nsecond",
            language: "python",
            stripIndentation: false,
            groups: [],
            precedenceRules: []
          },
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

  it("uses the corrected course activity config when regrading", async () => {
    mockPrisma.pluginParsonsAttempt.findFirst.mockResolvedValue({
      id: "plugin-attempt-1",
      activityId: "activity-1",
      latestState: parsonsState([
        parsonsBlock({ id: "block-1", text: "first", sourceIndex: 0, physicalLineIndex: 0 }),
        parsonsBlock({ id: "block-2", text: "second", sourceIndex: 1, physicalLineIndex: 1 })
      ])
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
          config: {
            solution: "second\nfirst",
            language: "python",
            stripIndentation: false,
            groups: [],
            precedenceRules: []
          },
          activityType: {
            key: "parsons-problem",
            name: "Parsons problem",
            description: ""
          }
        }
      })
    ).resolves.toMatchObject({
      rawScore: 0.3,
      rawMaxScore: 1,
      isPass: false
    });
  });

  it("rejects attempts that do not contain a parsable attempt state", async () => {
    mockPrisma.pluginParsonsAttempt.findFirst.mockResolvedValue({
      id: "plugin-attempt-1",
      activityId: "activity-1",
      latestState: {}
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
          config: {
            solution: "first\nsecond",
            language: "python",
            stripIndentation: false,
            groups: [],
            precedenceRules: []
          },
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

function parsonsState(blocks: ReturnType<typeof parsonsBlock>[]) {
  return {
    configFingerprint: "old-config",
    blocks,
    selectedBlockId: null,
    lastEvaluation: null
  };
}

function parsonsBlock(input: { id: string; text: string; sourceIndex: number; physicalLineIndex: number }) {
  return {
    id: input.id,
    displayText: input.text,
    originalText: input.text,
    sourceIndex: input.sourceIndex,
    physicalLineIndex: input.physicalLineIndex,
    unitId: `line-${input.physicalLineIndex}`,
    groupId: null,
    expectedIndent: 0,
    currentIndent: 0
  };
}
