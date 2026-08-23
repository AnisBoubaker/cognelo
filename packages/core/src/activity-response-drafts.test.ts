import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CurrentUser } from "@cognelo/contracts";

const db = vi.hoisted(() => ({
  activityResponseDraft: {
    findUnique: vi.fn(),
    upsert: vi.fn(),
    deleteMany: vi.fn()
  },
  courseGroupParticipant: { findFirst: vi.fn() }
}));
const groups = vi.hoisted(() => ({ getGroupAssignedActivity: vi.fn() }));

vi.mock("@cognelo/db", () => ({ prisma: db, Prisma: {} }));
vi.mock("./groups", () => groups);

import {
  clearActivityResponseDraft,
  getActivityResponseDraft,
  saveActivityResponseDraft
} from "./activity-response-drafts";

const student: CurrentUser = {
  id: "student-1",
  email: "student@example.test",
  name: null,
  firstName: null,
  lastName: null,
  roles: ["student"]
};

describe("activity response drafts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    groups.getGroupAssignedActivity.mockResolvedValue({
      id: "activity-1",
      activityType: { key: "mcq" },
      assignment: { id: "group-activity-1" }
    });
    db.courseGroupParticipant.findFirst.mockResolvedValue({ id: "participant-1" });
    db.activityResponseDraft.findUnique.mockResolvedValue(null);
    db.activityResponseDraft.upsert.mockResolvedValue({
      id: "draft-1",
      state: { answers: { question1: ["a"] } },
      createdAt: new Date("2026-08-23T10:00:00.000Z"),
      updatedAt: new Date("2026-08-23T10:00:01.000Z")
    });
    db.activityResponseDraft.deleteMany.mockResolvedValue({ count: 1 });
  });

  it("loads the current student's draft for the authorized assignment", async () => {
    await getActivityResponseDraft(student, "course-1", "group-1", "activity-1");

    expect(groups.getGroupAssignedActivity).toHaveBeenCalledWith(student, "course-1", "group-1", "activity-1");
    expect(db.activityResponseDraft.findUnique).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        groupActivityId_participantId: {
          groupActivityId: "group-activity-1",
          participantId: "participant-1"
        }
      }
    }));
  });

  it("upserts JSON state without creating a gradebook attempt", async () => {
    const state = { sourceCode: "print('saved')" };
    await saveActivityResponseDraft(student, "course-1", "group-1", "activity-1", state);

    expect(db.activityResponseDraft.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({
        groupActivityId: "group-activity-1",
        participantId: "participant-1",
        state
      }),
      update: { state }
    }));
  });

  it("clears only the current student's draft for this assignment", async () => {
    await clearActivityResponseDraft(student, "course-1", "group-1", "activity-1");

    expect(db.activityResponseDraft.deleteMany).toHaveBeenCalledWith({
      where: {
        groupActivityId: "group-activity-1",
        participantId: "participant-1"
      }
    });
  });

  it("rejects users without a linked student participant", async () => {
    db.courseGroupParticipant.findFirst.mockResolvedValue(null);

    await expect(saveActivityResponseDraft(student, "course-1", "group-1", "activity-1", {}))
      .rejects.toMatchObject({ status: 403, code: "PARTICIPANT_REQUIRED" });
  });

  it("keeps Test child autosave isolated from standalone drafts", async () => {
    groups.getGroupAssignedActivity.mockResolvedValue({
      id: "test-activity-1",
      activityType: { key: "test" },
      assignment: { id: "group-activity-test" }
    });

    await expect(getActivityResponseDraft(student, "course-1", "group-1", "test-activity-1"))
      .rejects.toMatchObject({ status: 400, code: "TEST_ACTIVITY_DRAFT_UNSUPPORTED" });
    expect(db.courseGroupParticipant.findFirst).not.toHaveBeenCalled();
    expect(db.activityResponseDraft.findUnique).not.toHaveBeenCalled();
  });

  it("rejects unexpectedly large drafts", async () => {
    await expect(saveActivityResponseDraft(
      student,
      "course-1",
      "group-1",
      "activity-1",
      { sourceCode: "x".repeat(2 * 1024 * 1024) }
    )).rejects.toMatchObject({ status: 413, code: "ACTIVITY_RESPONSE_DRAFT_TOO_LARGE" });
    expect(groups.getGroupAssignedActivity).not.toHaveBeenCalled();
  });
});
