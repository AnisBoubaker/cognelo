import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ assignment: vi.fn(), participant: vi.fn(), attempts: vi.fn(), manage: vi.fn(), grade: vi.fn(), exceptions: vi.fn(), releasedGrade: vi.fn(), deletions: vi.fn() }));
vi.mock("@cognelo/db", () => ({ prisma: {
  courseGroupActivity: { findFirst: mocks.assignment }, courseGroupParticipant: { findFirst: mocks.participant }, activityAttempt: { findMany: mocks.attempts },
  grade: { findFirst: mocks.releasedGrade }, gradeEvent: { findMany: mocks.deletions }
} }));
vi.mock("./authorization", () => ({ canManageCourse: mocks.manage, canGradeGroup: mocks.grade }));
vi.mock("./activity-assignment-exceptions", async (original) => ({ ...await original<typeof import("./activity-assignment-exceptions")>(), assignmentExceptionsForUser: mocks.exceptions }));
import { getActivityContentAccess, assertActivityContentAccess, resolveActivityContentLock } from "./activity-content-access";
import { courseActivityHidesAfterAttempts } from "./activity-assignment-policy";

const now = new Date("2030-07-15T12:00:00Z");
const policy = { availableUntil: null, timeLimitMinutes: null, summative: true, gradesReleased: false, attemptLimitMode: "max_attempts", maxAttempts: 1 };
const attempt = { id: "attempt-1", attemptNumber: 1, lifecycle: "submitted", startedAt: new Date("2030-07-15T11:00:00Z"), submittedAt: now };
const user = { id: "student-1", roles: ["student"] } as never;
beforeEach(() => {
  vi.clearAllMocks();
  mocks.manage.mockResolvedValue(false); mocks.grade.mockResolvedValue(false);
  mocks.participant.mockResolvedValue({ id: "participant-1", role: "student" });
  mocks.assignment.mockResolvedValue({ id: "assignment-1", metadata: { assessmentMode: "summative" }, availableUntil: null,
    activity: { title: "Exam", metadata: { allGroupsAssignment: { hideAfterAttempts: true } } }, gradebookItem: policy });
  mocks.attempts.mockResolvedValue([attempt]); mocks.exceptions.mockResolvedValue(new Map());
  mocks.releasedGrade.mockResolvedValue(null); mocks.deletions.mockResolvedValue([]);
});

describe("activity content closure", () => {
  it("is opt-in, including for legacy metadata", () => {
    for (const value of [null, {}, { allGroupsAssignment: {} }, { allGroupsAssignment: { hideAfterAttempts: false } }]) expect(courseActivityHidesAfterAttempts(value)).toBe(false);
  });
  it("closes after the last submission, not while its valid attempt is underway", () => {
    expect(resolveActivityContentLock(policy, [attempt], now).locked).toBe(true);
    expect(resolveActivityContentLock(policy, [{ ...attempt, lifecycle: "started" }], now).locked).toBe(false);
    expect(resolveActivityContentLock({ ...policy, timeLimitMinutes: 60 }, [{ ...attempt, lifecycle: "started" }], now)).toEqual({ locked: true, canFinalize: true });
  });
  it("honors additional attempts and deleted attempts", () => {
    expect(resolveActivityContentLock({ ...policy, maxAttempts: 2 }, [attempt], now).locked).toBe(false);
    expect(resolveActivityContentLock(policy, [{ ...attempt, lifecycle: "deleted" }], now).locked).toBe(false);
  });
  it("closes at the exact Until date even with unlimited attempts or no submissions", () => {
    expect(resolveActivityContentLock({ ...policy, availableUntil: now, attemptLimitMode: "unlimited" }, [], now).locked).toBe(true);
    expect(resolveActivityContentLock({ ...policy, availableUntil: now }, [{ ...attempt, lifecycle: "started" }], now).locked).toBe(true);
  });
  it("keeps unlimited/formative content accessible before closing, but grade release does not reopen summative content", () => {
    expect(resolveActivityContentLock({ ...policy, attemptLimitMode: "unlimited" }, [attempt], now).locked).toBe(false);
    expect(resolveActivityContentLock({ ...policy, summative: false, gradesReleased: true }, [attempt], now).locked).toBe(false);
    expect(resolveActivityContentLock({ ...policy, gradesReleased: true, maxAttempts: 5 }, [attempt], now).locked).toBe(true);
  });
  it("returns only receipts, never attempt response metadata", async () => {
    mocks.attempts.mockResolvedValue([{ ...attempt, metadata: { submittedAnswers: "private" }, pluginAttemptRef: "private-ref" }]);
    const result = await getActivityContentAccess(user, "course-1", "group-1", "activity-1");
    expect(result).toMatchObject({ locked: true, receipts: [{ attemptNumber: 1, submittedAt: now.toISOString(), deleted: false }] });
    expect(JSON.stringify(result)).not.toContain("private");
    expect(mocks.assignment).toHaveBeenCalledWith(expect.objectContaining({ where: { groupId: "group-1", activityId: "activity-1", group: { courseId: "course-1" } } }));
  });
  it("uses the student's resolved exception for extra attempts and closing dates", async () => {
    mocks.exceptions.mockResolvedValue(new Map([["assignment-1", { gradebookSettings: { attemptLimitMode: "max_attempts", maxAttempts: 2 } }]]));
    expect((await getActivityContentAccess(user, "course-1", "group-1", "activity-1")).locked).toBe(false);
    mocks.exceptions.mockResolvedValue(new Map([["assignment-1", { availableUntil: "2000-01-01T00:00:00Z", gradebookSettings: { attemptLimitMode: "max_attempts", maxAttempts: 2 } }]]));
    expect((await getActivityContentAccess(user, "course-1", "group-1", "activity-1")).locked).toBe(true);
  });
  it("allows only finalization of an expired active attempt, never replay after submission", async () => {
    await expect(assertActivityContentAccess(user, "course-1", "group-1", "activity-1", { allowFinalization: true })).rejects.toMatchObject({ code: "ACTIVITY_CONTENT_CLOSED" });
    mocks.assignment.mockResolvedValue({ id: "assignment-1", metadata: { assessmentMode: "summative" }, availableUntil: new Date(0), activity: { title: "Exam", metadata: { allGroupsAssignment: { hideAfterAttempts: true } } }, gradebookItem: policy });
    mocks.attempts.mockResolvedValue([{ ...attempt, lifecycle: "started" }]);
    await expect(assertActivityContentAccess(user, "course-1", "group-1", "activity-1")).rejects.toMatchObject({ status: 403 });
    await expect(assertActivityContentAccess(user, "course-1", "group-1", "activity-1", { allowFinalization: true })).resolves.toMatchObject({ locked: true, canFinalize: true });
  });
  it("keeps authorized staff access and rejects unrelated users", async () => {
    mocks.participant.mockResolvedValue(null);
    await expect(getActivityContentAccess(user, "course-1", "group-1", "activity-1")).rejects.toMatchObject({ status: 403 });
    mocks.manage.mockResolvedValue(true);
    expect((await getActivityContentAccess(user, "course-1", "group-1", "activity-1")).locked).toBe(false);
    expect(mocks.attempts).not.toHaveBeenCalled();
  });
  it("never retrieves or displays an unreleased grade on the receipt", async () => {
    expect((await getActivityContentAccess(user, "course-1", "group-1", "activity-1")).grade).toBeNull();
    expect(mocks.releasedGrade).not.toHaveBeenCalled();
  });
  it("projects only a released total, without feedback or answer data", async () => {
    mocks.assignment.mockResolvedValue({ id: "assignment-1", metadata: { assessmentMode: "summative" }, availableUntil: null,
      activity: { title: "Exam", metadata: { allGroupsAssignment: { hideAfterAttempts: true } } }, gradebookItem: { ...policy, id: "item-1", gradesReleased: true } });
    mocks.releasedGrade.mockResolvedValue({ normalizedScore: 80, normalizedMaxScore: 100, source: "auto", normalizedResult: { answers: "private" } });
    const result = await getActivityContentAccess(user, "course-1", "group-1", "activity-1");
    expect(result.grade).toEqual({ score: 80, maxScore: 100 });
    expect(JSON.stringify(result)).not.toContain("private");
  });
  it("retains a deleted attempt's reason without exposing its snapshot", async () => {
    mocks.assignment.mockResolvedValue({ id: "assignment-1", metadata: { assessmentMode: "summative" }, availableUntil: new Date(0),
      activity: { title: "Exam", metadata: { allGroupsAssignment: { hideAfterAttempts: true } } }, gradebookItem: policy });
    mocks.attempts.mockResolvedValue([{ ...attempt, lifecycle: "deleted", metadata: { answers: "private" } }]);
    mocks.deletions.mockResolvedValue([{ attemptId: attempt.id, reason: "Technical issue" }]);
    const result = await getActivityContentAccess(user, "course-1", "group-1", "activity-1");
    expect(result.receipts).toEqual([{ attemptNumber: 1, submittedAt: now.toISOString(), deleted: true, reason: "Technical issue" }]);
    expect(JSON.stringify(result)).not.toContain("private");
  });
});
