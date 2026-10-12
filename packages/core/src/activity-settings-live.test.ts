import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CurrentUser } from "@cognelo/contracts";
const authorization = vi.hoisted(() => ({ getActivityMessagingGroupScope: vi.fn() }));
vi.mock("./authorization", () => authorization);
import { AppError } from "./errors";
const messaging = vi.hoisted(() => ({ listActiveConversations: vi.fn() }));
vi.mock("./activity-messaging", () => messaging);
import { confirmLiveActivitySettings } from "./activity-settings-live";
const tx = {
  activityMessageBroadcast: { create: vi.fn() },
  activityConversationMessage: { createMany: vi.fn() }
};
const teacher = { id: "teacher", firstName: "Ada", lastName: "Teacher", email: "teacher@example.test", roles: ["teacher"] } as CurrentUser;
describe("live settings confirmation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authorization.getActivityMessagingGroupScope.mockResolvedValue(null);
    messaging.listActiveConversations.mockResolvedValue([{ id: "conversation", groupId: "section" }]);
    tx.activityMessageBroadcast.create.mockResolvedValue({ id: "broadcast" });
  });
  it("requires confirmation before any write, even when a message was supplied", async () => {
    await expect(confirmLiveActivitySettings(tx as never, teacher, "course", "activity", { studentMessage: "Extra time" }))
      .rejects.toMatchObject({ code: "ACTIVITY_SETTINGS_ACTIVE_STUDENTS", details: { activeStudentCount: 1 } });
    expect(tx.activityMessageBroadcast.create).not.toHaveBeenCalled();
  });
  it("lets teachers confirm without sending a message", async () => {
    await confirmLiveActivitySettings(tx as never, teacher, "course", "activity", { confirmActiveStudents: true });
    expect(tx.activityMessageBroadcast.create).not.toHaveBeenCalled();
  });
  it("writes the optional notice through the same transaction and section scope", async () => {
    await confirmLiveActivitySettings(tx as never, teacher, "course", "activity", { confirmActiveStudents: true, studentMessage: " Extra time " }, ["section"]);
    expect(messaging.listActiveConversations).toHaveBeenCalledWith("course", "activity", ["section"], expect.any(Date), tx);
    expect(tx.activityConversationMessage.createMany).toHaveBeenCalledWith({ data: [expect.objectContaining({ conversationId: "conversation", broadcastId: "broadcast", body: "Extra time", senderName: "Ada Teacher" })] });
  });
  it("does not require confirmation or send a notice when no students are active", async () => {
    messaging.listActiveConversations.mockResolvedValue([]);
    await confirmLiveActivitySettings(tx as never, teacher, "course", "activity", { studentMessage: "Extra time" });
    expect(tx.activityMessageBroadcast.create).not.toHaveBeenCalled();
  });
  it("allows designers to confirm settings without gaining teacher messaging permission", async () => {
    authorization.getActivityMessagingGroupScope.mockRejectedValue(new AppError(403, "FORBIDDEN", "Forbidden"));
    await expect(confirmLiveActivitySettings(tx as never, teacher, "course", "activity", {}))
      .rejects.toMatchObject({ details: { canNotifyStudents: false } });
    await expect(confirmLiveActivitySettings(tx as never, teacher, "course", "activity", { confirmActiveStudents: true })).resolves.toBeUndefined();
    await expect(confirmLiveActivitySettings(tx as never, teacher, "course", "activity", { confirmActiveStudents: true, studentMessage: "Notice" }))
      .rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(tx.activityMessageBroadcast.create).not.toHaveBeenCalled();
  });
  it("does not send settings notices outside a section teacher's messaging scope", async () => {
    authorization.getActivityMessagingGroupScope.mockResolvedValue(["another-section"]);
    await expect(confirmLiveActivitySettings(tx as never, teacher, "course", "activity", { confirmActiveStudents: true, studentMessage: "Notice" }))
      .rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(tx.activityMessageBroadcast.create).not.toHaveBeenCalled();
  });

});
