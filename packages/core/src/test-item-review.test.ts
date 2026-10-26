import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "./errors";

const mocks = vi.hoisted(() => ({
  review: vi.fn(), aggregate: vi.fn(), refreshFeedback: vi.fn(), override: vi.fn(), handler: vi.fn(), submission: vi.fn(), draft: vi.fn(), revise: vi.fn(),
  db: { $transaction: vi.fn(), $queryRaw: vi.fn(), activityAttempt: { findFirst: vi.fn(), findUnique: vi.fn() },
    testItemAttempt: { findUnique: vi.fn(), update: vi.fn() }, testSubmissionClaim: { findUnique: vi.fn() }, courseAuditEvent: { create: vi.fn() },
    grade: { findUnique: vi.fn() }, gradeChallenge: { findFirst: vi.fn() }, aiFeedbackResearchEvent: { create: vi.fn() } }
}));
vi.mock("@cognelo/db", () => ({ prisma: mocks.db }));
vi.mock("@cognelo/activity-sdk/server", () => ({ resolvePluginAiFeedbackTeacherReviewHandler: mocks.handler }));
vi.mock("./test-execution", () => ({ getTestAttemptReview: mocks.review, recalculateTestAttemptGrade: mocks.aggregate, refreshTestAttemptFeedback: mocks.refreshFeedback }));
vi.mock("./gradebook", () => ({ overrideGradebookGrade: mocks.override }));
import { getTestItemTeacherReview, saveTestItemTeacherReview } from "./test-item-review";

const teacher = { id: "teacher", email: "teacher@example.test", name: null, firstName: null, lastName: null, roles: ["teacher" as const] };
const timestamp = new Date("2026-10-26T12:00:00Z");
const parent = { id: "parent", groupId: "section", gradebookItemId: "gradebook", participantId: "student", userId: "learner",
  updatedAt: timestamp, lifecycle: "submitted" };
let child: { id: string; updatedAt: Date; lifecycle: string; rawScore: number | null; rawMaxScore: number | null;
  normalizedScore: number | null; normalizedMaxScore: number; result: Record<string, unknown>; feedback: Record<string, unknown> };
async function save(input: Partial<Parameters<typeof saveTestItemTeacherReview>[4]> = {}) {
  const review = await getTestItemTeacherReview(teacher, "course", "parent", "item");
  return saveTestItemTeacherReview(teacher, "course", "parent", "item", {
    expectedUpdatedAt: review.updatedAt, expectedFeedbackHash: review.feedbackHash, ...input
  });
}

describe("Test child teacher review", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    child = { id: "child", updatedAt: timestamp, lifecycle: "submitted", rawScore: null, rawMaxScore: null,
      normalizedScore: null, normalizedMaxScore: 10, result: { state: { sourceCode: "saved source", executionId: "original" } }, feedback: {} };
    mocks.review.mockImplementation(async () => ({ ...parent, updatedAt: timestamp.toISOString(), gradesReleased: false, items: [{
      testItemId: "item", activityId: "question", activityTypeKey: "coding-exercise", pointsPossible: 10,
      activity: { id: "question", config: {} }, itemAttempt: { ...child, updatedAt: child.updatedAt.toISOString(), pluginAttemptRef: null,
        state: child.result.state, manuallyGraded: Boolean(child.result.manualGrading) }
    }] }));
    mocks.db.activityAttempt.findFirst.mockResolvedValue({ id: "parent" });
    mocks.db.activityAttempt.findUnique.mockResolvedValue(parent);
    mocks.db.testItemAttempt.findUnique.mockImplementation(async () => child);
    mocks.db.testItemAttempt.update.mockImplementation(async ({ data }) => (child = { ...child, ...data, updatedAt: new Date(timestamp.getTime() + 1) }));
    mocks.db.$transaction.mockImplementation(run => run(mocks.db));
    mocks.submission.mockResolvedValue({ sourceCode: "saved source" });
    mocks.draft.mockResolvedValue({ kind: "assessment_feedback", summary: "", criteria: [] });
    mocks.handler.mockReturnValue({ getSubmission: mocks.submission, createFeedbackDraft: mocks.draft, reviseFeedback: mocks.revise });
    mocks.revise.mockResolvedValue({ feedback: { kind: "assessment_feedback", summary: "Reviewed", criteria: [] } });
    mocks.aggregate.mockResolvedValue({ grade: { normalizedScore: 8 } });
  });

  it("uses the existing plugin renderer contract with the exact authorized child state", async () => {
    const result = await getTestItemTeacherReview(teacher, "course", "parent", "item");
    expect(mocks.review).toHaveBeenCalledWith(teacher, "course", "parent", "item");
    expect(mocks.submission).toHaveBeenCalledWith(expect.objectContaining({
      coreAttemptId: "parent", activityId: "question", groupId: "section",
      testItemAttempt: expect.objectContaining({ id: "child", parentAttemptId: "parent", state: child.result.state })
    }));
    expect(result).toMatchObject({ score: null, maxScore: 10, readOnly: false, submission: { sourceCode: "saved source" } });
  });

  it("persists a partial review, immutable source and audit together while another question awaits grading", async () => {
    const source = structuredClone(child.result);
    mocks.revise.mockResolvedValue({ feedback: { summary: "Reviewed" }, gradingResult: { rawScore: 80, rawMaxScore: 100 } });
    mocks.aggregate.mockRejectedValue(new AppError(409, "TEST_ITEMS_NOT_GRADED", "Pending"));
    const result = await save({ feedback: { summary: "Reviewed" } });
    expect(result).toMatchObject({ grade: null, review: { score: 8, feedback: { summary: "Reviewed", teacherRevision: 1, feedbackOrigin: "teacher" } } });
    expect(child.result.state).toEqual(source.state);
    expect(mocks.aggregate).toHaveBeenCalledWith(teacher, "course", "parent", expect.any(String), mocks.db);
    expect(mocks.db.courseAuditEvent.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ actorUserId: "teacher", targetId: "child" }) }));
    expect(mocks.db.aiFeedbackResearchEvent.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ eventType: "feedback_teacher_authored" }) }));
  });

  it("preserves a teacher item override when rubric feedback changes, and accepts a new explicit override", async () => {
    Object.assign(child, { normalizedScore: 4, rawScore: 4, rawMaxScore: 10, lifecycle: "graded" });
    child.result.manualGrading = { score: 4 };
    mocks.revise.mockResolvedValue({ feedback: { summary: "Revised" }, gradingResult: { rawScore: 90, rawMaxScore: 100 } });
    expect((await save({ feedback: { summary: "Revised" } })).review.score).toBe(4);
    expect(mocks.db.testItemAttempt.update.mock.calls[0][0].data).not.toHaveProperty("normalizedScore");
    expect((await save({ score: 6 })).review.score).toBe(6);
  });

  it("rejects stale versions, stale rubric content and concurrent changes before writing", async () => {
    await expect(save({ expectedUpdatedAt: "2020-01-01T00:00:00.000Z", score: 1 })).rejects.toMatchObject({ code: "TEST_REVIEW_CONFLICT" });
    await expect(save({ expectedFeedbackHash: "old", score: 1 })).rejects.toMatchObject({ code: "TEST_REVIEW_CONFLICT" });
    mocks.db.testItemAttempt.findUnique.mockResolvedValue({ ...child, updatedAt: new Date(timestamp.getTime() + 100) });
    await expect(save({ score: 1 })).rejects.toMatchObject({ code: "TEST_REVIEW_CONFLICT" });
    expect(mocks.db.testItemAttempt.update).not.toHaveBeenCalled();
    expect(mocks.aggregate).not.toHaveBeenCalled();
  });

  it("rejects historical edits, reopened work, foreign children and unauthorized reads", async () => {
    mocks.db.activityAttempt.findFirst.mockResolvedValue({ id: "newer-parent" });
    expect((await getTestItemTeacherReview(teacher, "course", "parent", "item")).readOnly).toBe(true);
    await expect(save({ score: 1 })).rejects.toMatchObject({ code: "TEST_REVIEW_READ_ONLY" });
    mocks.db.activityAttempt.findFirst.mockResolvedValue({ id: "parent" });
    mocks.db.activityAttempt.findUnique.mockResolvedValue({ ...parent, lifecycle: "started" });
    await expect(save({ score: 1 })).rejects.toMatchObject({ code: "TEST_REVIEW_CONFLICT" });
    await expect(getTestItemTeacherReview(teacher, "course", "parent", "foreign-item")).rejects.toMatchObject({ status: 404 });
    mocks.review.mockRejectedValue(new AppError(403, "FORBIDDEN", "Not allowed"));
    await expect(getTestItemTeacherReview(teacher, "course", "parent", "item")).rejects.toMatchObject({ status: 403 });
    expect(mocks.db.testItemAttempt.update).not.toHaveBeenCalled();
  });

  it("supports generic comments and item grades without a feedback plugin", async () => {
    mocks.handler.mockReturnValue(null);
    const result = await save({ score: 5, feedbackText: "Check the arrangement." });
    expect(result.review).toMatchObject({ score: 5, feedbackText: "Check the arrangement.", feedback: null, manuallyGraded: true });
    expect(mocks.revise).not.toHaveBeenCalled();
    await expect(save({ score: 11 })).rejects.toMatchObject({ code: "TEST_ITEM_SCORE_OUT_OF_RANGE" });
  });

  it("blocks saves during automatic grading and maps a concurrent row update to a conflict", async () => {
    mocks.db.testSubmissionClaim.findUnique.mockResolvedValue({ status: "processing", updatedAt: new Date() });
    await expect(save({ score: 5 })).rejects.toMatchObject({ code: "TEST_SUBMISSION_IN_PROGRESS" });
    expect(mocks.db.testItemAttempt.update).not.toHaveBeenCalled();
    mocks.db.testSubmissionClaim.findUnique.mockResolvedValue(null);
    mocks.db.testItemAttempt.update.mockRejectedValue({ code: "P2025" });
    await expect(save({ score: 5 })).rejects.toMatchObject({ code: "TEST_REVIEW_CONFLICT" });
  });

  it("reuses the shared override service to preserve an explicit Test total in the same transaction", async () => {
    mocks.db.grade.findUnique.mockResolvedValue({ isActive: true, source: "override", normalizedScore: 19, normalizedMaxScore: 20,
      normalizedResult: { studentFeedback: { feedbackText: "Overall judgment" } } });
    mocks.override.mockResolvedValue({ normalizedScore: 19, source: "override" });
    const result = await save({ score: 5 });
    expect(result.grade).toMatchObject({ normalizedScore: 19, source: "override" });
    expect(mocks.override).toHaveBeenCalledWith(teacher, "course", expect.objectContaining({
      gradebookItemId: "gradebook", participantId: "student", score: 19, maxScore: 20, feedbackText: "Overall judgment"
    }), mocks.db);
  });

  it("refreshes narrative feedback without recomputing grades or applying changed grading policy", async () => {
    await save({ feedback: { summary: "Reviewed" } });
    expect(mocks.refreshFeedback).toHaveBeenCalledWith(teacher, "course", "parent", mocks.db);
    expect(mocks.aggregate).not.toHaveBeenCalled();
  });
});
