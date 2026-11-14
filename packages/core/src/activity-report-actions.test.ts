import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ scope: vi.fn(), list: vi.fn(), execute: vi.fn() }));
vi.mock("./activity-report-scope", () => ({ activityReportScope: mocks.scope }));
vi.mock("@cognelo/activity-sdk/server", () => ({ getActivityReportService: () => ({ studentActions: { list: mocks.list, execute: mocks.execute } }) }));
import { executeActivityStudentAction, listActivityStudentActions } from "./activity-report-actions";
const input = { actionId: "cancel", targetId: "submission", participantId: "p", groupId: "g", reason: "Fix files" };
describe("student row actions", () => {
  beforeEach(() => {
    vi.clearAllMocks(); mocks.scope.mockResolvedValue({ activity: { activityType: { key: "plugin" } }, participants: [{ participantId: "p", groupId: "g" }] });
    mocks.list.mockResolvedValue({ actions: [{ id: "cancel", targetId: "submission", participantId: "p", groupId: "g" }], issues: [] });
  });
  it("checks the exact submission again without running automatic recovery before execution", async () => {
    await executeActivityStudentAction({} as never, "course", "activity", input);
    expect(mocks.list).toHaveBeenCalledWith(expect.objectContaining({ recoverAutomatic: false }));
    expect(mocks.execute).toHaveBeenCalledWith(expect.objectContaining({ actionId: "cancel", targetId: "submission", reason: "Fix files" }));
  });
  it("rejects stale targets and blank reasons without performing a mutation", async () => {
    await expect(executeActivityStudentAction({} as never, "course", "activity", { ...input, targetId: "old" })).rejects.toMatchObject({ code: "ACTIVITY_ACTION_CHANGED" });
    await expect(executeActivityStudentAction({} as never, "course", "activity", { ...input, reason: " " })).rejects.toThrow();
    expect(mocks.execute).not.toHaveBeenCalled();
  });
  it("refuses actions for enrollments outside the authorized roster", async () => {
    mocks.list.mockResolvedValue({ actions: [{ participantId: "foreign", groupId: "g" }] });
    await expect(listActivityStudentActions({} as never, "course", "activity")).rejects.toMatchObject({ code: "ACTIVITY_ACTION_CONTRACT_INVALID" });
  });
});
