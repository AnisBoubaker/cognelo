import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CurrentUser } from "@cognelo/contracts";

const mocks = vi.hoisted(() => ({
  authorize: vi.fn(), scope: vi.fn(), restore: vi.fn(), resolve: vi.fn(),
  tx: {
    activityAttempt: { findUnique: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
    activityResponseDraft: { upsert: vi.fn() },
    activityAssignmentException: { findMany: vi.fn() },
    grade: { findUnique: vi.fn(), update: vi.fn() },
    gradeEvent: { findMany: vi.fn(), create: vi.fn() },
    testItemAttempt: { update: vi.fn() },
    testSubmissionClaim: { findUnique: vi.fn(), deleteMany: vi.fn() }
  },
  prisma: { activityAttempt: { findFirst: vi.fn() }, $transaction: vi.fn() }
}));
vi.mock("@cognelo/db", async (original) => ({ ...await original<typeof import("@cognelo/db")>(), prisma: mocks.prisma }));
vi.mock("@cognelo/activity-sdk/server", () => ({ resolveAttemptContinuationHandler: mocks.resolve }));
vi.mock("./authorization", () => ({ assertCanViewCourseGradebook: mocks.authorize, assertCanGradeGroup: mocks.scope }));
const { reopenActivitySubmission } = await import("./gradebook");
const user = { id: "teacher" } as CurrentUser;
const startedAt = new Date("2026-10-12T10:00:00Z");
const submittedAt = new Date("2026-10-12T10:05:00Z");
function attempt() {
  return {
    id: "attempt", courseId: "course", groupId: "section", groupActivityId: "assignment", participantId: "student",
    userId: "learner", activityId: "activity", gradebookItemId: "item", pluginKey: "mcq", pluginVersion: "0.1.0",
    pluginAttemptRef: "artifact", lifecycle: "graded", assessmentMode: "summative", startedAt, submittedAt,
    gradedAt: submittedAt, attemptNumber: 2, durationSeconds: 300, isLate: false, lateBySeconds: 0,
    metadata: { timeLimitSnapshotMinutes: 30, submittedTimeLimitMinutes: 40, submittedAvailableUntil: "2026-10-12T10:10:00Z", teacherFeedback: { summary: "Old grade" }, submittedAnswers: { q1: ["a"] } },
    activity: { activityType: { key: "mcq" } }, groupActivity: { metadata: { assessmentMode: "summative" } },
    gradebookItem: { id: "item", gradeStrategy: "latest", pointsPossible: 10, gradesReleased: true }, testItemAttempts: []
  };
}
beforeEach(() => {
  vi.resetAllMocks();
  mocks.authorize.mockResolvedValue({}); mocks.scope.mockResolvedValue(undefined);
  mocks.prisma.activityAttempt.findFirst.mockResolvedValue(attempt());
  mocks.prisma.$transaction.mockImplementation((callback) => callback(mocks.tx));
  mocks.tx.activityAttempt.findUnique.mockResolvedValue(attempt());
  mocks.tx.activityAttempt.findFirst.mockResolvedValue({ id: "attempt" });
  mocks.tx.activityAttempt.update.mockImplementation(({ data }) => ({ ...attempt(), ...data }));
  mocks.tx.activityAssignmentException.findMany.mockResolvedValue([]);
  mocks.tx.gradeEvent.findMany.mockResolvedValue([]);
  mocks.tx.grade.findUnique.mockResolvedValue({ id: "grade", selectedAttemptId: "attempt", isActive: true, source: "override" });
  mocks.tx.grade.update.mockImplementation(({ data }) => ({ id: "grade", ...data }));
  mocks.restore.mockResolvedValue({ responseState: { answers: { q1: ["a"] } } });
  mocks.resolve.mockReturnValue(mocks.restore);
});

describe("submission continuation", () => {
  it("restores answers, withdraws even an overridden grade, and audits the original completion without changing timing or policy", async () => {
    const result = await reopenActivitySubmission(user, "course", "attempt");
    expect(result.attempt).toMatchObject({ id: "attempt", attemptNumber: 2, lifecycle: "started", startedAt, submittedAt: null, gradedAt: null, durationSeconds: null });
    expect(result.attempt.metadata).toMatchObject({ timeLimitSnapshotMinutes: 30, continuation: { reopenedByUserId: "teacher" } });
    expect(result.attempt.metadata).not.toHaveProperty("submittedTimeLimitMinutes");
    expect(result.attempt.metadata).not.toHaveProperty("submittedAvailableUntil");
    expect(result.attempt.metadata).not.toHaveProperty("teacherFeedback");
    expect(mocks.tx.activityResponseDraft.upsert).toHaveBeenCalledWith(expect.objectContaining({ update: { state: { answers: { q1: ["a"] } } } }));
    expect(mocks.tx.grade.update).toHaveBeenCalledWith({ where: { id: "grade" }, data: { isActive: false } });
    expect(mocks.tx.gradeEvent.create).toHaveBeenCalledWith({ data: expect.objectContaining({ eventType: "submission_reopened", actorUserId: "teacher", previousValue: expect.objectContaining({ attempt: expect.objectContaining({ startedAt: startedAt.toISOString(), submittedAt: submittedAt.toISOString(), metadata: attempt().metadata }) }) }) });
    expect(mocks.scope).toHaveBeenCalledWith(user, "course", "section");
  });

  it("recomputes the remaining grade without resurrecting an earlier reopened score", async () => {
    const record = attempt();
    mocks.tx.activityAttempt.findUnique.mockResolvedValue({ ...record, gradebookItem: { ...record.gradebookItem, gradeStrategy: "best" } });
    const score = (value: number, number: number) => ({ attemptNumber: number, rawScore: value, rawMaxScore: 10, normalizedScore: value, normalizedMaxScore: 10 });
    mocks.tx.gradeEvent.findMany.mockResolvedValue([
      { attemptId: "prior-reopened", eventType: "auto_graded", nextValue: score(10, 1) },
      { attemptId: "remaining-submission", eventType: "auto_graded", nextValue: score(5, 2) },
      { attemptId: "prior-reopened", eventType: "submission_reopened", nextValue: { attempt: { lifecycle: "started" } } }
    ]);
    await reopenActivitySubmission(user, "course", "attempt");
    expect(mocks.tx.grade.update).toHaveBeenCalledWith({ where: { id: "grade" }, data: expect.objectContaining({ selectedAttemptId: "remaining-submission", normalizedScore: 5, isActive: true }) });
  });

  it.each(["started", "deleted"])("rejects %s attempts before restoring any state", async (lifecycle) => {
    mocks.tx.activityAttempt.findUnique.mockResolvedValue({ ...attempt(), lifecycle });
    await expect(reopenActivitySubmission(user, "course", "attempt")).rejects.toMatchObject({ code: "SUBMISSION_NOT_COMPLETED" });
    expect(mocks.restore).not.toHaveBeenCalled();
    expect(mocks.tx.activityAttempt.update).not.toHaveBeenCalled();
  });

  it("rejects an older submission when a newer attempt exists", async () => {
    mocks.tx.activityAttempt.findFirst.mockResolvedValue({ id: "newer-started-attempt" });
    await expect(reopenActivitySubmission(user, "course", "attempt")).rejects.toMatchObject({ code: "SUBMISSION_NOT_LATEST" });
    expect(mocks.restore).not.toHaveBeenCalled();
  });

  it("enforces section grading permission before beginning the transaction", async () => {
    mocks.scope.mockRejectedValue(new Error("Forbidden section"));
    await expect(reopenActivitySubmission(user, "course", "attempt")).rejects.toThrow("Forbidden section");
    expect(mocks.prisma.$transaction).not.toHaveBeenCalled();
  });

  it("rejects an attempt belonging to a different course", async () => {
    mocks.prisma.activityAttempt.findFirst.mockResolvedValue(null);
    await expect(reopenActivitySubmission(user, "wrong-course", "attempt")).rejects.toMatchObject({ status: 404 });
    expect(mocks.prisma.activityAttempt.findFirst).toHaveBeenCalledWith({ where: { id: "attempt", courseId: "wrong-course" } });
    expect(mocks.prisma.$transaction).not.toHaveBeenCalled();
  });

  it("rejects a historical assessment mode", async () => {
    mocks.tx.activityAttempt.findUnique.mockResolvedValue({ ...attempt(), assessmentMode: "formative" });
    await expect(reopenActivitySubmission(user, "course", "attempt")).rejects.toMatchObject({ code: "ATTEMPT_MODE_MISMATCH" });
    expect(mocks.restore).not.toHaveBeenCalled();
  });

  it("fails closed when the activity cannot restore its submitted state", async () => {
    mocks.restore.mockRejectedValue(new Error("Artifact missing"));
    await expect(reopenActivitySubmission(user, "course", "attempt")).rejects.toThrow("Artifact missing");
    expect(mocks.tx.activityAttempt.update).not.toHaveBeenCalled();
    expect(mocks.tx.grade.update).not.toHaveBeenCalled();
  });

  it("reopens Test child state and clears submission claims while preserving the manifest and original starts", async () => {
    const item = { id: "child", result: { state: { answers: { q1: ["a"] } }, rawResult: { old: true } }, startedAt };
    mocks.tx.activityAttempt.findUnique.mockResolvedValue({ ...attempt(), pluginKey: "core:test", testItemAttempts: [item], metadata: { manifest: { sessionId: "old", settings: { allowResume: false }, items: [] } } });
    await reopenActivitySubmission(user, "course", "attempt");
    expect(mocks.tx.testItemAttempt.update).toHaveBeenCalledWith({ where: { id: "child" }, data: expect.objectContaining({ lifecycle: "started", result: { state: { answers: { q1: ["a"] } } }, feedback: {}, gradedAt: null, rawScore: null }) });
    expect(mocks.tx.testItemAttempt.update.mock.calls[0]![0].data).not.toHaveProperty("startedAt");
    expect(mocks.tx.testSubmissionClaim.deleteMany).toHaveBeenCalledWith({ where: { parentAttemptId: "attempt" } });
    expect(mocks.tx.activityAttempt.update.mock.calls[0]![0].data.metadata.manifest.sessionId).toBe("old");
    expect(mocks.restore).not.toHaveBeenCalled();
  });

  it("does not reopen a Test whose submission is still processing", async () => {
    mocks.tx.activityAttempt.findUnique.mockResolvedValue({ ...attempt(), pluginKey: "core:test" });
    mocks.tx.testSubmissionClaim.findUnique.mockResolvedValue({ status: "processing" });
    await expect(reopenActivitySubmission(user, "course", "attempt")).rejects.toMatchObject({ code: "SUBMISSION_PROCESSING" });
    expect(mocks.tx.activityAttempt.update).not.toHaveBeenCalled();
  });
});
