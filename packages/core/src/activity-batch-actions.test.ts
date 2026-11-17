import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CurrentUser } from "@cognelo/contracts";
const mocks = vi.hoisted(() => ({ scope: vi.fn(), list: vi.fn(), execute: vi.fn(), receipt: vi.fn() }));
vi.mock("@cognelo/db", () => ({ prisma: { courseAuditEvent: { findUnique: mocks.receipt } } }));
vi.mock("./activity-report-scope", () => ({ activityReportScope: mocks.scope }));
vi.mock("@cognelo/activity-sdk/server", () => ({ getActivityReportService: () => ({ activityActions: { list: mocks.list, execute: mocks.execute } }) }));
const { listActivityBatchActions, executeActivityBatchAction } = await import("./activity-batch-actions");
const user = { id: "teacher" } as CurrentUser;
const action = { id: "reset", icon: "reset", revision: "a".repeat(64), participantIds: ["student"], labels: { en: "Reset" }, messages: { en: "Reset one?" }, reasonLabels: { en: "Reason" } };
const input = { actionId: "reset", reason: "Corrected references", groupId: "section", revision: action.revision, operationId: "ac930028-93a4-4e9a-89cd-7773fa0b0325" };
beforeEach(() => {
  vi.clearAllMocks();
  mocks.scope.mockResolvedValue({ user, courseId: "course", activity: { id: "activity", activityType: { key: "homework" } }, participants: [{ participantId: "student", groupId: "section" }] });
  mocks.list.mockResolvedValue([action]); mocks.execute.mockResolvedValue({ affectedCount: 1 }); mocks.receipt.mockResolvedValue(null);
});
describe("activity-wide report mutations", () => {
  it("binds preview and execution to the authorized selected section", async () => {
    expect((await listActivityBatchActions(user, "course", "activity", "section")).actions).toHaveLength(1);
    expect(mocks.scope).toHaveBeenCalledWith(user, "course", "activity", "section");
    expect(await executeActivityBatchAction(user, "course", "activity", input)).toEqual({ completed: true, affectedCount: 1 });
    expect(mocks.execute).toHaveBeenCalledWith(expect.objectContaining({ participants: [{ participantId: "student", groupId: "section" }], reason: input.reason }));
  });
  it("rejects empty reasons, stale confirmations and out-of-roster targets before mutation", async () => {
    await expect(executeActivityBatchAction(user, "course", "activity", { ...input, reason: "  " })).rejects.toThrow();
    await expect(executeActivityBatchAction(user, "course", "activity", { ...input, revision: "b".repeat(64) })).rejects.toMatchObject({ code: "ACTIVITY_ACTION_CHANGED" });
    mocks.list.mockResolvedValue([{ ...action, participantIds: ["foreign"] }]);
    await expect(executeActivityBatchAction(user, "course", "activity", input)).rejects.toMatchObject({ code: "ACTIVITY_ACTION_CONTRACT_INVALID" });
    expect(mocks.execute).not.toHaveBeenCalled();
  });
  it("returns an existing receipt after a lost response without repeating the mutation", async () => {
    await executeActivityBatchAction(user, "course", "activity", input);
    const requestHash = mocks.execute.mock.calls[0][0].requestHash;
    mocks.receipt.mockResolvedValue({ courseId: "course", actorUserId: user.id, targetId: "activity", eventType: "activity_report_batch_action", metadata: { requestHash, affectedCount: 1 } });
    mocks.list.mockResolvedValue([]);
    expect(await executeActivityBatchAction(user, "course", "activity", input)).toEqual({ completed: true, affectedCount: 1 });
    expect(mocks.execute).toHaveBeenCalledTimes(1);
    await expect(executeActivityBatchAction(user, "course", "activity", { ...input, reason: "Different action" })).rejects.toMatchObject({ code: "ACTIVITY_ACTION_CHANGED" });
  });
  it("does not allow students or foreign section staff to discover or run operations", async () => {
    mocks.scope.mockRejectedValue(new Error("Forbidden"));
    await expect(listActivityBatchActions(user, "course", "activity", "foreign")).rejects.toThrow("Forbidden");
    await expect(executeActivityBatchAction(user, "course", "activity", input)).rejects.toThrow("Forbidden");
    expect(mocks.execute).not.toHaveBeenCalled();
  });
});
