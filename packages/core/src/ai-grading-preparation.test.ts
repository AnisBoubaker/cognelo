import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CurrentUser } from "@cognelo/contracts";
const mocks = vi.hoisted(() => ({ context: vi.fn(), parent: vi.fn(), grade: vi.fn(), guidance: vi.fn(), evaluate: vi.fn(), publish: vi.fn(), recordChild: vi.fn(), recalculate: vi.fn(), research: vi.fn(), additionalList: vi.fn(), additionalEvaluate: vi.fn(), teacherReview: vi.fn(), recordGrade: vi.fn(), recordFeedback: vi.fn() }));
vi.mock("@cognelo/db", () => ({ prisma: { $queryRaw: vi.fn().mockResolvedValue([]), activityAttempt: { findUniqueOrThrow: mocks.parent }, grade: { findUnique: mocks.grade } } }));
vi.mock("./gradebook", () => ({ getActivityAttemptRegradeContext: mocks.context, recordActivityAttemptGradingResult: mocks.recordGrade, recordActivityAttemptAiFeedback: mocks.recordFeedback }));
vi.mock("./ai-feedback", () => ({ recordAiFeedbackResearchEvent: mocks.research, getTeacherAttemptAiFeedbackReview: mocks.teacherReview }));
vi.mock("./test-ai-grading", () => ({ resolveTestAiGradingGuidance: mocks.guidance }));
vi.mock("./test-execution", () => ({ recordTestItemAiFeedback: mocks.recordChild, recalculateTestAttemptGrade: mocks.recalculate }));
vi.mock("@cognelo/activity-sdk/server", () => ({ resolvePluginAiFeedbackHandler: () => mocks.evaluate, resolvePluginAiFeedbackPublisher: () => mocks.publish,
  resolvePluginAiFeedbackAdditionalActions: () => ({ list: mocks.additionalList, evaluate: mocks.additionalEvaluate }) }));
const { prepareAiGradingAttempt, commitPreparedAiGrading } = await import("./ai-grading-preparation");
const user = { id: "teacher", roles: ["teacher"] } as CurrentUser;
const timestamp = new Date("2026-10-31T12:00:00Z");
const items = ["one", "two"].map(id => ({ testItemId: id, activityId: id, activityTypeKey: "coding-exercise", activity: {},
  itemAttempt: { id, lifecycle: "graded", pluginAttemptRef: id, state: {}, updatedAt: timestamp.toISOString() } }));
beforeEach(() => {
  vi.clearAllMocks();
  mocks.context.mockResolvedValue({ attemptId: "parent", activityTypeKey: "test", lifecycle: "graded", groupId: "group" });
  mocks.parent.mockResolvedValue({ id: "parent", updatedAt: timestamp, lifecycle: "graded", gradebookItemId: "gradebook", participantId: "student",
    testItemAttempts: items.map(item => ({ testItemId: item.testItemId, updatedAt: timestamp })) });
  mocks.grade.mockResolvedValue({ updatedAt: timestamp });
  mocks.guidance.mockResolvedValue({ review: { items }, guidance: new Map() });
  mocks.evaluate.mockImplementation(async ({ activityId }) => ({ feedbackRef: `feedback-${activityId}`, feedbackVersion: 1, feedbackHash: "hash",
    feedback: { summary: "Prepared" }, gradingResult: { rawScore: 80, rawMaxScore: 100 } }));
});

describe("atomic AI grading preparation", () => {
  it("revalidates a component action and preserves a final override while publishing updated component feedback", async () => {
    mocks.context.mockResolvedValue({ attemptId: "parent", activityId: "activity", activityTypeKey: "independent-provider", lifecycle: "graded", groupId: "group", pluginAttemptRef: "source", activity: {} });
    mocks.parent.mockResolvedValue({ id: "parent", updatedAt: timestamp, lifecycle: "graded", gradebookItemId: "gradebook", participantId: "student", testItemAttempts: [] });
    mocks.grade.mockResolvedValue({ source: "override", updatedAt: timestamp });
    mocks.additionalList.mockResolvedValue([{ id: "answers", attemptIds: ["parent"] }]);
    mocks.teacherReview.mockResolvedValue({ feedback: { existingCode: 90 } });
    mocks.additionalEvaluate.mockResolvedValue({ feedbackRef: "answers", feedbackVersion: 1, feedbackHash: "hash", feedback: { existingCode: 90, answerScore: 40 }, gradingResult: { rawScore: 75, rawMaxScore: 100 }, preserveFinalGradeOverride: true, synchronizeSharedGrading: false });
    const prepared = await prepareAiGradingAttempt(user, "course", "parent", { actionId: "answers" });
    expect(mocks.additionalEvaluate).toHaveBeenCalledWith(expect.objectContaining({ currentFeedback: { existingCode: 90 }, actionId: "answers", deferPublication: true }));
    expect(mocks.evaluate).not.toHaveBeenCalled();
    const tx = { $queryRaw: vi.fn(), $executeRaw: vi.fn(), activityAttempt: { findUniqueOrThrow: mocks.parent }, grade: { findUnique: mocks.grade }, courseAuditEvent: { create: vi.fn() } };
    await commitPreparedAiGrading(user, "course", prepared, tx as never);
    expect(mocks.publish).toHaveBeenCalledTimes(1); expect(mocks.recordGrade).not.toHaveBeenCalled(); expect(mocks.recordFeedback).toHaveBeenCalledTimes(1);
    mocks.additionalList.mockResolvedValue([]);
    await expect(prepareAiGradingAttempt(user, "course", "parent", { actionId: "answers" })).rejects.toMatchObject({ code: "AI_GRADING_ACTION_UNAVAILABLE" });
  });
  it("does not publish any question if a later model evaluation fails", async () => {
    mocks.evaluate.mockResolvedValueOnce({ feedbackRef: "first" }).mockRejectedValueOnce(new Error("Provider stopped"));
    await expect(prepareAiGradingAttempt(user, "course", "parent")).rejects.toThrow("Provider stopped");
    expect(mocks.recordChild).not.toHaveBeenCalled(); expect(mocks.publish).not.toHaveBeenCalled(); expect(mocks.recalculate).not.toHaveBeenCalled();
  });
  it("checks cancellation between questions and keeps private artifacts staged", async () => {
    const check = vi.fn().mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error("Cancelled"));
    await expect(prepareAiGradingAttempt(user, "course", "parent", {}, check)).rejects.toThrow("Cancelled");
    expect(mocks.evaluate).toHaveBeenCalledTimes(1);
    expect(mocks.evaluate).toHaveBeenCalledWith(expect.objectContaining({ deferPublication: true }));
    expect(mocks.recordChild).not.toHaveBeenCalled();
  });
  it("publishes both question results and the total through the same host transaction", async () => {
    const prepared = await prepareAiGradingAttempt(user, "course", "parent");
    expect(mocks.recordChild).not.toHaveBeenCalled();
    const tx = { $queryRaw: vi.fn(), $executeRaw: vi.fn(), activityAttempt: { findUniqueOrThrow: mocks.parent }, grade: { findUnique: mocks.grade },
      testSubmissionClaim: { findUnique: vi.fn().mockResolvedValue(null) }, courseAuditEvent: { create: vi.fn() } };
    await commitPreparedAiGrading(user, "course", prepared, tx as never);
    expect(mocks.recordChild).toHaveBeenCalledTimes(2);
    for (const call of mocks.recordChild.mock.calls) expect(call.at(-1)).toBe(tx);
    expect(mocks.recalculate).toHaveBeenCalledWith(user, "course", "parent", "AI grading", tx);
    expect(mocks.publish).toHaveBeenCalledTimes(2);
  });
  it("rejects stale grades before publishing any question", async () => {
    const prepared = await prepareAiGradingAttempt(user, "course", "parent");
    mocks.grade.mockResolvedValue({ updatedAt: new Date(timestamp.getTime() + 1000) });
    const tx = { $queryRaw: vi.fn(), activityAttempt: { findUniqueOrThrow: mocks.parent }, grade: { findUnique: mocks.grade } };
    await expect(commitPreparedAiGrading(user, "course", prepared, tx as never)).rejects.toMatchObject({ code: "AI_GRADING_CONFLICT" });
    expect(mocks.publish).not.toHaveBeenCalled(); expect(mocks.recordChild).not.toHaveBeenCalled();
  });
});
