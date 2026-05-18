import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CurrentUser } from "@cognelo/contracts";

const tx = vi.hoisted(() => ({
  activityAttempt: {
    create: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn()
  },
  grade: {
    findUnique: vi.fn(),
    upsert: vi.fn()
  },
  gradeEvent: {
    create: vi.fn()
  }
}));

const mockPrisma = vi.hoisted(() => ({
  $transaction: vi.fn(async (handler: (transaction: typeof tx) => unknown) => handler(tx)),
  activityAttempt: {
    count: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn()
  },
  courseGroupActivity: {
    findFirst: vi.fn()
  },
  courseGroupParticipant: {
    findFirst: vi.fn()
  }
}));

const authMocks = vi.hoisted(() => ({
  canManageCourse: vi.fn()
}));

vi.mock("@cognelo/db", () => ({
  prisma: mockPrisma
}));

vi.mock("./authorization", () => authMocks);

const { recordActivityAttemptGradingResult, startActivityAttempt, submitActivityAttempt } = await import("./gradebook");

const studentUser: CurrentUser = {
  id: "student-1",
  email: "student@example.test",
  name: "Student One",
  firstName: "Student",
  lastName: "One",
  roles: ["student"]
};

const teacherUser: CurrentUser = {
  id: "teacher-1",
  email: "teacher@example.test",
  name: "Ada Teacher",
  firstName: "Ada",
  lastName: "Teacher",
  roles: ["teacher"]
};

const groupActivity = {
  id: "assignment-1",
  groupId: "group-1",
  activityId: "activity-1",
  availableUntil: null,
  group: { courseId: "course-1" },
  activity: {
    id: "activity-1",
    activityVersionId: "version-1"
  },
  gradebookItem: {
    id: "gradebook-item-1",
    attemptLimitMode: "unlimited",
    maxAttempts: null,
    lateSubmissionsAllowed: false,
    lateGracePeriodMinutes: null
  }
};

const participant = {
  id: "participant-1",
  userId: "student-1"
};

describe("gradebook attempt services", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.$transaction.mockImplementation(async (handler: (transaction: typeof tx) => unknown) => handler(tx));
    mockPrisma.courseGroupActivity.findFirst.mockResolvedValue(groupActivity);
    mockPrisma.courseGroupParticipant.findFirst.mockResolvedValue(participant);
    mockPrisma.activityAttempt.count.mockResolvedValue(0);
    tx.activityAttempt.findFirst.mockResolvedValue({ attemptNumber: 2 });
    tx.activityAttempt.create.mockImplementation(async ({ data }) => ({ id: "attempt-3", ...data }));
    tx.activityAttempt.update.mockImplementation(async ({ data }) => ({ id: "attempt-1", ...data }));
    tx.grade.findUnique.mockResolvedValue(null);
    tx.grade.upsert.mockImplementation(async ({ create, update }) => ({ id: "grade-1", ...create, ...update }));
    tx.gradeEvent.create.mockResolvedValue({ id: "event-1" });
    authMocks.canManageCourse.mockResolvedValue(false);
  });

  it("starts a numbered core attempt for the current group participant", async () => {
    const now = new Date("2026-05-18T14:00:00.000Z");

    await expect(
      startActivityAttempt(studentUser, {
        courseId: "course-1",
        groupId: "group-1",
        activityId: "activity-1",
        pluginKey: "parsons",
        pluginVersion: "0.1.0",
        pluginAttemptRef: "plugin-attempt-1",
        activityConfigFingerprint: "fingerprint-1",
        now
      })
    ).resolves.toMatchObject({
      id: "attempt-3",
      attemptNumber: 3,
      participantId: "participant-1",
      pluginKey: "parsons",
      pluginAttemptRef: "plugin-attempt-1"
    });

    expect(mockPrisma.courseGroupParticipant.findFirst).toHaveBeenCalledWith({
      where: { groupId: "group-1", userId: "student-1" }
    });
    expect(tx.activityAttempt.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        courseId: "course-1",
        groupId: "group-1",
        groupActivityId: "assignment-1",
        activityId: "activity-1",
        gradebookItemId: "gradebook-item-1",
        participantId: "participant-1",
        userId: "student-1",
        attemptNumber: 3,
        startedAt: now,
        activityVersionId: "version-1"
      })
    });
  });

  it("rejects a new attempt when the gradebook item max attempt limit is reached", async () => {
    mockPrisma.courseGroupActivity.findFirst.mockResolvedValue({
      ...groupActivity,
      gradebookItem: {
        ...groupActivity.gradebookItem,
        attemptLimitMode: "max_attempts",
        maxAttempts: 2
      }
    });
    mockPrisma.activityAttempt.count.mockResolvedValue(2);

    await expect(
      startActivityAttempt(studentUser, {
        courseId: "course-1",
        groupId: "group-1",
        activityId: "activity-1",
        pluginKey: "parsons",
        pluginVersion: "0.1.0"
      })
    ).rejects.toMatchObject({ code: "ATTEMPT_LIMIT_REACHED" });
    expect(tx.activityAttempt.create).not.toHaveBeenCalled();
  });

  it("computes lateness when submitting an attempt after available until and grace", async () => {
    mockPrisma.activityAttempt.findUnique.mockResolvedValue({
      id: "attempt-1",
      courseId: "course-1",
      participant,
      participantId: "participant-1",
      userId: "student-1",
      lifecycle: "started",
      startedAt: new Date("2026-05-18T14:00:00.000Z"),
      pluginAttemptRef: null,
      groupActivity: {
        availableUntil: new Date("2026-05-18T15:00:00.000Z")
      },
      gradebookItem: {
        lateGracePeriodMinutes: 10
      }
    });
    mockPrisma.activityAttempt.update.mockImplementation(async ({ data }) => ({ id: "attempt-1", ...data }));

    await expect(
      submitActivityAttempt(studentUser, {
        attemptId: "attempt-1",
        now: new Date("2026-05-18T15:15:30.000Z")
      })
    ).resolves.toMatchObject({
      lifecycle: "submitted",
      durationSeconds: 4530,
      isLate: true,
      lateBySeconds: 330
    });
  });

  it("records a grading result, grades the attempt, and writes an audit event", async () => {
    authMocks.canManageCourse.mockResolvedValueOnce(true);
    mockPrisma.activityAttempt.findUnique.mockResolvedValue({
      id: "attempt-1",
      courseId: "course-1",
      gradebookItemId: "gradebook-item-1",
      participantId: "participant-1",
      userId: "student-1",
      submittedAt: new Date("2026-05-18T15:00:00.000Z"),
      participant,
      gradebookItem: { id: "gradebook-item-1" }
    });

    const now = new Date("2026-05-18T15:01:00.000Z");
    await expect(
      recordActivityAttemptGradingResult(teacherUser, {
        attemptId: "attempt-1",
        rawScore: 8,
        rawMaxScore: 10,
        normalizedScore: 80,
        normalizedMaxScore: 100,
        source: "auto",
        rawResult: { passed: 8 },
        normalizedResult: { percent: 80 },
        now
      })
    ).resolves.toMatchObject({
      attempt: { lifecycle: "graded", gradedAt: now },
      grade: { rawScore: 8, normalizedScore: 80 }
    });

    expect(authMocks.canManageCourse).toHaveBeenCalledWith(teacherUser, "course-1");
    expect(tx.grade.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { gradebookItemId_participantId: { gradebookItemId: "gradebook-item-1", participantId: "participant-1" } },
        create: expect.objectContaining({
          selectedAttemptId: "attempt-1",
          rawScore: 8,
          normalizedScore: 80,
          source: "auto"
        })
      })
    );
    expect(tx.gradeEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        gradeId: "grade-1",
        eventType: "auto_graded",
        actorUserId: "teacher-1",
        attemptId: "attempt-1",
        createdAt: now
      })
    });
  });
});
