import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CurrentUser } from "@cognelo/contracts";

const tx = vi.hoisted(() => ({
  activityAttempt: {
    create: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn()
  },
  grade: {
    delete: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
    upsert: vi.fn()
  },
  gradeEvent: {
    create: vi.fn(),
    findMany: vi.fn()
  },
  gradebookItem: {
    update: vi.fn()
  }
}));

const mockPrisma = vi.hoisted(() => ({
  $transaction: vi.fn(async (handler: (transaction: typeof tx) => unknown) => handler(tx)),
  activityAttempt: {
    count: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn()
  },
  courseGroupActivity: {
    findFirst: vi.fn(),
    findMany: vi.fn()
  },
  courseGroupParticipant: {
    findFirst: vi.fn()
  },
  courseGroup: {
    findFirst: vi.fn()
  },
  gradebookItem: {
    createMany: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    upsert: vi.fn()
  }
}));

const authMocks = vi.hoisted(() => ({
  assertCanViewCourse: vi.fn(),
  canManageCourse: vi.fn(),
  isAdmin: vi.fn()
}));

vi.mock("@cognelo/db", () => ({
  prisma: mockPrisma
}));

vi.mock("./authorization", () => authMocks);

const {
  getActivityAttemptRegradeContext,
  getCourseGradebook,
  getStudentReleasedGrades,
  deleteActivitySubmission,
  overrideGradebookGrade,
  recordActivityAttemptGradingResult,
  setGradebookItemRelease,
  startActivityAttempt,
  submitActivityAttempt
} = await import("./gradebook");

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
    pointsPossible: 100,
    gradingMode: "points",
    passThresholdPoints: null,
    passThresholdOutOf: null,
    attemptLimitMode: "unlimited",
    maxAttempts: null,
    gradeStrategy: "latest",
    dropLowestAttempt: false,
    lateSubmissionsAllowed: false,
    latePenaltyPercent: null,
    latePenaltyIntervalMinutes: null,
    latePenaltyMaxPercent: null,
    lateGracePeriodMinutes: null
  }
};

const participant = {
  id: "participant-1",
  userId: "student-1"
};
const testNow = new Date("2026-05-18T15:00:00.000Z");

describe("gradebook attempt services", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.$transaction.mockImplementation(async (handler: (transaction: typeof tx) => unknown) => handler(tx));
    mockPrisma.courseGroupActivity.findFirst.mockResolvedValue(groupActivity);
    mockPrisma.courseGroupParticipant.findFirst.mockResolvedValue(participant);
    mockPrisma.activityAttempt.count.mockResolvedValue(0);
    mockPrisma.gradebookItem.findMany.mockResolvedValue([]);
    mockPrisma.gradebookItem.upsert.mockResolvedValue({ id: "gradebook-item-1" });
    mockPrisma.courseGroupActivity.findMany.mockResolvedValue([]);
    tx.activityAttempt.findFirst.mockResolvedValue({ attemptNumber: 2 });
    tx.activityAttempt.create.mockImplementation(async ({ data }) => ({ id: "attempt-3", ...data }));
    tx.activityAttempt.update.mockImplementation(async ({ data }) => ({ id: "attempt-1", ...data }));
    tx.grade.findUnique.mockResolvedValue(null);
    tx.grade.update.mockImplementation(async ({ data }) => ({ id: "grade-1", ...data }));
    tx.grade.delete.mockResolvedValue({ id: "grade-1" });
    tx.grade.upsert.mockImplementation(async ({ create, update }) => ({ id: "grade-1", ...create, ...update }));
    tx.gradeEvent.create.mockResolvedValue({ id: "event-1" });
    tx.gradeEvent.findMany.mockResolvedValue([]);
    tx.gradebookItem.update.mockImplementation(async ({ data }) => ({ id: "gradebook-item-1", ...data }));
    authMocks.canManageCourse.mockResolvedValue(false);
    authMocks.assertCanViewCourse.mockResolvedValue(undefined);
    authMocks.isAdmin.mockReturnValue(false);
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
      attemptNumber: 1,
      isLate: false,
      lateBySeconds: null,
      submittedAt: new Date("2026-05-18T15:00:00.000Z"),
      participant,
      gradebookItem: {
        ...groupActivity.gradebookItem,
        id: "gradebook-item-1"
      }
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
          normalizedMaxScore: 100,
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

  it("normalizes raw scores, computes pass/fail, and applies late penalties", async () => {
    authMocks.canManageCourse.mockResolvedValueOnce(true);
    mockPrisma.activityAttempt.findUnique.mockResolvedValue({
      id: "attempt-1",
      courseId: "course-1",
      gradebookItemId: "gradebook-item-1",
      participantId: "participant-1",
      userId: "student-1",
      attemptNumber: 1,
      isLate: true,
      lateBySeconds: 7200,
      submittedAt: new Date("2026-05-18T15:00:00.000Z"),
      participant,
      gradebookItem: {
        ...groupActivity.gradebookItem,
        gradingMode: "pass_fail",
        passThresholdPoints: 60,
        passThresholdOutOf: 100,
        latePenaltyPercent: 10,
        latePenaltyIntervalMinutes: 60,
        latePenaltyMaxPercent: 15
      }
    });

    await expect(
      recordActivityAttemptGradingResult(teacherUser, {
        attemptId: "attempt-1",
        rawScore: 8,
        rawMaxScore: 10,
        source: "auto"
      })
    ).resolves.toMatchObject({
      grade: {
        rawScore: 8,
        rawMaxScore: 10,
        normalizedScore: 68,
        normalizedMaxScore: 100,
        isPass: true,
        latePenaltyApplied: true,
        latePenaltyPercent: 15
      }
    });
  });

  it("selects the best graded attempt from grade events", async () => {
    authMocks.canManageCourse.mockResolvedValueOnce(true);
    tx.gradeEvent.findMany.mockResolvedValue([
      {
        attemptId: "attempt-1",
        nextValue: {
          attemptId: "attempt-1",
          attemptNumber: 1,
          rawScore: 5,
          rawMaxScore: 10,
          normalizedScore: 50,
          normalizedMaxScore: 100,
          isPass: null
        }
      }
    ]);
    mockPrisma.activityAttempt.findUnique.mockResolvedValue({
      id: "attempt-2",
      courseId: "course-1",
      gradebookItemId: "gradebook-item-1",
      participantId: "participant-1",
      userId: "student-1",
      attemptNumber: 2,
      isLate: false,
      lateBySeconds: null,
      submittedAt: new Date("2026-05-18T15:00:00.000Z"),
      participant,
      gradebookItem: {
        ...groupActivity.gradebookItem,
        gradeStrategy: "best"
      }
    });

    await recordActivityAttemptGradingResult(teacherUser, {
      attemptId: "attempt-2",
      rawScore: 4,
      rawMaxScore: 10,
      source: "auto"
    });

    expect(tx.grade.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          selectedAttemptId: "attempt-1",
          normalizedScore: 50
        })
      })
    );
  });

  it("selects a weighted average grade and can drop the lowest attempt", async () => {
    authMocks.canManageCourse.mockResolvedValueOnce(true);
    tx.gradeEvent.findMany.mockResolvedValue([
      {
        attemptId: "attempt-1",
        nextValue: {
          attemptId: "attempt-1",
          attemptNumber: 1,
          rawScore: 4,
          rawMaxScore: 10,
          normalizedScore: 40,
          normalizedMaxScore: 100,
          isPass: null
        }
      },
      {
        attemptId: "attempt-2",
        nextValue: {
          attemptId: "attempt-2",
          attemptNumber: 2,
          rawScore: 7,
          rawMaxScore: 10,
          normalizedScore: 70,
          normalizedMaxScore: 100,
          isPass: null
        }
      }
    ]);
    mockPrisma.activityAttempt.findUnique.mockResolvedValue({
      id: "attempt-3",
      courseId: "course-1",
      gradebookItemId: "gradebook-item-1",
      participantId: "participant-1",
      userId: "student-1",
      attemptNumber: 3,
      isLate: false,
      lateBySeconds: null,
      submittedAt: new Date("2026-05-18T15:00:00.000Z"),
      participant,
      gradebookItem: {
        ...groupActivity.gradebookItem,
        gradeStrategy: "weighted_average",
        dropLowestAttempt: true
      }
    });

    await recordActivityAttemptGradingResult(teacherUser, {
      attemptId: "attempt-3",
      rawScore: 10,
      rawMaxScore: 10,
      source: "auto"
    });

    expect(tx.grade.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          selectedAttemptId: "attempt-3",
          rawScore: 85,
          rawMaxScore: 100,
          normalizedScore: 85,
          normalizedMaxScore: 100
        })
      })
    );
  });

  it("lists course gradebook rows for student participants and filters missing work", async () => {
    authMocks.canManageCourse.mockResolvedValueOnce(true);
    mockPrisma.gradebookItem.findMany.mockResolvedValue([
      {
        id: "gradebook-item-1",
        titleSnapshot: "Loops",
        pointsPossible: 100,
        group: {
          id: "group-1",
          title: "Section A",
          participants: [
            {
              id: "participant-1",
              firstName: "Student",
              lastName: "One",
              email: "student@example.test",
              externalId: "S001",
              user: null
            }
          ]
        },
        activity: {
          id: "activity-1",
          title: "Loops",
          activityType: { key: "parsons-problem", name: "Parsons problem" }
        },
        groupActivity: {
          id: "assignment-1",
          availableFrom: null,
          availableUntil: null
        },
        grades: [],
        attempts: []
      },
      {
        id: "gradebook-item-2",
        titleSnapshot: "Branches",
        pointsPossible: 100,
        group: {
          id: "group-1",
          title: "Section A",
          participants: [
            {
              id: "participant-1",
              firstName: "Student",
              lastName: "One",
              email: "student@example.test",
              externalId: "S001",
              user: null
            }
          ]
        },
        activity: {
          id: "activity-2",
          title: "Branches",
          activityType: { key: "parsons-problem", name: "Parsons problem" }
        },
        groupActivity: {
          id: "assignment-2",
          availableFrom: null,
          availableUntil: null
        },
        grades: [
          {
            participantId: "participant-1",
            normalizedScore: 92,
            normalizedMaxScore: 100,
            isPass: null,
            latePenaltyApplied: false,
            latePenaltyPercent: null,
            selectedAttempt: { attemptNumber: 1, isLate: false }
          }
        ],
        attempts: [
          {
            id: "attempt-1",
            participantId: "participant-1",
            attemptNumber: 1,
            lifecycle: "graded",
            startedAt: testNow,
            submittedAt: testNow,
            gradedAt: testNow,
            isLate: false,
            lateBySeconds: null,
            durationSeconds: 60
          }
        ]
      }
    ]);

    await expect(getCourseGradebook(teacherUser, "course-1", { status: "missing" })).resolves.toMatchObject({
      rows: [
        {
          gradebookItemId: "gradebook-item-1",
          groupTitle: "Section A",
          activityTitle: "Loops",
          participantName: "Student One",
          status: "missing",
          score: null,
          maxScore: 100
        }
      ]
    });
  });

  it("treats stale attempt-derived grades as missing when every submission was deleted", async () => {
    authMocks.canManageCourse.mockResolvedValueOnce(true);
    mockPrisma.gradebookItem.findMany.mockResolvedValue([
      {
        id: "gradebook-item-1",
        titleSnapshot: "Loops",
        pointsPossible: 100,
        group: {
          id: "group-1",
          title: "Section A",
          participants: [
            {
              id: "participant-1",
              firstName: "Student",
              lastName: "One",
              email: "student@example.test",
              externalId: "S001",
              user: null
            }
          ]
        },
        activity: {
          id: "activity-1",
          title: "Loops",
          activityType: { key: "parsons-problem", name: "Parsons problem" }
        },
        groupActivity: {
          id: "assignment-1",
          availableFrom: null,
          availableUntil: null
        },
        grades: [
          {
            participantId: "participant-1",
            normalizedScore: 100,
            normalizedMaxScore: 100,
            isPass: null,
            latePenaltyApplied: false,
            latePenaltyPercent: null,
            source: "auto",
            normalizedResult: {},
            selectedAttempt: null
          }
        ],
        attempts: [
          {
            id: "attempt-1",
            participantId: "participant-1",
            attemptNumber: 1,
            lifecycle: "deleted",
            startedAt: testNow,
            submittedAt: testNow,
            gradedAt: testNow,
            isLate: false,
            lateBySeconds: null,
            durationSeconds: 60,
            pluginAttemptRef: "plugin-attempt-1"
          }
        ],
        events: []
      }
    ]);

    await expect(getCourseGradebook(teacherUser, "course-1")).resolves.toMatchObject({
      rows: [
        {
          gradebookItemId: "gradebook-item-1",
          status: "missing",
          score: null,
          submittedAttemptCount: 0,
          attempts: []
        }
      ]
    });
  });

  it("backfills missing gradebook items from existing group activity assignments before listing", async () => {
    authMocks.canManageCourse.mockResolvedValueOnce(true);
    mockPrisma.courseGroupActivity.findMany.mockResolvedValue([
      {
        id: "assignment-1",
        groupId: "group-1",
        activityId: "activity-1",
        group: { courseId: "course-1" },
        activity: { id: "activity-1", title: "Existing activity" }
      }
    ]);

    await getCourseGradebook(teacherUser, "course-1");

    expect(mockPrisma.courseGroupActivity.findMany).toHaveBeenCalledWith({
      where: {
        group: { courseId: "course-1" },
        gradebookItem: null
      },
      include: {
        group: { select: { courseId: true } },
        activity: { select: { id: true, title: true } }
      }
    });
    expect(mockPrisma.gradebookItem.createMany).toHaveBeenCalledWith({
      data: [
        {
          courseId: "course-1",
          groupId: "group-1",
          groupActivityId: "assignment-1",
          activityId: "activity-1",
          titleSnapshot: "Existing activity"
        }
      ],
      skipDuplicates: true
    });
  });

  it("backfills gradebook items with duplicate skipping to tolerate concurrent listing requests", async () => {
    authMocks.canManageCourse.mockResolvedValueOnce(true);
    mockPrisma.courseGroupActivity.findMany.mockResolvedValue([
      {
        id: "assignment-1",
        groupId: "group-1",
        activityId: "activity-1",
        group: { courseId: "course-1" },
        activity: { id: "activity-1", title: "Existing activity" }
      },
      {
        id: "assignment-2",
        groupId: "group-1",
        activityId: "activity-2",
        group: { courseId: "course-1" },
        activity: { id: "activity-2", title: "Second activity" }
      }
    ]);

    await getCourseGradebook(teacherUser, "course-1");

    expect(mockPrisma.gradebookItem.createMany).toHaveBeenCalledWith({
      data: [
        {
          courseId: "course-1",
          groupId: "group-1",
          groupActivityId: "assignment-1",
          activityId: "activity-1",
          titleSnapshot: "Existing activity"
        },
        {
          courseId: "course-1",
          groupId: "group-1",
          groupActivityId: "assignment-2",
          activityId: "activity-2",
          titleSnapshot: "Second activity"
        }
      ],
      skipDuplicates: true
    });
    expect(mockPrisma.gradebookItem.upsert).not.toHaveBeenCalledWith({
      where: { groupActivityId: "assignment-1" },
      update: {},
      create: {
        courseId: "course-1",
        groupId: "group-1",
        groupActivityId: "assignment-1",
        activityId: "activity-1",
        titleSnapshot: "Existing activity"
      }
    });
  });

  it("soft-deletes a submission with an audit event and removes the selected grade", async () => {
    authMocks.canManageCourse.mockResolvedValueOnce(true);
    const submittedAttempt = {
      id: "attempt-1",
      courseId: "course-1",
      groupId: "group-1",
      groupActivityId: "assignment-1",
      activityId: "activity-1",
      gradebookItemId: "gradebook-item-1",
      participantId: "participant-1",
      userId: "student-1",
      attemptNumber: 1,
      lifecycle: "graded",
      startedAt: testNow,
      submittedAt: testNow,
      gradedAt: testNow,
      durationSeconds: 60,
      isLate: false,
      lateBySeconds: null,
      pluginKey: "parsons",
      pluginVersion: "0.1.0",
      pluginAttemptRef: "plugin-attempt-1",
      metadata: { answer: "submitted state" },
      participant,
      gradebookItem: groupActivity.gradebookItem
    };
    mockPrisma.activityAttempt.findFirst.mockResolvedValueOnce(submittedAttempt);
    tx.grade.findUnique.mockResolvedValueOnce({
      id: "grade-1",
      selectedAttemptId: "attempt-1",
      rawScore: 80,
      rawMaxScore: 100,
      normalizedScore: 80,
      normalizedMaxScore: 100,
      isPass: true,
      latePenaltyApplied: false,
      latePenaltyPercent: null,
      source: "auto",
      metadata: {}
    });
    tx.gradeEvent.findMany.mockResolvedValueOnce([
      {
        attemptId: "attempt-1",
        nextValue: {
          attemptId: "attempt-1",
          attemptNumber: 1,
          rawScore: 80,
          rawMaxScore: 100,
          normalizedScore: 80,
          normalizedMaxScore: 100
        }
      }
    ]);
    tx.activityAttempt.update.mockResolvedValueOnce({ ...submittedAttempt, lifecycle: "deleted" });

    await deleteActivitySubmission(teacherUser, "course-1", {
      attemptId: "attempt-1",
      reason: "Submitted wrong file",
      now: testNow
    });

    expect(tx.activityAttempt.update).toHaveBeenCalledWith({
      where: { id: "attempt-1" },
      data: {
        lifecycle: "deleted",
        metadata: {
          answer: "submitted state",
          deletion: {
            deletedAt: testNow.toISOString(),
            deletedByUserId: "teacher-1",
            reason: "Submitted wrong file"
          }
        }
      }
    });
    expect(tx.grade.delete).toHaveBeenCalledWith({ where: { id: "grade-1" } });
    expect(tx.gradeEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          eventType: "submission_deleted",
          reason: "Submitted wrong file",
          previousValue: expect.objectContaining({
            attempt: expect.objectContaining({
              id: "attempt-1",
              pluginAttemptRef: "plugin-attempt-1",
              metadata: { answer: "submitted state" }
            })
          })
        })
      })
    );
  });

  it("replaces a stale attempt-derived grade with the next remaining submission when selected attempt is missing", async () => {
    authMocks.canManageCourse.mockResolvedValueOnce(true);
    const submittedAttempt = {
      id: "attempt-1",
      courseId: "course-1",
      groupId: "group-1",
      groupActivityId: "assignment-1",
      activityId: "activity-1",
      gradebookItemId: "gradebook-item-1",
      participantId: "participant-1",
      userId: "student-1",
      attemptNumber: 1,
      lifecycle: "graded",
      startedAt: testNow,
      submittedAt: testNow,
      gradedAt: testNow,
      durationSeconds: 60,
      isLate: false,
      lateBySeconds: null,
      pluginKey: "parsons",
      pluginVersion: "0.1.0",
      pluginAttemptRef: "plugin-attempt-1",
      metadata: {},
      participant,
      gradebookItem: groupActivity.gradebookItem
    };
    mockPrisma.activityAttempt.findFirst.mockResolvedValueOnce(submittedAttempt);
    tx.grade.findUnique.mockResolvedValueOnce({
      id: "grade-1",
      selectedAttemptId: null,
      rawScore: 100,
      rawMaxScore: 100,
      normalizedScore: 100,
      normalizedMaxScore: 100,
      isPass: true,
      latePenaltyApplied: false,
      latePenaltyPercent: null,
      source: "auto",
      metadata: {}
    });
    tx.gradeEvent.findMany.mockResolvedValueOnce([
      {
        attemptId: "attempt-1",
        nextValue: {
          attemptId: "attempt-1",
          attemptNumber: 1,
          rawScore: 100,
          rawMaxScore: 100,
          normalizedScore: 100,
          normalizedMaxScore: 100
        }
      },
      {
        attemptId: "attempt-2",
        nextValue: {
          attemptId: "attempt-2",
          attemptNumber: 2,
          rawScore: 90,
          rawMaxScore: 100,
          normalizedScore: 90,
          normalizedMaxScore: 100
        }
      }
    ]);
    tx.activityAttempt.update.mockResolvedValueOnce({ ...submittedAttempt, lifecycle: "deleted" });

    await deleteActivitySubmission(teacherUser, "course-1", {
      attemptId: "attempt-1",
      reason: "Submitted wrong file",
      now: testNow
    });

    expect(tx.grade.update).toHaveBeenCalledWith({
      where: { id: "grade-1" },
      data: expect.objectContaining({
        selectedAttemptId: "attempt-2",
        normalizedScore: 90,
        normalizedMaxScore: 100,
        source: "manual",
        metadata: { selectedAfterSubmissionDeletion: true }
      })
    });
    expect(tx.grade.delete).not.toHaveBeenCalled();
  });

  it("releases a gradebook item and writes a visibility audit event", async () => {
    authMocks.canManageCourse.mockResolvedValueOnce(true);
    mockPrisma.gradebookItem.findFirst.mockResolvedValue({
      id: "gradebook-item-1",
      gradesReleased: false,
      courseId: "course-1",
      groupId: "group-1",
      activityId: "activity-1",
      titleSnapshot: "Loops",
      group: {
        participants: [{ id: "participant-1" }]
      }
    });
    const now = new Date("2026-05-19T12:00:00.000Z");

    await expect(
      setGradebookItemRelease(teacherUser, "course-1", "gradebook-item-1", {
        released: true,
        now
      })
    ).resolves.toMatchObject({ gradesReleased: true });

    expect(tx.gradebookItem.update).toHaveBeenCalledWith({
      where: { id: "gradebook-item-1" },
      data: { gradesReleased: true }
    });
    expect(tx.gradeEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        gradebookItemId: "gradebook-item-1",
        participantId: "participant-1",
        actorUserId: "teacher-1",
        eventType: "released",
        previousValue: { gradesReleased: false },
        nextValue: { gradesReleased: true },
        createdAt: now
      })
    });
  });

  it("overrides a participant grade and writes an override audit event", async () => {
    authMocks.canManageCourse.mockResolvedValueOnce(true);
    mockPrisma.gradebookItem.findFirst.mockResolvedValue({
      id: "gradebook-item-1",
      courseId: "course-1",
      pointsPossible: 100,
      gradingMode: "points",
      passThresholdPoints: null,
      passThresholdOutOf: null,
      gradeStrategy: "latest",
      dropLowestAttempt: false,
      latePenaltyPercent: null,
      latePenaltyIntervalMinutes: null,
      latePenaltyMaxPercent: null,
      group: {
        participants: [{ id: "participant-1", userId: "student-1" }]
      }
    });
    tx.grade.findUnique.mockResolvedValue({
      selectedAttemptId: "attempt-1",
      rawScore: 80,
      rawMaxScore: 100,
      normalizedScore: 80,
      normalizedMaxScore: 100,
      isPass: null,
      latePenaltyApplied: false,
      latePenaltyPercent: null,
      source: "auto"
    });
    const now = new Date("2026-05-19T13:00:00.000Z");

    await expect(
      overrideGradebookGrade(teacherUser, "course-1", {
        gradebookItemId: "gradebook-item-1",
        participantId: "participant-1",
        score: 93,
        reason: "Manual review",
        feedbackText: "Good recovery after the ordering issue.",
        now
      })
    ).resolves.toMatchObject({
      source: "override",
      normalizedScore: 93,
      normalizedMaxScore: 100
    });

    expect(tx.grade.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { gradebookItemId_participantId: { gradebookItemId: "gradebook-item-1", participantId: "participant-1" } },
        update: expect.objectContaining({
          selectedAttemptId: null,
          normalizedScore: 93,
          source: "override",
          normalizedResult: expect.objectContaining({
            studentFeedback: expect.objectContaining({
              feedbackText: "Good recovery after the ordering issue."
            })
          })
        })
      })
    );
    expect(tx.gradeEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        gradebookItemId: "gradebook-item-1",
        participantId: "participant-1",
        actorUserId: "teacher-1",
        eventType: "overridden",
        reason: "Manual review",
        previousValue: expect.objectContaining({ normalizedScore: 80 }),
        nextValue: expect.objectContaining({ normalizedScore: 93 }),
        createdAt: now
      })
    });
  });

  it("returns plugin grading context for an existing activity attempt", async () => {
    authMocks.canManageCourse.mockResolvedValueOnce(true);
    mockPrisma.activityAttempt.findFirst.mockResolvedValue({
      id: "attempt-1",
      courseId: "course-1",
      groupId: "group-1",
      activityId: "activity-1",
      pluginAttemptRef: "plugin-attempt-1",
      activity: {
        id: "activity-1",
        bankActivityId: null,
        activityVersionId: "version-1",
        title: "Loops",
        description: "Reorder the loop.",
        lifecycle: "published",
        config: { prompt: "Build it" },
        metadata: {},
        activityType: {
          key: "parsons-problem",
          name: "Parsons problem",
          description: "Reorder code"
        }
      },
      groupActivity: {
        id: "assignment-1",
        availableFrom: null,
        availableUntil: null,
        config: {},
        metadata: { assessmentMode: "summative" },
        position: 0
      }
    });

    await expect(getActivityAttemptRegradeContext(teacherUser, "course-1", "attempt-1")).resolves.toMatchObject({
      attemptId: "attempt-1",
      pluginAttemptRef: "plugin-attempt-1",
      activityTypeKey: "parsons-problem",
      activity: {
        id: "activity-1",
        assignment: { id: "assignment-1" }
      }
    });
  });

  it("returns only released student grade summaries without attempt history details", async () => {
    mockPrisma.courseGroup.findFirst.mockResolvedValue({
      id: "group-1",
      courseId: "course-1",
      status: "published",
      availableFrom: null,
      availableUntil: null
    });
    mockPrisma.courseGroupParticipant.findFirst
      .mockResolvedValueOnce({ id: "participant-1", userId: "student-1", role: "student" })
      .mockResolvedValueOnce({ id: "participant-1", userId: "student-1", role: "student" });
    mockPrisma.gradebookItem.findMany.mockResolvedValue([
      {
        id: "gradebook-item-1",
        titleSnapshot: "Loops",
        pointsPossible: 100,
        activity: {
          id: "activity-1",
          title: "Loops",
          activityType: { key: "parsons-problem", name: "Parsons problem" }
        },
        groupActivity: {
          availableFrom: null,
          availableUntil: null
        },
        grades: [
          {
            normalizedScore: 88,
            normalizedMaxScore: 100,
            isPass: null,
            latePenaltyApplied: false,
            latePenaltyPercent: null,
            gradedAt: testNow,
            normalizedResult: {
              studentFeedback: {
                kind: "parsons",
                messages: [{ type: "order", count: 2 }],
                grading: [
                  { type: "order", awardedRaw: 0, possibleRaw: 0.7 },
                  { type: "indentation", awardedRaw: 0.3, possibleRaw: 0.3 }
                ],
                rawPayloadIgnored: true
              }
            },
            selectedAttempt: { attemptNumber: 2, isLate: false }
          }
        ],
        attempts: [
          {
            participantId: "participant-1",
            attemptNumber: 1,
            lifecycle: "graded",
            isLate: false
          },
          {
            participantId: "participant-1",
            attemptNumber: 2,
            lifecycle: "graded",
            isLate: false
          }
        ]
      }
    ]);

    await expect(getStudentReleasedGrades(studentUser, "course-1", "group-1")).resolves.toEqual({
      rows: [
        {
          gradebookItemId: "gradebook-item-1",
          activityId: "activity-1",
          activityTitle: "Loops",
          activityTypeName: "Parsons problem",
          status: "graded",
          score: 88,
          maxScore: 100,
          isPass: null,
          latePenaltyApplied: false,
          latePenaltyPercent: null,
          feedback: {
            kind: "parsons",
            feedbackText: null,
            messages: [{ type: "order", count: 2 }],
            grading: [
              { type: "order", awardedRaw: 0, possibleRaw: 0.7 },
              { type: "indentation", awardedRaw: 0.3, possibleRaw: 0.3 }
            ]
          },
          selectedAttemptNumber: 2,
          attemptCount: 2,
          submittedAttemptCount: 2,
          deletedSubmissions: [],
          availableFrom: null,
          availableUntil: null,
          gradedAt: testNow.toISOString()
        }
      ]
    });
    expect(mockPrisma.gradebookItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          courseId: "course-1",
          groupId: "group-1",
          gradesReleased: true
        }
      })
    );
  });
});
