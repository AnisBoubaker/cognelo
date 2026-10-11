import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CurrentUser } from "@cognelo/contracts";

const db = vi.hoisted(() => ({
  activityAttempt: { findMany: vi.fn() },
  activityResponseDraft: { findUnique: vi.fn() },
  courseGroupParticipant: { findFirst: vi.fn() }
}));
const gradebook = vi.hoisted(() => ({
  getActivityAttemptAvailability: vi.fn(),
  startActivityAttempt: vi.fn(),
  submitActivityAttempt: vi.fn()
}));
const groups = vi.hoisted(() => ({ getGroupAssignedActivity: vi.fn() }));
const authorization = vi.hoisted(() => ({ canManageCourse: vi.fn() }));

vi.mock("@cognelo/db", () => ({ prisma: db }));
vi.mock("./gradebook", () => ({
  ...gradebook,
  activityAttemptTimeLimitMinutes: (value: unknown) => {
    const minutes = value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>).timeLimitSnapshotMinutes
      : null;
    return typeof minutes === "number" && Number.isInteger(minutes) && minutes > 0 ? minutes : null;
  }
}));
vi.mock("./groups", () => groups);
vi.mock("./authorization", () => authorization);

import {
  assertTimedActivityWriteAllowed,
  finalizeExpiredTimedActivityAttempt,
  getTimedActivityRuntime,
  startOrResumeTimedActivityAttempt
} from "./activity-timing";

const student: CurrentUser = {
  id: "student-1",
  email: "student@example.test",
  name: "Student One",
  firstName: "Student",
  lastName: "One",
  roles: ["student"]
};

const activeAttempt = {
  id: "attempt-1",
  attemptNumber: 1,
  lifecycle: "started",
  startedAt: new Date("2026-10-11T14:00:00.000Z"),
  metadata: { timedAttempt: true, timeLimitSnapshotMinutes: 30 }
};

describe("generic timed activity runtime", () => {
  afterEach(() => vi.useRealTimers());

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-11T14:10:00.000Z"));
    authorization.canManageCourse.mockResolvedValue(false);
    groups.getGroupAssignedActivity.mockResolvedValue({
      activityType: { key: "mcq", providerKind: "plugin", providerKey: "mcq" },
      assignment: { id: "assignment-1", metadata: { timeLimitMinutes: 30 } }
    });
    db.courseGroupParticipant.findFirst.mockResolvedValue({ id: "participant-1" });
    db.activityAttempt.findMany.mockResolvedValue([]);
    db.activityResponseDraft.findUnique.mockResolvedValue(null);
    gradebook.getActivityAttemptAvailability.mockResolvedValue({ canStart: true, reason: null });
  });

  it("returns the course assignment limit before an attempt starts", async () => {
    await expect(getTimedActivityRuntime(student, "course-1", "group-1", "activity-1")).resolves.toMatchObject({
      timeLimitMinutes: 30,
      attempt: null,
      timing: { expiresAt: null, remainingSeconds: null, isExpired: false }
    });
  });

  it("starts a core attempt with an immutable time snapshot", async () => {
    db.activityAttempt.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([activeAttempt]);

    await expect(startOrResumeTimedActivityAttempt(student, "course-1", "group-1", "activity-1"))
      .resolves.toMatchObject({ timeLimitMinutes: 30, attempt: { id: "attempt-1" }, timing: { remainingSeconds: 1200 } });

    expect(gradebook.startActivityAttempt).toHaveBeenCalledWith(student, expect.objectContaining({
      activityId: "activity-1",
      pluginKey: "mcq",
      metadata: { timeLimitSnapshotMinutes: 30, timedAttempt: true }
    }));
  });

  it("keeps the active attempt snapshot when the assignment limit is disabled", async () => {
    groups.getGroupAssignedActivity.mockResolvedValue({
      activityType: { key: "mcq", providerKind: "plugin", providerKey: "mcq" },
      assignment: { id: "assignment-1", metadata: { timeLimitMinutes: null } }
    });
    db.activityAttempt.findMany.mockResolvedValue([activeAttempt]);

    await expect(getTimedActivityRuntime(student, "course-1", "group-1", "activity-1")).resolves.toMatchObject({
      timeLimitMinutes: 30,
      timing: { expiresAt: "2026-10-11T14:30:00.000Z", remainingSeconds: 1200, isExpired: false }
    });
  });

  it("rejects learner writes after the snapshotted deadline", async () => {
    db.activityAttempt.findMany.mockResolvedValue([{
      ...activeAttempt,
      startedAt: new Date("2026-10-11T14:00:00.000Z"),
      metadata: { timedAttempt: true, timeLimitSnapshotMinutes: 5 }
    }]);

    await expect(assertTimedActivityWriteAllowed(student, "course-1", "group-1", "activity-1"))
      .rejects.toMatchObject({ code: "ACTIVITY_TIME_LIMIT_EXPIRED" });
  });

  it("requires the explicit timed start before accepting learner writes", async () => {
    db.activityAttempt.findMany.mockResolvedValue([]);

    await expect(assertTimedActivityWriteAllowed(student, "course-1", "group-1", "activity-1"))
      .rejects.toMatchObject({ code: "TIMED_ACTIVITY_NOT_STARTED" });
  });

  it("allows only the final submission path to write after expiry", async () => {
    db.activityAttempt.findMany.mockResolvedValue([{
      ...activeAttempt,
      metadata: { timedAttempt: true, timeLimitSnapshotMinutes: 5 }
    }]);

    await expect(assertTimedActivityWriteAllowed(
      student,
      "course-1",
      "group-1",
      "activity-1",
      { allowExpiredAttempt: true }
    )).resolves.toBeUndefined();
  });

  it("preserves the saved draft when core finalizes an expired attempt", async () => {
    db.activityAttempt.findMany
      .mockResolvedValueOnce([{
        ...activeAttempt,
        metadata: { timedAttempt: true, timeLimitSnapshotMinutes: 5, existing: "value" }
      }])
      .mockResolvedValueOnce([]);
    db.activityResponseDraft.findUnique.mockResolvedValue({ state: { answers: { question: ["choice"] } } });

    await finalizeExpiredTimedActivityAttempt(student, "course-1", "group-1", "activity-1");

    expect(gradebook.submitActivityAttempt).toHaveBeenCalledWith(student, {
      attemptId: "attempt-1",
      metadata: {
        timedAttempt: true,
        timeLimitSnapshotMinutes: 5,
        existing: "value",
        timedOut: true,
        savedResponse: { answers: { question: ["choice"] } }
      }
    });
  });
});
