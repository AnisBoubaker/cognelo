import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CurrentUser } from "@cognelo/contracts";

const mocks = vi.hoisted(() => ({
  authorize: vi.fn(), confirm: vi.fn(),
  tx: {
    $executeRaw: vi.fn(),
    activity: { findFirst: vi.fn(), findFirstOrThrow: vi.fn(), findUniqueOrThrow: vi.fn() },
    testSubmissionClaim: { findFirst: vi.fn() },
    testItemAttempt: { findMany: vi.fn(), update: vi.fn() },
    courseAuditEvent: { create: vi.fn() }
  }
}));
vi.mock("@cognelo/db", () => ({ prisma: { $transaction: (run: (tx: unknown) => unknown) => run(mocks.tx) } }));
vi.mock("./authorization", () => ({ assertCanManageCourse: mocks.authorize }));
vi.mock("./activity-settings-live", () => ({ confirmLiveActivitySettings: mocks.confirm }));
const { withActivityAuthoringChange } = await import("./activity-authoring-live");
const user = { id: "teacher" } as CurrentUser;
const activity = { id: "question", title: "Question", description: "Old prompt", config: {}, metadata: {} };

describe("live activity authoring", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.tx.activity.findFirst.mockResolvedValue({ id: "question", testItem: { test: { activityId: "test" } } });
    mocks.tx.activity.findFirstOrThrow.mockResolvedValue(activity);
    mocks.tx.activity.findUniqueOrThrow.mockResolvedValue({ ...activity, description: "Corrected prompt" });
    mocks.tx.testSubmissionClaim.findFirst.mockResolvedValue(null);
    mocks.tx.testItemAttempt.findMany.mockResolvedValue([]);
  });

  it("does not mutate or audit when the active-student confirmation is declined", async () => {
    mocks.confirm.mockRejectedValue({ code: "ACTIVITY_SETTINGS_ACTIVE_STUDENTS" });
    const mutate = vi.fn();
    await expect(withActivityAuthoringChange(user, "course", "question", {}, mutate)).rejects.toMatchObject({ code: "ACTIVITY_SETTINGS_ACTIVE_STUDENTS" });
    expect(mutate).not.toHaveBeenCalled();
    expect(mocks.tx.courseAuditEvent.create).not.toHaveBeenCalled();
  });

  it("guards the parent Test and audits the before/after prompt in the write transaction", async () => {
    const mutate = vi.fn().mockResolvedValue("saved");
    expect(await withActivityAuthoringChange(user, "course", "question", { confirmActiveStudents: true, studentMessage: "Corrected prompt" }, mutate)).toBe("saved");
    expect(mocks.confirm).toHaveBeenCalledWith(mocks.tx, user, "course", "test", { confirmActiveStudents: true, studentMessage: "Corrected prompt" });
    expect(mutate).toHaveBeenCalledWith(mocks.tx);
    expect(mocks.tx.courseAuditEvent.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      previousValue: expect.objectContaining({ description: "Old prompt" }),
      nextValue: expect.objectContaining({ description: "Corrected prompt" }),
      metadata: { parentActivityId: "test", privateAuthoring: false }
    }) });
  });

  it("refuses authoring while final grading holds a submission claim", async () => {
    mocks.tx.testSubmissionClaim.findFirst.mockResolvedValue({ id: "claim" });
    const mutate = vi.fn();
    await expect(withActivityAuthoringChange(user, "course", "question", {}, mutate)).rejects.toMatchObject({ code: "TEST_SUBMISSION_IN_PROGRESS" });
    expect(mutate).not.toHaveBeenCalled();
  });

  it("keeps private answer keys out of shared audit payloads", async () => {
    await withActivityAuthoringChange(user, "course", "question", {}, vi.fn(), { privateChange: { before: { answer: "secret" }, after: { answer: "corrected secret" } } });
    const data = mocks.tx.courseAuditEvent.create.mock.calls[0][0].data;
    expect(data.previousValue.fingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(data.nextValue.fingerprint).not.toBe(data.previousValue.fingerprint);
    expect(JSON.stringify(data)).not.toContain("secret");
  });
});
