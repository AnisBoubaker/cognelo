import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CurrentUser } from "@cognelo/contracts";

const db = vi.hoisted(() => ({
  courseGroupParticipant: { findFirst: vi.fn() },
  test: { findFirst: vi.fn() },
  activityAttempt: { findMany: vi.fn(), findFirst: vi.fn() },
  testItemAttempt: { findUnique: vi.fn(), upsert: vi.fn() }
}));

const gradebook = vi.hoisted(() => ({
  getActivityAttemptAvailability: vi.fn(),
  startActivityAttempt: vi.fn(),
  submitActivityAttempt: vi.fn()
}));

const groups = vi.hoisted(() => ({ getGroupAssignedActivity: vi.fn() }));
const sdk = vi.hoisted(() => ({ getActivityDefinition: vi.fn() }));

vi.mock("@cognelo/db", () => ({ prisma: db, Prisma: {} }));
vi.mock("@cognelo/activity-sdk", () => sdk);
vi.mock("./gradebook", () => gradebook);
vi.mock("./groups", () => groups);

import {
  getTestItemExecutionContext,
  saveTestItemAttemptState,
  startOrResumeTestAttempt,
  submitTestAttempt,
  submitTestItemAttemptResult
} from "./test-execution";

const student: CurrentUser = {
  id: "student-1",
  email: "student@example.test",
  name: null,
  firstName: null,
  lastName: null,
  roles: ["student"]
};

const childActivity = {
  id: "mcq-1",
  courseId: "course-1",
  bankActivityId: null,
  activityVersionId: null,
  title: "Knowledge check",
  description: "",
  lifecycle: "published",
  config: { source: "## One\n\n- [x] Yes\n- [ ] No" },
  metadata: {},
  position: 0,
  activityTypeId: "type-mcq",
  activityType: { id: "type-mcq", key: "mcq", name: "MCQ", description: "" }
};

const testRecord = {
  id: "test-1",
  courseId: "course-1",
  activityId: "test-activity-1",
  settings: { timeLimitMinutes: null, navigationMode: "free", randomizeItems: false, allowResume: true },
  activity: {
    id: "test-activity-1",
    title: "Midterm",
    description: "Read carefully.",
    lifecycle: "published",
    config: {},
    metadata: {},
    activityType: { id: "type-test", key: "test", name: "Test", description: "" }
  },
  items: [{
    id: "item-1",
    testId: "test-1",
    activityId: "mcq-1",
    position: 0,
    pointsPossible: 10,
    isRequired: true,
    metadata: {},
    createdAt: new Date("2026-08-07T10:00:00.000Z"),
    updatedAt: new Date("2026-08-07T10:00:00.000Z"),
    activity: childActivity
  }]
};

function parentAttempt(overrides: Record<string, unknown> = {}) {
  return {
    id: "parent-attempt-1",
    courseId: "course-1",
    groupId: "group-1",
    activityId: "test-activity-1",
    participantId: "participant-1",
    attemptNumber: 1,
    lifecycle: "started",
    pluginKey: "core:test",
    pluginVersion: "0.1.0",
    pluginAttemptRef: null,
    activityConfigFingerprint: "fingerprint",
    metadata: {
      manifest: {
        items: [{ testItemId: "item-1", activityId: "mcq-1", isRequired: true }]
      }
    },
    startedAt: new Date("2026-08-07T10:00:00.000Z"),
    submittedAt: null,
    gradedAt: null,
    createdAt: new Date("2026-08-07T10:00:00.000Z"),
    updatedAt: new Date("2026-08-07T10:00:00.000Z"),
    ...overrides
  };
}

describe("compound Test execution", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    groups.getGroupAssignedActivity.mockResolvedValue({
      id: "assignment-1",
      activityType: { key: "test" }
    });
    db.courseGroupParticipant.findFirst.mockResolvedValue({ id: "participant-1" });
    db.test.findFirst.mockResolvedValue(testRecord);
    sdk.getActivityDefinition.mockReturnValue({ grading: { supportsCompositeExecution: true } });
    gradebook.getActivityAttemptAvailability.mockResolvedValue({
      canStart: true,
      reason: null,
      attemptsRemaining: 1
    });
    db.testItemAttempt.findUnique.mockResolvedValue(null);
  });

  it("starts one generic parent attempt with a stable child manifest", async () => {
    db.activityAttempt.findFirst.mockResolvedValue(null);
    db.activityAttempt.findMany.mockResolvedValue([parentAttempt({ testItemAttempts: [] })]);

    const runtime = await startOrResumeTestAttempt(student, "course-1", "group-1", "test-activity-1");

    expect(gradebook.startActivityAttempt).toHaveBeenCalledWith(student, expect.objectContaining({
      activityId: "test-activity-1",
      pluginKey: "core:test",
      metadata: expect.objectContaining({
        runtimeHandlerKey: "core:test",
        manifest: expect.objectContaining({
          items: [expect.objectContaining({ testItemId: "item-1", activityTypeKey: "mcq" })]
        })
      })
    }));
    expect(runtime.test.items).toHaveLength(1);
    expect(runtime.attempt?.id).toBe("parent-attempt-1");
  });

  it("saves plugin-neutral item state and stores a weighted grading result", async () => {
    db.activityAttempt.findFirst.mockResolvedValue(parentAttempt());
    db.testItemAttempt.upsert
      .mockResolvedValueOnce({ id: "item-attempt-1", lifecycle: "started" })
      .mockResolvedValueOnce({ id: "item-attempt-1", lifecycle: "graded", normalizedScore: 5 });

    await saveTestItemAttemptState(
      student,
      "course-1",
      "group-1",
      "test-activity-1",
      "parent-attempt-1",
      "item-1",
      { answers: { "question-1": ["choice-1"] } }
    );
    await submitTestItemAttemptResult(
      student,
      "course-1",
      "group-1",
      "test-activity-1",
      "parent-attempt-1",
      "item-1",
      {
        state: { answers: { "question-1": ["choice-1"] } },
        gradingResult: { rawScore: 1, rawMaxScore: 2 }
      }
    );

    expect(db.testItemAttempt.upsert).toHaveBeenLastCalledWith(expect.objectContaining({
      create: expect.objectContaining({
        activityId: "mcq-1",
        lifecycle: "graded",
        rawScore: 1,
        rawMaxScore: 2,
        normalizedScore: 5,
        normalizedMaxScore: 10
      })
    }));
  });

  it("permits read-only child loading from a submitted parent attempt", async () => {
    db.activityAttempt.findFirst.mockResolvedValue(parentAttempt({ lifecycle: "submitted" }));
    db.testItemAttempt.findUnique.mockResolvedValue({ id: "item-attempt-1", lifecycle: "graded" });

    await expect(getTestItemExecutionContext(
      student,
      "course-1",
      "group-1",
      "test-activity-1",
      "parent-attempt-1",
      "item-1",
      { allowCompletedParent: true }
    )).resolves.toMatchObject({ parentAttempt: { lifecycle: "submitted" } });

    expect(db.activityAttempt.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ lifecycle: { in: ["started", "submitted", "graded"] } })
    }));
  });

  it("requires all required child activities before submitting the parent attempt", async () => {
    db.activityAttempt.findFirst
      .mockResolvedValueOnce(parentAttempt({ testItemAttempts: [] }))
      .mockResolvedValueOnce(parentAttempt({
        testItemAttempts: [{ testItemId: "item-1", lifecycle: "graded" }]
      }));

    await expect(
      submitTestAttempt(student, "course-1", "group-1", "test-activity-1", "parent-attempt-1")
    ).rejects.toMatchObject({ code: "TEST_REQUIRED_ITEMS_INCOMPLETE" });

    db.activityAttempt.findMany.mockResolvedValue([
      parentAttempt({ lifecycle: "submitted", submittedAt: new Date(), testItemAttempts: [] })
    ]);
    await submitTestAttempt(student, "course-1", "group-1", "test-activity-1", "parent-attempt-1");

    expect(gradebook.submitActivityAttempt).toHaveBeenCalledWith(student, expect.objectContaining({
      attemptId: "parent-attempt-1",
      pluginAttemptRef: "parent-attempt-1"
    }));
  });
});
