import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CurrentUser } from "@cognelo/contracts";
const mocks = vi.hoisted(() => ({ authorize: vi.fn(), db: { $queryRaw: vi.fn(), $transaction: vi.fn(),
  activityAttempt: { findUnique: vi.fn(), update: vi.fn() }, testItemAttempt: { findFirst: vi.fn(), update: vi.fn() },
  activityGradingReview: { findUnique: vi.fn(), upsert: vi.fn(), update: vi.fn() }, courseAuditEvent: { create: vi.fn() } } }));
vi.mock("@cognelo/db", () => ({ prisma: mocks.db, Prisma: { JsonNull: null } }));
vi.mock("./authorization", () => ({ assertCanGradeGroup: mocks.authorize }));
vi.mock("@cognelo/activity-sdk", () => ({ getActivityPluginForActivityType: () => ({ key: "future-plugin" }) }));
import { assertNoRequiredGradingReview, getActivityGradingReviews, gradingReviewRevision, requestActivityGradingReview,
  resolveGradebookGradingReviews, resolveTestItemGradingReview } from "./grading-review";
const user = { id: "student", roles: ["student"] } as CurrentUser;
const now = new Date("2026-11-23T12:00:00Z");
const row = { id: "review", attemptId: "attempt", testItemAttemptId: null, status: "required" as const,
  reasonCode: "future.conflict", message: "Check this result.", version: 1, requestedAt: now, resolvedAt: null,
  evidenceRef: "private-evidence", targetKey: "attempt:attempt", pluginKey: "future-plugin" };
const safeRow = { id: row.id, attemptId: row.attemptId, testItemAttemptId: null, status: row.status, reasonCode: row.reasonCode,
  message: row.message, version: row.version, requestedAt: now.toISOString(), resolvedAt: null };
beforeEach(() => {
  vi.resetAllMocks(); mocks.db.$transaction.mockImplementation(run => run(mocks.db));
  mocks.db.$queryRaw.mockImplementation(async (query: TemplateStringsArray) => query.join("").includes('FROM "ActivityGradingReview"') ? [row] : [{ id: "attempt" }]);
  mocks.db.activityAttempt.findUnique.mockResolvedValue({ id: "attempt", userId: "student", courseId: "course", groupId: "section", lifecycle: "submitted", activity: { activityType: { key: "future-type" } } });
  mocks.db.activityGradingReview.upsert.mockResolvedValue(row);
  mocks.db.activityGradingReview.update.mockResolvedValue({ ...row, status: "resolved", version: 2, resolvedAt: now });
});
describe("shared required grading reviews", () => {
  it("supports another plugin and returns only staff-safe review fields", async () => {
    expect(await requestActivityGradingReview(user, { attemptId: "attempt", review: { reasonCode: row.reasonCode, message: row.message, evidenceRef: row.evidenceRef } })).toEqual(safeRow);
    expect(mocks.db.activityGradingReview.upsert.mock.calls[0][0].create.pluginKey).toBe("future-plugin");
    expect(await getActivityGradingReviews(["attempt"])).toEqual([safeRow]);
    expect(JSON.stringify(mocks.db.courseAuditEvent.create.mock.calls)).not.toContain("private-evidence");
  });
  it("authorizes staff outside the learner ownership and rejects foreign child targets", async () => {
    mocks.authorize.mockRejectedValueOnce(new Error("No section access"));
    await expect(requestActivityGradingReview({ ...user, id: "other" }, { attemptId: "attempt", review: { reasonCode: row.reasonCode, message: row.message } })).rejects.toThrow("No section access");
    mocks.db.testItemAttempt.findFirst.mockResolvedValue(null);
    await expect(requestActivityGradingReview(user, { attemptId: "attempt", testItemAttemptId: "foreign", review: { reasonCode: row.reasonCode, message: row.message } })).rejects.toMatchObject({ status: 404 });
    expect(mocks.db.activityGradingReview.upsert).not.toHaveBeenCalled();
  });
  it("keeps repeated evidence idempotent, including an already reviewed result", async () => {
    mocks.db.activityGradingReview.findUnique.mockResolvedValue({ ...row, status: "resolved", resolvedAt: now });
    const result = await requestActivityGradingReview(user, { attemptId: "attempt", review: { reasonCode: row.reasonCode, message: row.message, evidenceRef: row.evidenceRef } });
    expect(result.status).toBe("resolved"); expect(mocks.db.activityGradingReview.upsert).not.toHaveBeenCalled();
  });
  it("blocks automatic grades and requires the displayed revision to resolve a final grade", async () => {
    await expect(assertNoRequiredGradingReview("attempt")).rejects.toMatchObject({ code: "GRADING_REVIEW_REQUIRED" });
    const input = { gradebookItemId: "item", participantId: "participant", courseId: "course", userId: "teacher" };
    await expect(resolveGradebookGradingReviews(mocks.db as never, input)).rejects.toMatchObject({ code: "GRADING_REVIEW_CHANGED" });
    expect(mocks.db.activityGradingReview.update).not.toHaveBeenCalled();
    await resolveGradebookGradingReviews(mocks.db as never, { ...input, expectedRevision: gradingReviewRevision([safeRow]) });
    expect(mocks.db.activityGradingReview.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "resolved", resolvedByUserId: "teacher" }) }));
  });
  it("resolves only the explicitly graded child", async () => {
    mocks.db.$queryRaw.mockResolvedValue([{ ...row, testItemAttemptId: "one" }, { ...row, id: "other", testItemAttemptId: "two" }]);
    await resolveTestItemGradingReview(mocks.db as never, { parentAttemptId: "attempt", testItemAttemptId: "one", courseId: "course", userId: "teacher" });
    expect(mocks.db.activityGradingReview.update).toHaveBeenCalledTimes(1);
    await expect(assertNoRequiredGradingReview("attempt", mocks.db as never, "one")).rejects.toMatchObject({ code: "GRADING_REVIEW_REQUIRED" });
  });
});
