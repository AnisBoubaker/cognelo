import { beforeEach, describe, expect, it, vi } from "vitest";

const dbMocks = vi.hoisted(() => ({
  pluginCodingHomeworkSubmission: {
    findFirst: vi.fn(),
    update: vi.fn()
  }
}));

vi.mock("./db-client", () => ({
  Prisma: {},
  prisma: dbMocks
}));

const { isCodingHomeworkSubmissionDeleted, markCodingHomeworkSubmissionDeleted } = await import("./submission-deletion");

describe("coding homework submission deletion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("marks the plugin submission as deleted and clears the core attempt link", async () => {
    dbMocks.pluginCodingHomeworkSubmission.findFirst.mockResolvedValueOnce({
      id: "submission-1",
      activityId: "activity-1",
      groupId: "group-1",
      coreAttemptId: "attempt-1",
      kind: "final",
      metadata: { originalName: "submission.zip" }
    });

    await markCodingHomeworkSubmissionDeleted({
      activityId: "activity-1",
      coreAttemptId: "attempt-1",
      deletedAt: "2026-06-19T10:00:00.000Z",
      deletedByUserId: "teacher-1",
      groupId: "group-1",
      pluginAttemptRef: "submission-1",
      reason: "Wrong file"
    });

    expect(dbMocks.pluginCodingHomeworkSubmission.findFirst).toHaveBeenCalledWith({
      where: {
        id: "submission-1",
        activityId: "activity-1",
        groupId: "group-1",
        coreAttemptId: "attempt-1",
        kind: "final"
      }
    });
    expect(dbMocks.pluginCodingHomeworkSubmission.update).toHaveBeenCalledWith({
      where: { id: "submission-1" },
      data: {
        coreAttemptId: null,
        metadata: {
          originalName: "submission.zip",
          deletion: {
            coreAttemptId: "attempt-1",
            deletedAt: "2026-06-19T10:00:00.000Z",
            deletedByUserId: "teacher-1",
            reason: "Wrong file"
          }
        },
        processingError: null
      }
    });
  });

  it("recognizes deletion metadata", () => {
    expect(isCodingHomeworkSubmissionDeleted({ deletion: { reason: "Wrong file" } })).toBe(true);
    expect(isCodingHomeworkSubmissionDeleted({})).toBe(false);
  });
});
