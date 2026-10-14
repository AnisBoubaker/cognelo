import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CurrentUser } from "@cognelo/contracts";
import { applyAssignmentExceptions, resolveAssignmentExceptions } from "./activity-assignment-exceptions";

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

  it("starts a core attempt and records its initial time limit", async () => {
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

  it.each(["section", "team", "student"])("caps the countdown at the effective %s Until date", async (level) => {
    const until = "2026-10-11T14:15:00.000Z";
    const overrides = level === "section" ? {} : resolveAssignmentExceptions([{
      groupActivityId: "assignment-1", teamId: level === "team" ? "team-1" : null,
      participantId: level === "student" ? "participant-1" : null, priority: 0,
      settings: { overrideFields: ["availableUntil"], availableUntil: until }
    }]);
    groups.getGroupAssignedActivity.mockResolvedValue({
      activityType: { key: "mcq" },
      assignment: applyAssignmentExceptions({ id: "assignment-1", metadata: { timeLimitMinutes: 30 }, availableUntil: level === "section" ? new Date(until) : null }, overrides)
    });
    db.activityAttempt.findMany.mockResolvedValue([activeAttempt]);
    await expect(getTimedActivityRuntime(student, "course-1", "group-1", "activity-1")).resolves.toMatchObject({
      timeLimitMinutes: 30, timing: { expiresAt: until, remainingSeconds: 300, isExpired: false }
    });
  });

  it("updates the earlier deadline live without resetting the start when Until changes or is cleared", async () => {
    db.activityAttempt.findMany.mockResolvedValue([activeAttempt]);
    for (const [until, expiresAt] of [
      ["2026-10-11T14:15:00.000Z", "2026-10-11T14:15:00.000Z"],
      ["2026-10-11T14:25:00.000Z", "2026-10-11T14:25:00.000Z"],
      ["2026-10-11T15:00:00.000Z", "2026-10-11T14:30:00.000Z"],
      [null, "2026-10-11T14:30:00.000Z"]
    ]) {
      groups.getGroupAssignedActivity.mockResolvedValue({ activityType: { key: "mcq" }, assignment: {
        id: "assignment-1", metadata: { timeLimitMinutes: 30 }, availableUntil: until ? new Date(until) : null
      } });
      await expect(getTimedActivityRuntime(student, "course-1", "group-1", "activity-1")).resolves.toMatchObject({
        attempt: { id: activeAttempt.id, startedAt: activeAttempt.startedAt.toISOString() }, timing: { expiresAt }
      });
      await expect(finalizeExpiredTimedActivityAttempt(student, "course-1", "group-1", "activity-1")).rejects.toMatchObject({ code: "ACTIVITY_TIME_LIMIT_ACTIVE" });
    }
  });

  it("expires exactly at Until, blocks further answers, and allows final submission with the saved draft", async () => {
    groups.getGroupAssignedActivity.mockResolvedValue({ activityType: { key: "mcq" }, assignment: {
      id: "assignment-1", metadata: { timeLimitMinutes: 30 }, availableUntil: new Date("2026-10-11T14:10:00.000Z")
    } });
    db.activityAttempt.findMany.mockResolvedValue([activeAttempt]);
    db.activityResponseDraft.findUnique.mockResolvedValue({ state: { answers: { q1: ["a"] } } });
    await expect(getTimedActivityRuntime(student, "course-1", "group-1", "activity-1")).resolves.toMatchObject({
      timing: { expiresAt: "2026-10-11T14:10:00.000Z", remainingSeconds: 0, isExpired: true }
    });
    await expect(assertTimedActivityWriteAllowed(student, "course-1", "group-1", "activity-1")).rejects.toMatchObject({ code: "ACTIVITY_TIME_LIMIT_EXPIRED" });
    await expect(assertTimedActivityWriteAllowed(student, "course-1", "group-1", "activity-1", { allowExpiredAttempt: true })).resolves.toBeUndefined();
    await finalizeExpiredTimedActivityAttempt(student, "course-1", "group-1", "activity-1");
    expect(gradebook.submitActivityAttempt).toHaveBeenCalledWith(student, expect.objectContaining({
      attemptId: activeAttempt.id, metadata: expect.objectContaining({ timedOut: true, savedResponse: { answers: { q1: ["a"] } } })
    }));
  });

  it("rejects a stale timeout after the teacher extends an already-expired Until date", async () => {
    const assignment = { id: "assignment-1", metadata: { timeLimitMinutes: 30 }, availableUntil: new Date("2026-10-11T14:05:00.000Z") };
    groups.getGroupAssignedActivity.mockResolvedValue({ activityType: { key: "mcq" }, assignment });
    db.activityAttempt.findMany.mockResolvedValue([activeAttempt]);
    await expect(getTimedActivityRuntime(student, "course-1", "group-1", "activity-1")).resolves.toMatchObject({ timing: { isExpired: true } });
    assignment.availableUntil = new Date("2026-10-11T14:20:00.000Z");
    await expect(getTimedActivityRuntime(student, "course-1", "group-1", "activity-1")).resolves.toMatchObject({ timing: { expiresAt: assignment.availableUntil.toISOString(), isExpired: false } });
    await expect(assertTimedActivityWriteAllowed(student, "course-1", "group-1", "activity-1")).resolves.toBeUndefined();
    await expect(finalizeExpiredTimedActivityAttempt(student, "course-1", "group-1", "activity-1")).rejects.toMatchObject({ code: "ACTIVITY_TIME_LIMIT_ACTIVE" });
    expect(gradebook.submitActivityAttempt).not.toHaveBeenCalled();
  });

  it("removes the running deadline when the assignment limit is disabled", async () => {
    groups.getGroupAssignedActivity.mockResolvedValue({
      activityType: { key: "mcq", providerKind: "plugin", providerKey: "mcq" },
      assignment: { id: "assignment-1", metadata: { timeLimitMinutes: null }, availableUntil: new Date("2026-10-11T14:05:00.000Z") }
    });
    db.activityAttempt.findMany.mockResolvedValue([activeAttempt]);

    await expect(getTimedActivityRuntime(student, "course-1", "group-1", "activity-1")).resolves.toMatchObject({
      timeLimitMinutes: null,
      timing: { expiresAt: null, remainingSeconds: null, isExpired: false }
    });
  });

  it("rejects learner writes after the live deadline", async () => {
    groups.getGroupAssignedActivity.mockResolvedValue({
      activityType: { key: "mcq", providerKind: "plugin", providerKey: "mcq" },
      assignment: { id: "assignment-1", metadata: { timeLimitMinutes: 5 } }
    });
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
    groups.getGroupAssignedActivity.mockResolvedValue({
      activityType: { key: "mcq", providerKind: "plugin", providerKey: "mcq" },
      assignment: { id: "assignment-1", metadata: { timeLimitMinutes: 5 } }
    });
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
  it("extends an expired initial limit from the original start and rejects stale timeout finalization", async () => {
    db.activityAttempt.findMany.mockResolvedValue([{ ...activeAttempt, metadata: { timedAttempt: true, timeLimitSnapshotMinutes: 5 } }]);
    await expect(getTimedActivityRuntime(student, "course-1", "group-1", "activity-1")).resolves.toMatchObject({
      timeLimitMinutes: 30, timing: { expiresAt: "2026-10-11T14:30:00.000Z", isExpired: false }
    });
    await expect(assertTimedActivityWriteAllowed(student, "course-1", "group-1", "activity-1")).resolves.toBeUndefined();
    await expect(finalizeExpiredTimedActivityAttempt(student, "course-1", "group-1", "activity-1"))
      .rejects.toMatchObject({ code: "ACTIVITY_TIME_LIMIT_ACTIVE" });
    expect(gradebook.submitActivityAttempt).not.toHaveBeenCalled();
  });

});
